# Research: Search the hymn on YouTube

## R1. Target URL

- **Decision**: `https://www.youtube.com/results?search_query=<encodeURIComponent(text)>`.
- **Rationale**: YouTube's public search results page; stable for years, needs no key or
  account, and on phones the OS hands `www.youtube.com` links to the YouTube app when installed.
  `encodeURIComponent` keeps accents, apostrophes and guillemets intact (spaces become `%20`,
  which YouTube accepts like `+`).
- **Alternatives considered**: YouTube Data API (key, quota, a service to run: rejected, V);
  embedded player or iframe search (loads YouTube on page view, breaks FR-005 and II);
  `m.youtube.com` (desktop users land on the mobile site); `youtube://` app scheme (fails where
  the app is missing).

## R2. Search text

- **Decision**: The title shown on the page, `entry.title ?? hymn.title`, with non-breaking and
  narrow non-breaking spaces turned into plain spaces and runs of whitespace collapsed, trimmed.
  No hymnal name, number or author added.
- **Rationale**: Matches FR-003 and the spec assumption; the hymn number means nothing to YouTube,
  and authors of translated hymns are often the English writers, which pulls English versions.
  `frenchSpaces()` is display-only, so the raw title is used; it may still contain NBSP from the
  source, hence the whitespace clean-up.
- **Alternatives considered**: title + hymnal name (« … JEM »): narrows too much for hymns sung
  across hymnals; title + first lyric line: long queries hurt YouTube ranking.

## R3. Placement and look

- **Decision**: A paragraph right after `<HymnCredits>`, inside the `LyricsView` slot, so it sits
  in the credits block (italic, muted, small) on both phone and desktop. Visible text
  « Rechercher sur YouTube » followed by an `external` icon (arrow out of a box, 16 px, decorative).
- **Rationale**: The credits block is already the quiet bottom of the reading view, below the
  lyrics; the bookmark and reading bar stay untouched (FR-002). One placement for both layouts
  keeps the code simple.
- **Alternatives considered**: icon button in the phone top bar (competes with the bookmark,
  breaks FR-002); in the desktop tools row next to the bookmark (more visible than wanted);
  inside `HymnCredits` (it does not know the entry title, see plan).

## R4. Accessibility

- **Decision**: The visible text is the accessible name (« Rechercher sur YouTube »); the icon is
  `aria-hidden` (as all `Icon`s). The outside-link mark is the icon, consistent with the existing
  source link, which also opens in a new tab without an extra announcement. Focus ring from the
  global link style.
- **Rationale**: WCAG 2.5.3 (Label in Name) holds since name = label; the user asked for this
  exact name. Contrast inherits the credits' `--ink-muted`, already AA in both themes.
- **Alternatives considered**: a visually hidden « (nouvel onglet) » suffix (changes the name the
  user chose); `aria-description` (uneven screen-reader support).

## R5. Privacy and offline

- **Decision**: `target="_blank" rel="noopener noreferrer"`; no prefetch, no preconnect, no
  YouTube asset. The service worker does not handle cross-origin navigation, so offline the tab
  shows the browser's offline page and the hymn page is unaffected.
- **Rationale**: FR-004/FR-005: the only thing YouTube receives is the search text, at the tap;
  `noreferrer` keeps the Hymnia URL (and any `?collection=` id) from being sent.
- **Alternatives considered**: hiding the link offline (extra state for little gain; the source
  link is not hidden either).
