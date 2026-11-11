# Contract: Import files

Field rules are in [../data-model.md](../data-model.md). All JSON is UTF-8 and NFC, uses sorted
keys and 2-space indentation, and ends with a newline, so diffs stay stable.

## Layout

```text
import/
├── sources.json                    # versioned
├── decisions/                      # versioned
│   ├── rights.json
│   ├── merges.json
│   └── source-priority.json
├── state/links.json                # versioned
├── pending/<hymnId>--<source>.json # versioned while pending; deleted on accept/reject
├── reports/<runId>.json|.md        # versioned
└── cache/                          # git-ignored
    └── <source>/<sha1(url)>.html + .meta.json
```

## Examples

`import/sources.json`

```json
[
  {
    "baseUrl": "https://psalmodie.ch",
    "hymnals": ["psalmodie"],
    "id": "psalmodie",
    "minDelayMs": 10000,
    "name": "Chorale Psalmodie — psalmodie.ch",
    "permission": "unknown",
    "terms": { "checkedAt": "2026-11-11", "summary": "À vérifier", "url": null }
  }
]
```

`import/decisions/rights.json`

```json
[
  { "basis": "permission", "date": "2026-12-01", "note": "Accord écrit JEM, réf. …", "scope": "hymnal", "target": "jem" },
  { "basis": "public-domain", "date": "2026-11-11", "note": "Budry †1932", "scope": "hymn", "target": "a-toi-la-gloire" }
]
```

`import/decisions/merges.json`

```json
[{ "a": "a-toi-la-gloire", "b": "a-toi-la-gloire-jem-245", "date": "2026-11-20", "decision": "merge" }]
```

`import/decisions/source-priority.json`

```json
{ "jem": ["jemaf", "cdl"] }
```

`import/state/links.json`

```json
[
  {
    "acceptedFingerprint": "sha256:…",
    "hymnId": "a-toi-la-gloire",
    "hymnal": "jem",
    "lastSeenAt": "2026-11-20",
    "number": "245",
    "source": "cdl",
    "status": "active",
    "url": "https://www.conducteurdelouange.com/…"
  }
]
```

## Change to feature 001's content schema

`content/hymns/<id>.json` gains an optional `alternateSources: Source[]` (default `[]`). The
change is additive, so existing files stay valid. Feature 001's
`contracts/content-schema.md` and Zod schema are updated in the same change.
