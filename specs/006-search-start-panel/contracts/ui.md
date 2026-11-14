# Contract: Search screen start content

Changes the empty-field state of `/` ([001 routes](../../001-hymnal-browse-search/contracts/routes.md)).
URLs are unchanged. With text in the field, the screen is exactly as before (FR-009).

## What is removed

- The « Recueils » heading and hymnal list, on mobile (under the help text) and on desktop (side
  column). `HymnalList` stays in use on `/recueils`.

## Blocks (field empty)

| Block | Heading (h2, labels its list) | Content | Shown when |
|-------|-------------------------------|---------|------------|
| Help | — | Existing help sentence, with the example reference taken from the catalog. | Always |
| Examples | « Essayez » | Up to 3 buttons: a number, a title, a lyrics fragment. | No recent hymn **and** no collection, and the catalog yields at least one example |
| Recent hymns | « Récemment consultés » | Up to 8 rows: reference (`HymnRef` style tile) + title; link to the hymn at that reference. « Effacer » button in the heading row, accessible name « Effacer les chants récents ». | At least one resolvable entry |
| Recent collections | « Collections » | Up to 3 rows: name + « n chants », link to `/repertoire/<id>`; then a link « Tout le Répertoire » to `/repertoire`. | At least one collection |
| Keyboard tips | — | Existing text (`/` and `Entrée`). | Desktop only, always |

## Placement

- **Mobile** (main column, in this order): Help, Examples, Recent hymns, Recent collections.
- **Desktop**: main column — Help, Examples. Side column — Recent hymns, Recent collections,
  Keyboard tips. The side column keeps its current top alignment with the search field.

## Interactions

- **Example button**: sets the field to its text, keeps focus in the field, runs the search;
  the URL gets `?q=` like any typed search (back button returns to the empty screen).
- **Recent hymn row**: plain link, opens `/recueils/<hymnal>/<number>`.
- **Effacer**: empties the history immediately; the Recent hymns block disappears; focus moves
  to the search field; a polite live region says « Historique effacé ».
- **Collection row**: plain link to the collection.

## Recording

- The hymn page records the shown hymn each time it displays a found hymn (first load,
  previous/next, swipe, links). A not-found page records nothing.

## Accessibility

- Each block is a `section` labelled by its heading; lists use `aria-labelledby` like
  `HymnalList` today.
- Examples are `button`s whose accessible name is the query text, e.g. « Rechercher JEM 1 ».
- All controls reachable by keyboard; `/` shortcut and `Entrée` behaviour unchanged.
