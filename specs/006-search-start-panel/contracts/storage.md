# Contract: History storage

Device-only user data. Never sent anywhere (FR-010). Kept under its own key so that clearing it
leaves collections (`hymnia.repertoire.v2`) and preferences (`hymnia.prefs`) untouched.

## Key

`localStorage["hymnia.history.v1"]`

## Document (v1)

```json
{
	"version": 1,
	"entries": [
		{ "hymnal": "jem", "number": "245", "hymnId": "a-toi-la-gloire", "openedAt": "2026-11-14T09:12:00.000Z" },
		{ "hymnal": "adf", "number": "80", "hymnId": "a-l-agneau", "openedAt": "2026-11-14T09:05:00.000Z" }
	]
}
```

- `entries`: most recent first, at most 20, at most one per `hymnId`.
- Field rules: [data-model.md](../data-model.md#history-entry).

## Loading

- Read once when the store is created.
- Missing key, unreadable JSON, wrong `version` or failed validation → empty history. No
  notice, no recovery copy.
- Storage throws (private mode, blocked) → empty history in memory for the visit.

## Writing

- The whole document is written after each `record` or `clear`.
- A failed write is ignored: the history stays in memory for the visit; opening a hymn never
  fails because of it (FR-012).
- No `storage` event listener: other tabs see the new history next time they load it.

## Compatibility

- A future incompatible format uses a new key (`hymnia.history.v2`); the old key is ignored.
