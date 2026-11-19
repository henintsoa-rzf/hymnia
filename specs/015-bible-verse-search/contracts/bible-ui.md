# Contract: Bible screens, verse selection and search from verses

Routes, behaviour and accessibility of the Bible section. Wording is in French, as in the rest of
the app. Visual style follows `design/decisions.md`. The verse text uses the lyrics typography
(`LyricsView`) and the text-size setting.

## 1. Routes

| Route | Screen | Title (`<title>`) |
|-------|--------|-------------------|
| `/bible` | Book list, or redirect to the saved chapter (§2.1) | `Bible · Hymnia` |
| `/bible/[livre]` | Chapter numbers of a book | `<Livre> · Hymnia` |
| `/bible/[livre]/[chapitre]` | Chapter text; `?v=16` brings verse 16 into view and marks it briefly | `<Livre> <n> · Hymnia` |
| `/bible/chants?versets=<sel>` | Hymns found from the selected verses | `Chants pour <label> · Hymnia` (the app’s title pattern) |

- `[livre]` is the book slug (data-model.md, books.ts). An unknown slug or chapter shows the
  existing `NotFound` with a link to `/bible`.
- When the manifest has no `bible` entry, the section is hidden from the navigation, and its
  routes show « La Bible n’est pas disponible dans cette version ».

## 2. Reading

### 2.1 `/bible`

- With a saved `bibleAt` and no `?livres` in the URL, it replaces itself with that chapter
  (`replaceState`), so the back button leaves the section. `/bible?livres` always shows the list.
- The list has two headed groups, « Ancien Testament » (39) and « Nouveau Testament » (27), in
  canonical order. Each book is a link to `/bible/[livre]`. A book with one chapter (Abdias,
  Philémon, 2 Jean, 3 Jean, Jude) links straight to its chapter 1.
- A reference field, « Aller à… (ex. Jean 3:16) », sits at the top. Enter opens the parsed
  reference (research R5). An unknown reference shows « Référence introuvable » under the field
  and keeps the text.
- Footer: « Louis Segond 1910 · domaine public ».

### 2.2 `/bible/[livre]`

- Book name as the heading, then a grid of chapter numbers. Each number is a link with an
  accessible name such as « Chapitre 23 », and a hit area of at least 44 × 44 px.

### 2.3 `/bible/[livre]/[chapitre]`

- Heading: « Psaumes 23 » (book display name + chapter). Psalm titles are verse 1 in Louis Segond
  numbering and are shown as such.
- One verse per block. The verse number is set in small figures before the text.
- **Reading bar** (fixed at the bottom on mobile, like the hymn screen): previous chapter ·
  « Psaumes 23 ▾ » (opens the chapter grid of the book) · next chapter. Previous and next cross
  books (Malachie 4 → Matthieu 1). They are disabled at Genèse 1 and Apocalypse 22.
- Showing a chapter updates `bibleAt`.
- Swiping is not used to change chapters: it conflicts with text selection and scrolling.

## 3. Selecting verses

- **Tapping a verse** toggles it. A selected verse gets the accent background and a bar on its left
  edge (as the stanza marked by feature 013). Each verse is a `<button type="button" aria-pressed>` whose content is the number
  and the text. It is announced as « Verset 16, Car Dieu a tant aimé… », toggle button, pressed or
  not. Text selection with a long press still works for copying a few words.
- **Selection bar**: shown above the reading bar while at least one verse is selected,
  `role="region"` with `aria-label="Versets choisis"`. It holds:
  - the count and label: « 3 versets · Psaume 23:1-3 », shortened with an ellipsis if long; the
    full label is in `title` and in the accessible name;
  - **« Chercher des chants »** (primary action), which goes to `/bible/chants?versets=…`;
  - **« Copier »**, and **« Partager »** where `navigator.share` exists;
  - **« Effacer »**, which clears the selection and is announced « Sélection effacée ».
- The selection persists across chapters and books (data-model.md). A verse selected in another
  chapter counts in the bar but is not on screen. The label shows it.
- **Limit** (FR-011): when adding a verse would make the joined text exceed 2,000 code points,
  the verse is not added. The bar shows « Limite atteinte : 2 000 caractères au plus » for
  4 s, also announced through `aria-live="polite"`.
- The selection count changes are announced politely: « 3 versets choisis ».

## 4. `/bible/chants?versets=<sel>`

- Header: back link « ‹ Retour aux versets » (to the chapter of the first selected verse, with
  the selection kept), then « Chants pour » + the label, then the verse text in a quiet, collapsed
  block (« Voir le texte »).
- **Run**: on load, the selection is restored from `versets` (which replaces the stored
  selection) and the search runs at once (research R7): `embedQuery(text, meta, { maxChars: 2000,
  cache })`, then `client.searchMeaning({ query: '', hymnals: [], excluded }, vector, configId)`.
- **Waiting / errors**: the existing `MeaningStatus` component and messages (preparing data,
  waiting, offline, rate, unavailable, config), with cancel and retry. Offline:
  « La recherche par le sens nécessite une connexion. » (the existing message) with « Réessayer ».
- **Results**: `ResultList` with `kind: 'meaning'`: each hymn once, its excerpt, and a link with
  `?passage=` (feature 013). Hymnals left out in Settings never appear (feature 014). No hymnal
  filter chips. The status is announced: « Résultats par le sens : 50 chants ».
- An empty or invalid `versets` shows « Aucun verset choisi » with a link to `/bible`.

## 5. Copy and share format

```
<verse text> <verse text> …
— <label> (Louis Segond 1910)
```

- Runs of consecutive verses are joined by a space. Separate runs (another chapter or a gap)
  start a new paragraph (blank line).
- The label uses the reference format of research R5: « Jean 3:16-17 », « Psaume 23:1-4 ;
  Jean 10:11 ».
- After copying: « Versets copiés » (toast, announced). If the clipboard is refused:
  « Copie impossible sur cet appareil ».

## 6. Navigation shell

- Main navigation (tab bar and top bar): Recherche · Recueils · **Bible** · Répertoire. The Bible
  tab is current on every `/bible…` route.
- On the chapter screen, the tab bar gives way to the reading bar, as on the hymn screen.

## 7. Accessibility checks (FR-019)

- Headings: h1 is the screen title. The book groups use h2.
- All controls can be reached with Tab, in visual order. Enter or Space toggles a verse.
- Contrast meets AA for selected and unselected verses, the selection bar and disabled
  previous/next buttons, in light and dark mode. The existing axe e2e check covers the new
  screens.
- The selected state never relies on colour alone: a bar on the left edge shows too (feature 013 pattern).
