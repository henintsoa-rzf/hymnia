# Data Model: Collections in the Répertoire

User data only. Hymn data (hymnals, hymns, entries) is unchanged; see
[001 data model](../001-hymnal-browse-search/data-model.md).

## Entities

### Répertoire (stored document)

| Field | Type | Rules |
|-------|------|-------|
| `version` | `2` | Literal; any other value is set aside as unreadable |
| `collections` | Collection[] | Any number; ids unique; names unique after normalisation |

### Collection

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Random UUID; never changes (used in URLs) |
| `name` | string | Trimmed, 1–60 characters; unique among collections after normalisation (case, accents, punctuation ignored) |
| `createdAt` | ISO date-time | Set on creation |
| `updatedAt` | ISO date-time | Set on any change to the name or entries; orders the Répertoire (newest first) |
| `entries` | Entry[] | Ordered; at most one entry per hymn |

### Entry

| Field | Type | Rules |
|-------|------|-------|
| `hymnal` | string | Hymnal id (e.g. `ce`) |
| `number` | string | Number as printed (e.g. `12a`, `3 bis`) |
| `addedAt` | ISO date-time | Set when added |
| `hymnId` | string, optional | Id of the hymn the entry was saved for (FR-016). Set on add; filled in on load for older entries whose reference resolves. Absent only while the reference has never resolved |

Derived at runtime (never stored): the hymn the entry points to, its hymn id for "already
added", and `available`.

**Resolving an entry** (`resolveEntries`, FR-016):

1. If `hymnId` is set, follow the catalog's redirects (`content/redirects.json`, written by the
   feature 002 importer when hymns are merged) to the current id.
   - The reference (hymnal + number) points to that hymn: available, as is.
   - The reference points elsewhere or nowhere, and the hymn is published: available, opened
     under its entry in the same hymnal if it has one, otherwise its first entry. The stored
     reference and `hymnId` are updated to match.
   - The hymn is not published (unpublished or unknown): unavailable, even if the reference now
     points to another hymn.
2. If `hymnId` is not set (entries saved before this field existed), use the reference, as
   before, and store the hymn id it resolves to.

## Rules

1. **One hymn per collection**: adding a reference whose hymn is already in the collection
   (under any reference) does nothing and reports "already there". When the catalog cannot
   resolve either reference, references are compared instead.
2. **New entries go last**; moving an entry changes only the order.
3. **Removing** an entry or **deleting** a collection never affects other collections.
   Removing takes out exactly one entry: the one with the given reference, or else the first
   entry of the same hymn. A collection can hold a hymn twice when two hymns are merged at
   import (feature 002); removing one reference then leaves the other.
4. **Unavailable hymns** are kept, shown as "Chant indisponible", removable, and never resolved
   to another hymn. Entries are checked through `hymnId` (see "Resolving an entry"), so a
   renumbered or merged hymn is followed, never replaced.
5. **Deleted collection** is kept in memory (not stored) until the undo delay ends; undo puts
   it back at its position with the same id and entries.

## Operations (pure, in `src/lib/repertoire/model.ts`)

| Operation | Result |
|-----------|--------|
| `createCollection(doc, name, now)` | New doc + id, or a name error (`empty`, `too-long`, `taken`) |
| `renameCollection(doc, id, name, now)` | New doc, or a name error |
| `deleteCollection(doc, id)` | New doc + the removed collection and its index (for undo) |
| `restoreCollection(doc, removed, index)` | New doc |
| `addEntry(doc, id, ref, hymnIdOf, now)` | New doc, or `already-there` |
| `removeEntry(doc, id, ref, hymnIdOf, now)` | New doc, with one entry removed (rule 3) |
| `toggleEntry(doc, id, ref, hymnIdOf, now)` | New doc + `added` / `removed` (bookmark sheet) |
| `moveEntry(doc, id, from, to, now)` | New doc |
| `collectionsWith(doc, ref, hymnIdOf)` | Ids of collections containing the hymn (filled bookmark, sheet marks) |
| `parseDocument(raw)` | v2 doc from nothing or a valid v2; otherwise `corrupt` |
| `validateName(doc, name, exceptId?)` | `ok` or the name error |

`hymnIdOf(ref)` is passed in (resolves through the catalog) so the model stays pure and
testable without hymn data.

## State transitions

```text
Collection: (none) --create--> active --rename/add/remove/move--> active
            active --delete--> pending-undo --undo--> active
                                            --8 s--> gone
```
