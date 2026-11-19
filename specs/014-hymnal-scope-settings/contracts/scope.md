# Contract: hymnal selection (feature 014)

## 1. Pure module `src/lib/scope/scope.ts`

```ts
export type Exclusions = { hymnals: string[]; parts: Record<string, number[]> };
export const NO_EXCLUSIONS: Exclusions; // { hymnals: [], parts: {} }

/** Type check only (stored value). */
export function sanitizeExclusions(value: unknown): Exclusions;
/** Normal form against the catalog's hymnals (data-model.md). */
export function cleanExclusions(excluded: Exclusions, hymnals: Hymnal[]): Exclusions;

export type HymnalState = 'all' | 'some' | 'none';
export type Scope = {
	isEmpty: boolean;
	hymnalState(hymnalId: string): HymnalState;
	includesPart(hymnalId: string, first: number): boolean;
	includesEntry(entry: { hymnal: string; sortKey: SortKey }): boolean;
	includesHymn(hymn: { entries: { hymnal: string; sortKey: SortKey }[] }): boolean;
	canLeaveOut(target: { hymnal: string; part?: number }): boolean;
};
export function createScope(excluded: Exclusions | undefined, hymnals: Hymnal[]): Scope;

/** Settings actions; each returns the normal form. */
export function setHymnal(excluded: Exclusions, hymnals: Hymnal[], id: string, inUse: boolean): Exclusions;
export function setPart(excluded: Exclusions, hymnals: Hymnal[], id: string, first: number, inUse: boolean): Exclusions;
```

Rules:
- `createScope(undefined | NO_EXCLUSIONS, …).isEmpty === true`, and then every `includes*` returns
  true and `hymnalState` returns `all`.
- `createScope` cleans its input first; a hymnal unknown to `hymnals` is `all` (never hides data).
- `setHymnal(…, false)` / `setPart(…, false)` on the last item in use returns the input unchanged
  (the screen disables the control; the function also refuses).

## 2. Search engine and worker

`SearchRequest` (`src/lib/search/types.ts`):

```ts
type SearchRequest = {
	query: string;
	hymnals?: string[];
	limit?: number;
	/** Feature 014: what the user left out in Settings; absent = nothing. */
	excluded?: Exclusions;
};
```

`SearchResponse` gains:

```ts
/** `hymnal-number` only: the entry exists but is left out in Settings. `results` is empty. */
outOfScope?: { hymnal: string; number: string };
```

Engine behaviour (`createEngine().search`, `resultFor(hymnId, hymnals, excluded)`):

| Query kind | With a non-empty `excluded` |
|------------|-----------------------------|
| `number` (« 245 ») | only entries in use; one result per hymnal in use that has the number |
| `hymnal-number` (« JEM 245 ») | entry in use → as today, `refs` and `sameNumber` limited to entries in use; entry left out → `results: []`, `outOfScope`; `sameNumber` still lists entries in use; unknown number → `notFound` as today |
| `short`, `text` | hits whose hymn has no entry in use are dropped before ranking/limit; `refs` and `primaryRef` from entries in use only |
| `meaning` | `rankMeaning` skips hymns with no entry in use; word list as above; `resultFor` honours `excluded` |

The per-search filter `hymnals` is first reduced to hymnals not `none`; if empty, no filter.
With `excluded` absent or empty, every response is identical to the current one.

`rankMeaning(data, query, hymns, options)`: `options` gains `allow?: (hymnIndex: number) => boolean`,
combined (AND) with the existing `hymnals` filter and cached per hymn. `searchByMeaning` builds it
from the request's scope.

No change to the worker message types: `excluded` travels inside `request`.

## 3. Screens

### `/reglages`

```text
h1  Réglages
section  h2 Affichage
  h3 Thème               (unchanged)
  h3 Taille du texte     (unchanged, with preview)
section  h2 Recueils
  p.hy-caption  « Choisissez les recueils proposés dans la recherche et les listes. Vos
                 collections et les liens vers un chant ne changent pas. »
  [Tout sélectionner]    (only when something is left out)
  ul
    li  [☑] À Toi la Gloire
    li  [▣] Arc-en-ciel   « 12 parties sur 15 »   [▸ Parties]   (aria-expanded)
          ul  [☑] Psaumes  [☐] Chants bibliques  …
    li  [☐] Exo
    …
```

- Native `<input type="checkbox">`, `indeterminate` for `some`; label = hymnal or part name.
- Disclosure button label « Afficher les parties de <name> » / « Masquer les parties de <name> ».
- Last item in use: `disabled`, `aria-describedby` → « Gardez au moins un recueil. »
- Every change writes `prefs.excluded` with the normal form; no confirm.

### `/` and `/repertoire/<c>/ajouter`

- Filter chips: hymnals whose state is not `none`.
- Initial filter (URL `?recueils=` or saved) keeps only ids in use.
- Every `search` / `searchMeaning` request sends `excluded: $prefs.excluded`.
- `outOfScope` → message « <Nom> est masqué dans les Réglages. » with a link « Réglages » (no
  « introuvable » state).
- Empty `text` / `meaning` results with a non-empty choice → empty state adds « Certains recueils
  sont masqués dans les Réglages. » with a link.
- Start panel examples: `pickExamples(catalog, scope)` (entries in use only).

### `/recueils`

- Hymnals whose state is not `none`. A `some` hymnal shows the count of hymns in use.

### `/recueils/<id>`

- `none`: notice « Ce recueil est masqué dans les Réglages. » + link, above the list (list kept:
  the page was opened on purpose).
- `some`: groups of left-out parts are not rendered, nor their jump links; caption « N parties
  masquées · Réglages ».
- « Aller au numéro » on a number in a hidden part: « Le n° X est dans « <part> », masqué dans les
  Réglages. »

### Unchanged

Hymn page (including neighbours and other references), Répertoire, recent hymns, direct links.
