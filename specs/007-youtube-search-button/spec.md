# Feature Specification: Search the hymn on YouTube

**Feature Branch**: `007-youtube-search-button`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Please add a discrete button when a song is opened to search the song on youtube"

## Context

Hymnia shows lyrics and credits, but no recording. When a song leader prepares a service, or a
singer does not know the tune, they leave the app, open YouTube and type the title by hand,
often with accents and punctuation that slow them down.

This feature adds a small, discreet link on the hymn page that opens a YouTube search for the
hymn, so the user can hear it in one tap. Hymnia does not embed or host any video: it only
hands the search over to YouTube. The lyrics stay the main content of the page (Principle II).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear a hymn from its page (Priority: P1)

A song leader is preparing Sunday's service and opens « JEM 245 », a hymn whose tune they do not
remember. Under the credits, they see a discreet « Rechercher sur YouTube » link. They tap it and
YouTube opens, in a new tab or in the YouTube app, on a search for the hymn's title. The hymn
page stays open in Hymnia.

**Why this priority**: This is the whole feature. It saves leaving the app and retyping the
title, and gets the user to recordings of the right hymn in one tap.

**Independent Test**: Open any hymn, tap the YouTube link, and check that a YouTube search opens
for that hymn's title while the hymn page is still open in Hymnia.

**Acceptance Scenarios**:

1. **Given** the user has opened a hymn, **When** they look at the page, **Then** a discreet
   YouTube link is visible near the credits, styled as a secondary action, not competing with
   the lyrics, the bookmark or previous/next.
2. **Given** the hymn page for « JEM 245 », **When** the user taps the link, **Then** YouTube
   opens on a search whose text is the hymn's title as shown on that page.
3. **Given** the user tapped the link, **When** they come back to Hymnia, **Then** the same hymn
   is still displayed, at the same scroll position and text size.
4. **Given** a hymn opened under another reference (« AdF 80 » for a hymn also in JEM) whose
   title differs between hymnals, **When** the user taps the link, **Then** the search uses the
   title shown on the current page.
5. **Given** a keyboard or screen reader user, **When** they reach the link, **Then** it is
   focusable, announced as « Rechercher sur YouTube », and visibly marked as leading outside
   Hymnia.

---

### Edge Cases

- Title with accents, apostrophes, guillemets or other punctuation (« À Toi la gloire », « Ô
  Dieu, c'est toi ») : the search text reaches YouTube intact, with no broken characters.
- Very short or generic title (« Alléluia ») : results may be broad; this is accepted, the user
  refines the search on YouTube.
- Device offline: the link stays visible; following it fails the way any outside link does,
  and the hymn page is unaffected.
- Hymn read inside a collection (`?collection=…`): the link works the same and does not disturb
  the collection's reading order.
- Phone and desktop layouts: the link sits with the credits in both, and never in the bottom
  reading bar (previous · size · next).
- Light and dark modes: the link is legible in both with AA contrast.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The hymn page MUST show one link that opens a YouTube search for the hymn shown.
- **FR-002**: The link MUST be discreet: a small secondary action placed with the credits, below
  the lyrics, never in the top bar or in the reading bar, and visually lighter than the bookmark.
- **FR-003**: The search text MUST be the hymn's title as displayed on the current page.
- **FR-004**: Following the link MUST open YouTube outside the hymn page (new tab, or the YouTube
  app when the device hands it over) and MUST leave the hymn page as it was.
- **FR-005**: Hymnia MUST NOT embed a player, load YouTube content, or contact YouTube before the
  user taps the link; nothing about the user is sent other than the search text YouTube receives
  when the link is followed.
- **FR-006**: The link MUST have an accessible name (« Rechercher sur YouTube »), be
  reachable with the keyboard, show a visible focus, and carry an outside-link mark showing
  that it leaves the app.
- **FR-007**: The link MUST be present on every hymn page, whatever the hymnal or the way the
  hymn was reached (search, hymnal, collection, shared link, previous/next).

### Key Entities

- **YouTube search link**: derived from the hymn shown — its displayed title as search text.
  Not stored; no user data involved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any hymn page, a user reaches YouTube results for that hymn in one tap, with no
  typing.
- **SC-002**: For a sample of 20 hymns across all hymnals, the YouTube search text matches the
  displayed title exactly, accents and punctuation included.
- **SC-003**: The hymn page's lyrics area looks unchanged: the link adds no element above the
  lyrics or in the reading bar.
- **SC-004**: The hymn page makes no request to YouTube until the link is tapped.
- **SC-005**: The page passes the same accessibility checks as today (keyboard only, screen
  reader, light and dark modes, mobile and desktop widths).

## Assumptions

- A search (not a chosen video) is the right target: Hymnia has no curated recording per hymn,
  and the user picks the version they want on YouTube.
- The title alone is the search text; adding the hymnal name or authors was judged to narrow
  results too much for translated hymns. It can be tuned later without changing the feature.
- The link opens a public YouTube search page; no YouTube account, key or service is needed.
- Linking to a search does not reproduce any protected work, so Principle III's rights rules are
  not affected; Principle V is respected since no dependency or service is added.
- The visible label is the accessible name, « Rechercher sur YouTube », with an outside-link
  mark; styling follows the credits block.
- No change to search, collections, history or the other screens.
