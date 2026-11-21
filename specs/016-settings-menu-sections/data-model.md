# Data Model: Settings menu, reading and offline sections

Nothing changes in hymn content or in the catalog. Two things are stored or built: new reading
preferences (per device) and one field in the data manifest. The rest is derived at run time.

## Reading preferences (`Prefs`, extended)

Stored in `localStorage` under `hymnia.prefs` (existing), apart from hymn data (Principle IV).

| Field | Type | Default | Rule | Section |
|-------|------|---------|------|---------|
| `theme` | `'system' \| 'light' \| 'dark'` | `'system'` | existing | Affichage |
| `textScale` | number 0.85–2.0 | `1.0` | existing | Lecture (moved) |
| `lyricFont` | `'serif' \| 'sans'` | `'serif'` | NEW. Stanza text only | Lecture |
| `lineSpacing` | `'tight' \| 'normal' \| 'loose'` | `'normal'` | NEW. Leading 1.4 / 1.6 / 1.85 | Lecture |
| `stanzaNumbers` | boolean | `true` | NEW. Visible verse numbers | Lecture |
| `chorus` | `'once' \| 'each'` | `'once'` | NEW. Chorus repetition (R5) | Lecture |
| `keepAwake` | boolean | `false` | NEW. Wake lock on the hymn page | Lecture |
| `hymnalFilter` | string[] | `[]` | existing | (search) |
| `excluded` | `Exclusions` | none | existing (feature 014) | Recueils |
| `bibleAt` | `{ book, chapter } \| null` | `null` | existing (feature 015) | (Bible) |

Validation: any missing or invalid new field falls back to its default; existing fields keep their
current rules. No version number, no migration step.

## Data manifest (`DataManifest`, extended)

| Field | Type | Rule |
|-------|------|------|
| `updatedAt` | ISO date `YYYY-MM-DD`, optional | NEW. Latest `source.retrievedAt` among published hymns. Absent → no date shown |

The loaded manifest is exposed on `CatalogApi` as `manifest: DataManifest | undefined`.

## Settings section (code constant, not stored)

| Field | Values |
|-------|--------|
| `slug` | `affichage`, `lecture`, `recueils`, `hors-ligne` (route segment) |
| `title` | « Affichage », « Lecture », « Recueils », « Hors ligne » |
| `summary` | derived by `summaryOf(slug, ctx)`, see research R3 |

Order is fixed: the order of `SETTINGS_SECTIONS`.

## Lyrics block (derived, not stored)

`layoutSections(sections, { chorus })` → `Block[]`

| Field | Meaning |
|-------|---------|
| `section` | the source section printed |
| `index` | its index in `hymn.sections` (for meaning marks) |
| `repeat` | `true` when inserted by « Après chaque strophe »; never marked, no anchor id |
| `key` | unique per block (`index` or `index-r<position>`) |

## Offline status (derived, not stored)

| Field | Values |
|-------|--------|
| `items[]` | `{ id: 'hymns' \| 'bible' \| 'meaning', label, state }`; only items the build has |
| `state` | `'ready'` « Disponible hors ligne » · `'downloading'` « Téléchargement en cours » · `'missing'` « Pas encore téléchargé » |
| `usage` | bytes used by the app on the device, or `undefined` when not reported |
| `cacheAvailable` | `false` in private mode or without Cache Storage |
| `updatedAt` | from the manifest |

## Update check (visit state, not stored)

`'idle' → 'checking' → 'update' | 'up-to-date' | 'offline' | 'failed' | 'unavailable'`, with the
time of the last answer. A new check is refused while `checking`. `'update'` hands over to the
existing update prompt.
