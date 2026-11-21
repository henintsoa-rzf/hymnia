# Feature Specification: Settings menu, reading and offline sections

**Feature Branch**: `016-settings-menu-sections`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Dans la page de paramètres j'aimerais qu'il y ait un menu qui affiche
les différentes sections de paramètres sans afficher leur contenu. Et qu'il faut cliquer sur le
titre d'une section pour accéder aux paramètres concernés." Then, among the proposed new settings:
"Garde seulement les sections Lecture et Hors-ligne parmi tes propositions."

The proposed « Lecture » settings were: lyrics font, line spacing, show or hide stanza numbers,
repeat the chorus after each stanza, keep the screen on while reading. The proposed « Hors ligne »
section was: what is available offline, space used on the device, a « check for updates » button.

## Context

Since feature 014, the settings screen shows everything at once: « Affichage » (theme, text size
with its preview) then « Recueils » (the hymnal and part choice, a long list). As settings grow,
one long page gets hard to scan, and the hymnal list pushes everything below it out of sight.

This feature turns the settings screen into a short menu: one entry per section, with its title
and a one-line summary of the current values, and no settings shown. Choosing an entry opens that
section on its own screen, with a way back to the menu.

It also adds two sections:

- **Lecture**: how the lyrics of a hymn are laid out when reading (text size moves here, next to
  font, line spacing, stanza numbers, chorus repetition, and keeping the screen on).
- **Hors ligne**: what the app can do without a network on this device, how much space it uses,
  and a way to check for a new version of the hymns.

The menu ends up with four sections, in this order: **Affichage**, **Lecture**, **Recueils**,
**Hors ligne**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a setting through a menu (Priority: P1)

A user opens Settings. Instead of a long page, they see four entries: « Affichage », « Lecture »,
« Recueils », « Hors ligne », each with a short summary of its current state (e.g. « Thème
système », « Texte 110 % · Avec empattement », « 3 recueils sur 10 », « Prêt hors ligne »). No
setting is shown on this screen. They tap « Recueils »: the hymnal choice opens on its own screen.
They go back: the menu is shown again.

**Why this priority**: This is the request itself. It is usable on its own with the existing
settings (theme, text size, hymnals), before any new setting is added.

**Independent Test**: Open Settings: only section titles and summaries are visible, no control.
Open each section in turn: its settings appear, work as before, and going back returns to the menu.

**Acceptance Scenarios**:

1. **Given** the user opens Settings, **When** the screen appears, **Then** it lists the sections
   in the order Affichage, Lecture, Recueils, Hors ligne, each as one entry with its title and a
   one-line summary, and shows no setting control.
2. **Given** the menu, **When** the user selects a section entry (tap, click, or keyboard),
   **Then** that section opens on its own screen, titled with the section name, showing only its
   settings.
3. **Given** a section is open, **When** the user uses the back control of the screen or the
   device's back gesture or button, **Then** they return to the menu, at the entry they came from.
4. **Given** the user changes a setting in a section, **When** they return to the menu, **Then**
   the summary of that section reflects the change.
5. **Given** a link elsewhere in the app that leads to a setting (e.g. the « left out » note on a
   hymnal page, feature 014), **When** the user follows it, **Then** it opens the matching section
   directly, and back from there leads to the menu.
6. **Given** a section's own address is opened directly (bookmark, reload), **When** the screen
   loads, **Then** that section is shown.

---

### User Story 2 - Adjust how lyrics are laid out (Priority: P2)

A worship leader reads lyrics on a phone placed on a music stand. In « Lecture », they raise the
text size, choose a font without serifs, choose a more open line spacing, hide stanza numbers, and
ask for the chorus after every stanza so they never scroll back up. They turn on « Garder l'écran
allumé » so the phone does not go dark mid-song. A preview in the section shows the effect at once;
every hymn they open then follows these choices.

**Why this priority**: The main new value requested. It serves reading « en situation »
(Principle VI) and builds on the menu.

**Independent Test**: Change each Lecture setting, open a hymn with numbered stanzas and a chorus:
the font, spacing, numbers and chorus repetition match the choices; the screen stays on while the
hymn is open (on a device that allows it). Reload: the choices are kept.

**Acceptance Scenarios**:

1. **Given** the Lecture section, **When** it opens, **Then** it shows, in this order: text size
   (moved from Affichage, unchanged in behaviour), font, line spacing, stanza numbers, chorus,
   keep screen on, and a preview of a short hymn excerpt with a numbered stanza and a chorus.
2. **Given** the font choice « Avec empattement » (default) or « Sans empattement », **When** the
   user picks one, **Then** the preview and the lyrics of every hymn use it; titles, credits and the
   rest of the interface are unchanged.
3. **Given** the line spacing choice « Serré », « Normal » (default) or « Aéré », **When** the user
   picks one, **Then** the space between lyric lines changes accordingly in the preview and in every
   hymn, at any text size.
4. **Given** stanza numbers are turned off, **When** a hymn is shown, **Then** verse numbers are not
   displayed; « Refrain » and « Pont » labels stay; screen readers still announce where each
   stanza starts.
5. **Given** the chorus choice « Après chaque strophe », **When** a hymn with a chorus is shown,
   **Then** the chorus is printed after every stanza that is not already followed by a chorus;
   with « Une seule fois » (default), the current layout is kept (printed once, and again only
   where its words change).
6. **Given** « Garder l'écran allumé » is on, **When** a hymn is open and the app is in front,
   **Then** the device screen does not turn off by itself; when the user leaves the hymn or the
   app, the device's normal sleep comes back.
7. **Given** the user changes any Lecture setting, **When** they look at the preview, **Then** it
   updates at once, with no confirm button.

---

### User Story 3 - Know what works offline and get the latest hymns (Priority: P3)

Before leaving for a retreat with no network, a user opens « Hors ligne ». They see that the
hymns, the hymnals and the Bible are ready on this device, that the data for search by meaning is
downloaded, how much space it all takes, and the date of the hymns they have. They tap « Rechercher
une mise à jour »: the app checks, finds a newer version, and offers to load it.

**Why this priority**: Useful reassurance and control, but the app already works offline and
already offers updates when it finds them; this section makes that visible and on demand.

**Independent Test**: On a device that has opened the app once online, open Hors ligne: each item
shows its state and the total space is shown. Tap the update button online with no new version:
the app says it is up to date. Go offline and tap it: the app says it cannot check without a
connection.

**Acceptance Scenarios**:

1. **Given** the Hors ligne section, **When** it opens, **Then** it lists what the app keeps on the
   device, each with its state: hymns and hymnals, Bible, search by meaning data; each state is one
   of « Disponible hors ligne », « Téléchargement en cours » or « Pas encore téléchargé ».
2. **Given** the section, **When** it opens, **Then** it shows the space the app uses on this
   device, and the date of the hymns version installed.
3. **Given** the section, **When** the user reads it, **Then** a short note says what needs a
   connection: a new search by meaning (searches already made still work), YouTube links, and
   checking for updates.
4. **Given** the user is online, **When** they tap « Rechercher une mise à jour » and a newer
   version exists, **Then** the app offers to load it, the same way it does today when it finds one
   on its own; nothing reloads without the user's consent.
5. **Given** the user is online and no newer version exists, **When** they tap the button, **Then**
   the section says « Hymnia est à jour » with the time of the check.
6. **Given** the user is offline, **When** they tap the button, **Then** the section says that the
   check needs a connection, and nothing else changes.
7. **Given** a check is running, **When** the user looks at the button, **Then** it shows that a
   check is in progress and cannot be started twice.

---

### Edge Cases

- **Wide screens**: the menu and the sections behave the same as on a phone (menu, then one
  section at a time); sections keep the current reading width.
- **Unknown section address**: an address naming a section that does not exist opens the menu.
- **Storage unavailable** (private mode): settings work for the visit only, as today; the Hors
  ligne section says that this browser does not keep the app for offline use, and shows no space
  figure.
- **Space used not available**: on a browser that cannot report it, the space line is hidden
  rather than showing a wrong or zero value.
- **Offline support not available** (no offline support in the browser, or the app opened only as
  a web page that was never stored): items show « Pas encore téléchargé » and the note explains that
  installing or reopening the app online makes it available offline.
- **Keep screen on not supported** by the device or browser: the setting is shown disabled with a
  note « Non disponible sur cet appareil ».
- **Keep screen on interrupted**: if the device ends it (low battery, app sent to background), it
  is requested again when the user comes back to the hymn, as long as the setting is on.
- **Chorus repetition when a hymn has several different choruses**: after each stanza, the chorus
  repeated is the last one printed before that stanza.
- **Chorus repetition when a hymn has no chorus or the chorus comes first**: hymns with no chorus
  are unchanged; a chorus printed before the first stanza is repeated after each following stanza.
- **Search by meaning highlight** (feature 013): a repeated chorus is never marked as the matching
  passage; only the original section is.
- **Text size changed while reading** (existing control in the hymn view): the Lecture section
  shows the same value, since it is one setting.
- **Large text with « Aéré » spacing**: lines must not overlap or be cut at the largest size.
- **Saved preferences from before this feature**: theme, text size and hymnal choice keep their
  values; new settings start at their defaults.

## Requirements *(mandatory)*

### Functional Requirements

**Settings menu**

- **FR-001**: The settings screen MUST show a menu of sections, in this order: « Affichage »,
  « Lecture », « Recueils », « Hors ligne ». It MUST NOT show any setting control.
- **FR-002**: Each menu entry MUST show the section title and a one-line summary of its current
  state:
  - Affichage: the theme (« Thème système », « Thème clair », « Thème sombre »).
  - Lecture: text size as a percentage and the font (e.g. « Texte 110 % · Avec empattement »).
  - Recueils: how many hymnals are in use (« Tous les recueils » or « 3 recueils sur 10 »).
  - Hors ligne: « Prêt hors ligne » when hymns and Bible are available offline, otherwise the
    first item that is not.
- **FR-003**: Selecting an entry MUST open that section on its own screen, titled with the section
  name, with a back control leading to the menu.
- **FR-004**: Each section MUST have its own address, so that the device's back action, a reload
  or a bookmark lead to the expected screen, and other screens can link to a section directly.
- **FR-005**: Existing links to settings about the hymnal choice MUST lead to the « Recueils »
  section: the « left out » notes of a hymnal page, and the search results notes about hymnals or
  numbers left out. The settings entry of the app navigation MUST open the menu and stay shown as
  current while a section is open.
- **FR-006**: The « Affichage » section MUST hold the theme setting, unchanged. The « Recueils »
  section MUST hold the hymnal and part choice, unchanged (feature 014).
- **FR-007**: Menu entries MUST be usable with the keyboard and a screen reader, each announced
  with its title and summary; on return from a section, focus MUST go back to that section's entry.

**Lecture section**

- **FR-008**: The « Lecture » section MUST hold the text size setting (moved from « Affichage »),
  with its current range, behaviour and saved value, and the same value as the size control in the
  hymn view.
- **FR-009**: The section MUST offer a lyrics font choice: « Avec empattement » (default, the
  current font) and « Sans empattement ». It applies to stanza text only.
- **FR-010**: The section MUST offer a line spacing choice: « Serré », « Normal » (default, the
  current spacing), « Aéré ». It applies to lyrics at every text size.
- **FR-011**: The section MUST offer « Numéros des strophes » on (default) or off. When off, verse
  numbers are not shown in hymns; chorus and bridge labels stay; each stanza is still announced as
  such to screen readers.
- **FR-012**: The section MUST offer a chorus choice: « Une seule fois » (default, current
  behaviour) and « Après chaque strophe ». With « Après chaque strophe », the last chorus printed
  is repeated after each later stanza not already followed by a chorus.
- **FR-013**: The section MUST offer « Garder l'écran allumé », off by default. When on, the
  device screen stays on while a hymn is open and the app is in front, and is released when the
  hymn is left; it is requested again on return. Where the device does not allow it, the setting
  is disabled with a note.
- **FR-014**: The section MUST show a preview of a short excerpt (one numbered stanza, one chorus,
  a second stanza) that follows all Lecture settings at once.
- **FR-015**: Lecture settings MUST apply to every hymn view, at once and with no reload. They MUST
  NOT change the stored lyrics (Principle III): only how they are laid out.

**Hors ligne section**

- **FR-016**: The « Hors ligne » section MUST list what the app keeps on the device — hymns and
  hymnals, Bible, search by meaning data — each with one state: « Disponible hors ligne »,
  « Téléchargement en cours », « Pas encore téléchargé ».
- **FR-017**: The section MUST show the space the app uses on this device when the browser can
  report it, and hide it otherwise.
- **FR-018**: The section MUST identify the installed hymns version, by its date of publication
  so that two devices can be compared at a glance.
- **FR-019**: The section MUST state what needs a connection: new searches by meaning, YouTube
  links, checking for updates.
- **FR-020**: The section MUST offer « Rechercher une mise à jour ». Online, it checks for a newer
  version of the app and hymns: if one exists, the existing update offer appears; if not, the
  section shows « Hymnia est à jour » and the time of the check. Offline, it says a connection is
  needed. A running check is shown and cannot be started twice. Nothing reloads without consent.

**Saving**

- **FR-021**: The new Lecture settings MUST be saved on the device with the other reading
  preferences, kept apart from hymn data (Principle IV), restored when the app opens, and fall back
  to their defaults when missing or invalid.
- **FR-022**: Existing saved preferences (theme, text size, hymnal choice, Bible position) MUST
  keep their values after this feature.

**Accessibility**

- **FR-023**: Every new control MUST be usable with the keyboard and a screen reader, announce its
  name and state, and meet WCAG 2.2 AA contrast in light and dark mode. Status changes in Hors ligne
  (check result) MUST be announced.

### Key Entities

- **Settings section**: one entry of the settings menu: a title, a summary derived from current
  settings, and its own screen and address. Four exist: Affichage, Lecture, Recueils, Hors ligne.
- **Reading preferences** (existing, extended): per device, apart from hymn data. Adds lyrics font,
  line spacing, stanza numbers shown, chorus repetition, keep screen on, next to theme, text size,
  hymnal choice and Bible position.
- **Offline status**: derived, not saved: for each kept item (hymns and hymnals, Bible, meaning
  data) whether it is available offline, downloading, or not yet downloaded; space used; installed
  hymns version date; result and time of the last update check during the visit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The settings menu fits on one phone screen (360 × 640) without scrolling.
- **SC-002**: From the search screen, a user reaches any setting in 3 taps or fewer (open Settings,
  open the section, use the setting).
- **SC-003**: A first-time user asked « où changer la taille du texte ? », « où choisir vos
  recueils ? » and « l'application marche-t-elle sans réseau ? » opens the right section on the
  first try for each.
- **SC-004**: 100 % of Lecture setting combinations display lyrics with no overlapping or cut
  lines, at the smallest and largest text size, in light and dark mode, on a phone screen.
- **SC-005**: With « Garder l'écran allumé » on, a supported phone left untouched on an open hymn
  for 10 minutes keeps its screen on; with the setting off, its usual sleep delay applies.
- **SC-006**: A tap on « Rechercher une mise à jour » gives its answer (update offered, up to date,
  or no connection) within 10 seconds on a usual mobile connection.
- **SC-007**: The offline states shown match reality: after the section says hymns and Bible are
  « Disponible hors ligne », 100 % of hymns and Bible chapters open with the network cut.
- **SC-008**: 100 % of preferences saved before this feature keep their values after it.

## Assumptions

- Menu and sections apply at every screen width; no side-by-side layout on wide screens, to keep
  one way of using Settings (Principle V).
- Text size moves from « Affichage » to « Lecture » because it only affects lyrics; « Affichage »
  keeps the theme, which affects the whole app. The text size preview moves with it and becomes the
  Lecture preview.
- « Sans empattement » uses the interface's existing sans-serif font; no new font is downloaded.
- Line spacing values are relative to the text size, so they scale with it.
- Stanza numbers, chorus repetition and keep screen on apply wherever full lyrics are shown (hymn
  view, including a hymn opened from a collection or from the Bible), not to search result
  excerpts.
- « Garder l'écran allumé » only acts while a hymn is open, not on the search or other screens, to
  save battery.
- The hymns data does not carry a publication date today; it will have to be recorded when the data
  is built, so that FR-018 can show it.
- The update check asks for a newer version of the whole app, which carries the hymns; when found,
  the existing update prompt is reused. There is no partial (per hymnal) download.
- Offline states are read from what the device has actually stored; the app does not add a manual
  « download for offline » action, since everything except meaning data is already stored at first
  visit and meaning data downloads by itself.
- Settings remain per device, without accounts or sync.
