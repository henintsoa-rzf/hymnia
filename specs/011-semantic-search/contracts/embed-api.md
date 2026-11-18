# Contract: Query embedding service

The app's only online endpoint. It is served by the Worker of the same Cloudflare deployment as
the static app (research R9), at the same origin, so no CORS is needed.

## `POST /api/embed`

### Request

```http
POST /api/embed
Content-Type: application/json

{ "text": "la fidélité de Dieu dans l'épreuve", "configId": "te3-large/title+theme+stanza/1024/i8/v1" }
```

| Field | Rule |
|-------|------|
| `text` | String, 1–500 characters after trimming (counted in Unicode code points). The app cuts longer text itself and tells the user (spec edge case). |
| `configId` | The `MeaningConfig.id` of the meaning data on the device. |

### Responses

| Status | Body | When | App behaviour |
|--------|------|------|---------------|
| 200 | `{ "configId": "…", "dims": 1024, "vector": "<base64 float32, little-endian, L2-normalised>" }` | OK | Check `configId` and `dims`, store in the query cache, rank. |
| 400 | `{ "error": "invalid" }` | Bad JSON, missing or empty field | "La recherche par le sens a échoué." (should not happen) |
| 409 | `{ "error": "config", "expected": "<configId>" }` | `configId` ≠ the Worker's | "Mettez l'application à jour pour utiliser la recherche par le sens." with the existing reload action |
| 413 | `{ "error": "too-long" }` | More than 500 characters | Same as 400 (the app already cuts) |
| 429 | `{ "error": "rate" }` + `Retry-After` | Over 30 requests per 60 s for this client | "Trop de recherches d'affilée, réessayez dans un instant." |
| 502 / 503 | `{ "error": "upstream" }` | The Mammouth call failed or timed out (8 s), or credits are exhausted | "La recherche par le sens est indisponible pour le moment." Word results stay. |

Any other method or path under `/api/` gets a 404 JSON response.

### Behaviour

1. Validate, then apply the rate limit (key: client IP, held only by the rate-limit binding).
2. Look up the edge cache (`configId` + normalised text). On a hit, return it.
3. Call `POST <EMBEDDINGS_BASE_URL>/embeddings` with `{ model: "text-embedding-3-large",
   input: [text] }` and `Authorization: Bearer <MAMMOUTH_API_KEY>` (a Worker secret). Cut the
   3,072-dim vector to `dims` and re-normalise it (L2) with the shared
   `src/lib/meaning/vector.ts`, the same code the build uses (research R7). This guarantees
   that query and stanza vectors are made the same way.
4. Cache for 30 days and return.

### Privacy (FR-010)

- No query text, IP or user agent in logs. Observability records only status and duration.
- No storage other than the edge cache, whose key and value hold no user data.
- No cookies and no authentication.

### Client rules (`src/lib/meaning/embed-client.ts`)

- Called only when the user presses the button and the query is not in the query cache
  (FR-008, FR-013).
- `AbortController`: the user can cancel, and the call stops after **10 s** (FR-012).
- If `navigator.onLine === false`, the app shows the offline message at once, without calling
  (SC-005). A network error gives the same message.
- A failed reply is never cached.
