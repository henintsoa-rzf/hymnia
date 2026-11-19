# Feature Specification: Choose the hymnals used by the app

**Feature Branch**: `014-hymnal-scope-settings`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "I would like the user to be able to chose the scope he wants to
include within the whole app. For that, in the settings, make it possible to select or deselect a
Recueil or a Part of a recueil. Create a new subsection within the settings panel and move the
existing settings into another subsection as well."

## Context

Hymnia gathers ten hymnals (JEM, Ailes de la Foi, À Toi la Gloire, Arc-en-ciel, Écritures,
Chorale Psalmodie, Pasteur & Compagnie…). Some are split into parts: JEM into four volumes,
Arc-en-ciel into fifteen sections, Écritures, Psalmodie and Pasteur & Compagnie into albums or
programmes.

Many users only sing from a few of them. A church that uses JEM 1 to 3 gets results from
Arc-en-ciel and Psalmodie it will never sing, and must filter each search by hand. The search
filter (by hymnal) exists, but it is chosen per search and only works at the hymnal level.

This feature lets the user set, once, which hymnals and which parts of a hymnal the app uses. What
is left out disappears from searches, lists and filters across the app, until the user puts it
back. The settings screen gets two subsections: the existing display settings (theme, text size)
and the new hymnal choice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Leave out a whole hymnal (Priority: P1)

A user never sings from Arc-en-ciel. In Settings, under the hymnals subsection, they deselect
Arc-en-ciel. From now on, its hymns no longer come up in searches (by text, by number or by
meaning), Arc-en-ciel no longer appears in the Recueils list nor in the search filter. The choice
is kept the next time they open the app.

**Why this priority**: This is the core of the request and already gives most of the value: the
app shows only the hymnals the user uses.

**Independent Test**: Deselect one hymnal in Settings. Search for a title only found in that
hymnal: no result. Open the Recueils list: the hymnal is absent. Reload the app: the hymnal is
still deselected.

**Acceptance Scenarios**:

1. **Given** all hymnals are selected (first use), **When** the user opens Settings, **Then** every
   hymnal is listed and shown as selected.
2. **Given** the user deselects a hymnal, **When** they search by title, lyrics, number
   (« ARC 12 ») or meaning, **Then** no hymn is returned through that hymnal.
3. **Given** a hymnal is deselected, **When** the user opens the Recueils list or the search
   filter, **Then** that hymnal is not offered.
4. **Given** a hymnal is deselected, **When** the user closes and reopens the app on the same
   device, **Then** it is still deselected.
5. **Given** a hymnal is deselected, **When** the user selects it again, **Then** its hymns come
   back everywhere at once, with no reload needed.

---

### User Story 2 - Keep only some parts of a hymnal (Priority: P2)

A user sings from JEM 1, 2 and 3 but not JEM 4. In Settings, they open the JEM entry, which lists
its parts, and deselect JEM 4. Hymns of JEM 4 no longer come up; JEM 1 to 3 still do. The JEM entry
shows that it is partly selected.

**Why this priority**: Parts are what the user named explicitly, and they matter for hymnals with
many parts (Arc-en-ciel, Psalmodie). It builds on Story 1.

**Independent Test**: Deselect JEM 4 only. Search « JEM 800 » (a JEM 4 number): no result. Search
a JEM 1 number: found. Open the JEM hymnal page: only parts 1 to 3 are shown.

**Acceptance Scenarios**:

1. **Given** a hymnal with parts, **When** the user looks at it in Settings, **Then** its parts are
   listed under it, each with its own selection, in the order of the hymnal.
2. **Given** some but not all parts of a hymnal are selected, **When** the user looks at the
   hymnal entry, **Then** it shows a partly selected state, distinct from selected and deselected.
3. **Given** a hymnal is partly selected, **When** the user selects the hymnal entry itself,
   **Then** all its parts become selected; selecting it again deselects all of them.
4. **Given** the user deselects every part of a hymnal one by one, **When** the last one is
   deselected, **Then** the hymnal itself is shown as deselected and behaves as in Story 1.
5. **Given** a part is deselected, **When** the user opens that hymnal's page, **Then** the part's
   group and its hymns are not shown, and the other parts are.
6. **Given** a hymnal with parts and at least one part selected, **When** the user searches,
   **Then** hymns of that hymnal outside any part (numbers before the first part, no number)
   still come up.

---

### User Story 3 - A tidier settings screen (Priority: P3)

The settings screen is split into two headed subsections: « Affichage » with the existing theme
and text size, and « Recueils » with the new hymnal choice. The user sees at a glance where each
setting lives.

**Why this priority**: Required by the request, but it only arranges the screen; it is cheap once
Story 1 exists.

**Independent Test**: Open Settings. Two subsections are visible, each with a heading; theme and
text size are under « Affichage » and work as before; the hymnal list is under « Recueils ».

**Acceptance Scenarios**:

1. **Given** the settings screen, **When** it opens, **Then** it shows the « Affichage » subsection
   (theme, text size with its preview) and the « Recueils » subsection, each under its own heading.
2. **Given** the existing theme and text size settings, **When** the user changes them, **Then**
   they behave exactly as before this feature.
3. **Given** a screen reader user, **When** they list the headings of the settings screen, **Then**
   both subsection headings are announced, with the existing setting headings nested under them.

---

### Edge Cases

- **Last hymnal**: the user cannot leave the app with nothing selected. When only one hymnal (or
  one part of one hymnal) remains selected, it cannot be deselected, and a short note says why.
- **Hymn in several hymnals**: a hymn that is in a selected hymnal and in a deselected one still
  comes up, shown only under the selected hymnal and its number there.
- **Search filter saved or in a link**: a saved filter or a shared search link that names a
  deselected hymnal ignores that hymnal; if nothing is left, the search runs with no hymnal filter.
- **Direct link to a hymn**: a link or a bookmark to a hymn of a deselected hymnal still opens it,
  so shared links never break. The hymn reading view stays as it is.
- **User data**: hymns already saved in the user's collections (Répertoire) or in the recently
  opened list stay there and still open, even if their hymnal is later deselected. The choice
  narrows what the app offers, it never removes what the user saved.
- **New hymnal or new part added to the app later**: it is selected by default, so a user who made
  a choice still sees new content until they deselect it.
- **Hymnal or part removed from the app**: a stored choice that refers to it is ignored.
- **Hymnal page of a deselected hymnal reached by URL**: the page opens and states that this hymnal
  is left out in Settings, with a link to Settings.
- **Personal-use copy** (Principle III): only the hymnals present in the copy are listed.
- **Storage unavailable** (private mode): all hymnals are used; the choice lasts for the visit
  only, as for the other settings.

## Requirements *(mandatory)*

### Functional Requirements

**Settings screen**

- **FR-001**: The settings screen MUST have two subsections, each with a visible heading:
  « Affichage », holding the existing theme and text size settings, and « Recueils », holding the
  hymnal choice.
- **FR-002**: Theme and text size MUST keep their current behaviour, wording and saved values.
- **FR-003**: The « Recueils » subsection MUST list every hymnal of the app, in the same order as
  the Recueils screen (alphabetical by name), each with a selection control.
- **FR-004**: For a hymnal that has parts, the subsection MUST list its parts under it, in hymnal
  order, each with its own selection control. Parts MAY be folded under the hymnal by default, as
  long as the hymnal entry shows how many parts are selected (e.g. « 3 parties sur 4 »).
- **FR-005**: A hymnal entry MUST show one of three states: selected (all of it), partly selected
  (some parts), deselected. Selecting a partly selected or deselected hymnal selects all of it;
  deselecting a selected hymnal deselects all its parts.
- **FR-006**: The subsection MUST offer a way to select all hymnals again in one action.
- **FR-007**: The user MUST NOT be able to deselect the last selected hymnal or part; the control is
  disabled and a note explains that at least one must remain.
- **FR-008**: Every change MUST apply at once, with no confirm button and no reload.

**Effect across the app**

- **FR-009**: Searches by text, by number and by meaning MUST return only hymns reachable through a
  selected hymnal or part.
- **FR-010**: A hymn that belongs to both selected and deselected hymnals or parts MUST still be
  returned, and MUST be labelled only with its selected hymnal(s) and number(s).
- **FR-011**: Deselected hymnals MUST NOT appear in the Recueils list nor among the search filter
  choices. Deselected parts MUST NOT appear on their hymnal's page.
- **FR-012**: Hymns of a hymnal with parts that fall outside every part MUST follow the hymnal: shown
  while at least one of its parts is selected, hidden when the hymnal is fully deselected.
- **FR-013**: The search examples and any suggestion shown on the start screen MUST only point to
  hymns within the selection.
- **FR-014**: A saved search filter or a search link that names deselected hymnals MUST drop them;
  if none remains, the search applies no hymnal filter.

**What the choice does not affect**

- **FR-015**: Opening a hymn by direct link MUST still work for a hymn outside the selection.
- **FR-016**: Hymns in the user's collections and in the recently opened list MUST stay listed and
  open normally, whatever the selection.
- **FR-017**: A deselected hymnal's page reached by URL MUST open and say that the hymnal is left
  out, with a link to Settings to include it again.

**Saving**

- **FR-018**: The selection MUST be saved on the device with the other settings, kept apart from
  hymn data, and restored when the app opens.
- **FR-019**: The selection MUST be stored as what the user left out, so that a hymnal or part
  added to the app later is selected by default; references to hymnals or parts that no longer
  exist MUST be ignored.
- **FR-020**: With no saved choice, all hymnals and parts MUST be selected.

**Accessibility**

- **FR-021**: Every selection control MUST be usable with the keyboard and a screen reader, announce
  its name and state (including the partly selected state of a hymnal), and meet WCAG 2.2 AA
  contrast in light and dark mode.

### Key Entities

- **Hymnal selection**: the user's choice of scope, per device. Holds the hymnals left out entirely
  and, for hymnals with parts, the parts left out. Belongs to the reading preferences, next to
  theme, text size and search filter; never stored with hymn data (Principle IV).
- **Hymnal**: a hymnal of the app (existing). Has a name, an id and optional parts.
- **Hymnal part**: a part of a hymnal (existing): a title and the first number it holds; it holds
  the numbers up to the next part.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the search screen, a user can leave out a hymnal in under 20 seconds and 4 taps
  or fewer (open Settings, select the hymnal).
- **SC-002**: After a change in Settings, 100 % of the reference searches (numbers, titles, lyrics,
  meaning) return no hymn that is only in a left-out hymnal or part.
- **SC-003**: After a change in Settings, 100 % of the reference searches still return every hymn
  of the selected hymnals and parts they returned before.
- **SC-004**: Searches with a narrowed selection stay within the existing target: lexical results in
  under 200 ms on a common mobile device.
- **SC-005**: 100 % of the hymns saved in collections remain listed and open after their hymnal is
  left out.
- **SC-006**: The choice survives closing and reopening the app in 100 % of tries when device
  storage is available.
- **SC-007**: A first-time user, asked « where do you set the text size? » and « where do you choose
  your hymnals? », finds each in the settings screen on the first try.

## Assumptions

- « Whole app » means everything that offers hymns to browse or find: search (text, number,
  meaning), the Recueils list, hymnal pages, the search filter and start screen suggestions. It does
  not mean the user's own data (collections, recent hymns) nor direct links; these are left intact
  so nothing the user saved disappears.
- The choice is per device, like the other settings; there are no accounts and no sync.
- Subsection names are « Affichage » and « Recueils », in that order; « Affichage » first because
  the existing settings stay where users know them. Both live on the same settings screen, not on
  separate screens.
- The per-search hymnal filter stays: it narrows a single search within the selection, while this
  setting sets the selection itself.
- Parts are those already declared for each hymnal (JEM volumes, Arc-en-ciel sections, Écritures,
  Psalmodie and Pasteur & Compagnie albums); no new parts are defined by this feature.
- The hymn reading view is unchanged, including for a hymn opened from outside the selection.
