# Contract: Screens, URLs and Interactions

Extends [001 routes](../001-hymnal-browse-search/contracts/routes.md). French URLs, stable once
published.

| URL | Screen | Purpose | Spec |
|-----|--------|---------|------|
| `/repertoire` | Répertoire | Collections (name, hymn count), newest change first; "Nouvelle collection". Empty state with the same action. | US2, FR-001, FR-002 |
| `/repertoire/<id>` | Collection | Name, count, "Lire dans l’ordre", "Ajouter des chants", ordered hymns (number, hymnal, title); menu: Renommer, Modifier l’ordre, Supprimer. | US1, US2, US4 |
| `/repertoire/<id>/ajouter?q=<query>&recueils=<ids>` | Add hymns | 001 search with an add toggle per result; count of hymns added; "Terminé". | US1, FR-004, FR-005 |
| `/recueils/<hymnal>/<number>?collection=<id>` | Hymn, read in collection | Previous/next and swipe follow the collection; header shows "<name> · 2 / 5". | US4, FR-012 |

An unknown `<id>` shows the "not found" page ("Collection introuvable") with a link to the
Répertoire. An unknown `collection` parameter on a hymn is ignored (001 behaviour).

## Interactions

### Create / rename (dialog)

- Field "Nom de la collection", prefilled on rename, focused; "Créer" / "Renommer" and
  "Annuler". Errors shown under the field and announced: "Donnez un nom à la collection.",
  "Une collection porte déjà ce nom.", "60 caractères au plus." The dialog stays open on error.
- After creating from the Répertoire: go to `/repertoire/<id>/ajouter` (US1 scenario 1).

### Add hymns (`/repertoire/<id>/ajouter`)

- Same field, filter and result kinds as the 001 search screen ([search
  contract](../001-hymnal-browse-search/contracts/search.md)).
- Each result row: title and references (opens the hymn) and a toggle button, label
  "Ajouter « <title> »" / "Retirer « <title> »", `aria-pressed`, icon + / ✓. "Already added"
  compares hymns, not references.
- A polite live region announces "Ajouté à <name>" / "Retiré de <name>".
- The query is never cleared by adding. "Terminé (n)" returns to the collection.

### Collection

- Rows: number and hymnal abbreviation, title; unavailable entries: "Chant indisponible" with
  the stored reference, and "Retirer".
- "Modifier l’ordre" mode: per row "Monter", "Descendre" (disabled at the ends) and "Retirer";
  focus stays on the moved row's button.
- "Supprimer": confirmation dialog "Supprimer « <name> » ?" (the hymns stay in the hymnals),
  then back to the Répertoire with the undo toast (8 s).

### Bookmark sheet (hymn screen)

- Opened by the bookmark (`aria-haspopup="dialog"`, label "Ajouter à une collection").
- Title "Ajouter à une collection"; one toggle row per collection (name, hymn count, ✓ when
  the hymn is in it); "Nouvelle collection" opens the name dialog, then adds the hymn.
- Each toggle applies at once and is announced; "Fermer" or Escape closes.
- The bookmark is filled (`aria-pressed="true"`) when the hymn is in at least one collection.

### Reader in a collection

- With `?collection=<id>` and the hymn in that collection: the top bar shows the collection
  name and position; previous/next (buttons, swipe, arrow keys) move in the collection order;
  at the ends the buttons are disabled with "Premier chant de la collection" / "Dernier …".
- The back arrow returns to the collection.
