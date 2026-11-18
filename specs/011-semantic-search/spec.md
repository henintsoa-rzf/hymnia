# Feature Specification: Semantic search

**Feature Branch**: `011-semantic-search`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "I would like to add a new feature which is a semantical search or
intelligent search. The idea is to do a search based on text embeddings, we would compute the
similarity between the query and the stanza embeddings for example, and would give the top 50 for
example as a result. We would need 3 steps: embed every stanza of every song at ingestion, so it
is offline and server-side, but the vectors would be stored locally on the device (phone or pc);
when the user presses the button for semantical search, the text would be sent to the server, and
the server would perform the embedding and send back to the device. It is an online step as it
needs connection to the server; when the device receives the embedding of the query, the
computing of the similarity would be performed locally on the device, so offline. Some points
need to be determined, such as what should we embed in order to get the best of the search
(stanza only, stanza + song title, stanza + small explanatory paragraph…), should do semantical
search only or both semantical + lexical, if so should we add a reranker etc."

## Context

Today's search (feature 001) is lexical: it finds a hymn by number, by title or by words of its
lyrics, with tolerance for accents and typos. It only works when the user remembers the words.
It cannot answer "a hymn about God's faithfulness in trials" or "something for a funeral about
the hope of heaven" when those words are not in the lyrics. The constitution (Principle I) names
search by meaning as a goal, and says it MUST add to lexical search, never replace it.

Facts about the corpus and the app that shape this feature (2026-11-17):

- The corpus holds **2,730 hymns** and about **11,800 sections** (verses, choruses, bridges).
  Many choruses are repeated in full after each verse, so there are fewer distinct sections.
- The app is a static, offline-first app: all hymns are on the device and search runs on the
  device. **There is no server today.** This feature adds the app's first online service, which
  turns a query into the same kind of vector as the hymns.
- All content is French. Queries will be French, sometimes with a Bible reference or a theme
  word ("Psaume 23", "Pâques", "baptême").

The feature has three steps, as described:

1. **Index (offline, maintainer side)**: when content is built, every stanza of every hymn is
   turned into a meaning vector. The vectors are shipped with the app data and stored on the
   device.
2. **Query (online)**: when the user asks for a search by meaning, the query text is sent to the
   service, which returns its meaning vector.
3. **Ranking (offline, on the device)**: the device compares the query vector with the stored
   stanza vectors and ranks the hymns.

Three design questions are left open in the request: what text to turn into vectors, whether to
blend meaning-based and word-based results, and whether to add a reranking step. This spec
answers the first with a measured comparison (User Story 3). The other two were settled with the
user (see Clarifications).

## Clarifications

### Session 2026-11-17

- Q: How are results shown when the user searches by meaning? → A: One list that blends results
  by meaning and word-search results (FR-003).
- Q: Is a reranking step part of this feature? → A: No; left out, to be measured later (FR-007).
- Q: When is the meaning data downloaded? → A: In the background after install, once the app is
  idle (FR-016).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a hymn by its meaning (Priority: P1)

A worship leader prepares a service on God's faithfulness in hard times. They type « la fidélité
de Dieu dans l'épreuve » and press the search-by-meaning button. They get a list of hymns about
that theme, even those that use other words ("Il est fidèle", "dans la tempête il me garde"),
each with the stanza that matches best. They open one with a tap.

**Why this priority**: This is the feature. It lets users find hymns by theme or idea, which
word search cannot do.

**Independent Test**: With the stanza vectors on the device and the service online, run the
reference queries (User Story 3) through the button and check that each expected hymn appears in
the results, with a stanza excerpt, and opens on tap.

**Acceptance Scenarios**:

1. **Given** the user has typed a query and is online, **When** they press the search-by-meaning
   button, **Then** they see up to 50 hymns in one list that blends closeness of meaning and
   word matches, each with its title, its references (hymnal and number) and an excerpt (the
   best-matching stanza, or the matching line for a word match).
2. **Given** the query is the exact title of a hymn, **When** the user searches by meaning,
   **Then** that hymn is still the first result.
3. **Given** a hymn has several stanzas that match the query, **When** the results are shown,
   **Then** the hymn appears once, ranked by its best stanza.
4. **Given** the user has restricted the search to some hymnals, **When** they search by meaning,
   **Then** only hymns of those hymnals are shown.
5. **Given** results are shown, **When** the user taps one, **Then** the hymn opens at the
   reference shown, like a word-search result.
6. **Given** the user searched « l'espérance du ciel pour un enterrement », **When** results are
   shown, **Then** hymns about heaven, resurrection and comfort rank above hymns that only share
   the word "ciel".
7. **Given** results by meaning are shown, **When** the user edits the query, **Then** the
   results by meaning are no longer shown as current until they press the button again (word
   search keeps updating as they type, as today).

---

### User Story 2 - Search by meaning with a weak or no connection (Priority: P1)

A user in a church with poor coverage presses the search-by-meaning button. If the service
cannot be reached, they get a clear message and word-search results stay usable. If they repeat a
search by meaning they already ran on this device, it works with no connection.

**Why this priority**: The app is used where the network is weak (Principle VI). The online step
must never block or break the rest of search.

**Independent Test**: With the network off, press the button for a new query, then for a query
already run online; check the message, the word results and the repeated query's results.

**Acceptance Scenarios**:

1. **Given** the device is offline, **When** the user presses the button for a query not run
   before, **Then** a message says that search by meaning needs a connection, and word-search
   results stay on screen.
2. **Given** the device ran a query by meaning online before, **When** the user runs the same
   query offline, **Then** the results appear, computed on the device.
3. **Given** the service is slow, **When** the user waits, **Then** they see that the search is
   running, can cancel it, and get a message after a bounded wait instead of an endless spinner.
4. **Given** the meaning data is still downloading in the background, **When** the user presses
   the button, **Then** they are told it is being prepared, with its progress, and word search
   still works; the search runs as soon as the data is ready.

---

### User Story 3 - Choose what to index, based on measured results (Priority: P1)

The maintainer builds a set of reference queries by meaning, each with the hymns it should find
(e.g. « confiance dans l'épreuve » → "Il est fidèle", "Ô Dieu notre aide aux temps anciens"). They
then compare several ways of building the index on this set: the stanza alone, the stanza with
the hymn title, the stanza with the title and a short description of the hymn's theme. The
results tell which one to ship, and whether blending in word search helps.

**Why this priority**: The request leaves open what to index; guessing would risk a feature that
looks clever but finds the wrong hymns. The constitution requires a versioned reference query
set for any search change.

**Independent Test**: Run the comparison and check that it reports, for each candidate, the
share of reference queries whose expected hymns are found in the top 10 and top 50, and the index
size.

**Acceptance Scenarios**:

1. **Given** the reference set, **When** the maintainer runs the comparison, **Then** they get,
   for each candidate, the share of queries with an expected hymn in the top 1, top 10 and top
   50, and the size of the data shipped to the device.
2. **Given** a candidate uses short theme descriptions, **When** these descriptions are made,
   **Then** they are stored apart from the lyrics, marked as generated, and never shown as part
   of a hymn's text or credits.
3. **Given** the comparison is done, **When** a candidate is chosen, **Then** the choice and its
   scores are recorded with the reference set, and the same comparison can be rerun later.

---

### User Story 4 - Keep the index in step with the hymns (Priority: P2)

The maintainer imports a new hymnal or fixes the lyrics of a hymn. On the next content build, the
vectors of the new or changed stanzas are computed, the others are reused, and users' devices get
the updated meaning data with the next app data update.

**Why this priority**: Hymnals are added often (features 004, 005, 010). The index must follow
without recomputing everything or leaving hymns out.

**Independent Test**: Build, change one hymn and add one, build again; check that only those
stanzas are recomputed and that a device gets them on its next update.

**Acceptance Scenarios**:

1. **Given** content is unchanged, **When** the content is built again, **Then** no vector is
   recomputed and the meaning data is identical.
2. **Given** one hymn's lyrics changed, **When** the content is built, **Then** only its stanzas
   are recomputed.
3. **Given** a device holds meaning data of an older build, **When** the app data is updated,
   **Then** the meaning data is updated too, and never mixed between two builds.
4. **Given** the way vectors are made changes (another model), **When** the content is built,
   **Then** all vectors are recomputed and the service and devices never compare vectors made
   two different ways.

### Edge Cases

- **Empty query or a number query** (« JEM 245 », « 245 »): the search-by-meaning button is not
  offered, since the word search already answers those.
- **Very short query** (one word such as « grâce »): allowed; results come by meaning. Word
  search shows its own results as usual.
- **Very long query** (a pasted paragraph or Bible passage): accepted up to a set length (500
  characters); longer text is cut, and the user is told.
- **A query with a Bible reference** (« Psaume 23 »): handled as any text. Hymns that quote the
  psalm should rank well, but no Bible lookup is done in this feature.
- **Repeated choruses**: a chorus written out after each verse counts once per hymn; a hymn does
  not rank higher because its chorus is repeated.
- **Hymns with very short sections** (one-line refrains, « Alléluia ! Amen ! »): they must not
  come first for every query just because they are short and generic.
- **The same hymn in several hymnals**: one hymn, indexed once, shown once with all its
  references (Principle IV). Two hymns whose lyrics differ, even slightly, stay two hymns, each
  indexed.
- **Hymns not published in a build** (rights not confirmed, outside personal use): not in that
  build's meaning data, so never in the results.
- **The service is down, slow or returns an error**: a message after a bounded wait; word search
  unaffected; nothing cached from a failed reply.
- **The service and the device disagree on the index version**: the reply is refused and the
  user is told to update the app data, instead of showing wrong results.
- **Heavy or abusive use of the public service**: the service limits the request rate and query
  length so that it stays available and its cost stays bounded.
- **Low-end phone**: ranking on the device stays fast enough (see SC-003); the meaning data is
  loaded only when first needed, not at app start.

## Requirements *(mandatory)*

### Functional Requirements

**Search by meaning**

- **FR-001**: The search screen MUST offer a search-by-meaning action next to the search field,
  offered only when the query holds text (not empty, not a hymnal number query).
- **FR-002**: Search by meaning MUST NOT replace word search: word search MUST keep working and
  updating as the user types, as in feature 001 (constitution, Principle I).
- **FR-003**: When the user runs a search by meaning, the results MUST be shown as one list
  that blends results by meaning and word-search results for the same query. A hymn found both
  ways appears once. An exact title match from word search stays first. How the two are weighted
  is set by the measured comparison (FR-020), and may give word search no weight: the comparison
  of 2026-11-18 found that any weight on word search lowered the results, so the list follows
  the meaning order, with an exact title match still first (research.md "Evaluation results").
- **FR-004**: Results by meaning MUST be hymns, not stanzas: each hymn at most once, ranked by its
  best-matching stanza, with that stanza as the excerpt. At most 50 hymns are shown.
- **FR-005**: Each result MUST show the hymn title, its references filtered by the selected
  hymnals, and the best-matching stanza excerpt, and MUST open the hymn on tap, as word-search
  results do (feature 001, FR-008).
- **FR-006**: Search by meaning MUST respect the hymnal filter (feature 001, FR-010).
- **FR-007**: No reranking step (a second, finer pass over the top results) is part of this
  feature. The ranking stays on the device, with a single online call per new query. Reranking
  may be measured later as a feature of its own.

**Online step**

- **FR-008**: The query text MUST be sent to the service only when the user runs a search by
  meaning, never as they type.
- **FR-009**: The service MUST return the query's meaning vector made the same way as the
  device's stanza vectors, tagged with that way's version; the device MUST refuse a vector whose
  version differs from its meaning data.
- **FR-010**: The service MUST NOT store queries with anything that identifies the user or device;
  any log kept for running the service holds no more than the query text, the time and the
  outcome, for a limited period.
- **FR-011**: The service MUST limit query length (500 characters) and request rate per client.
- **FR-012**: The device MUST show progress while waiting, let the user cancel, and stop with a
  clear message after at most 10 seconds without a reply.
- **FR-013**: The device MUST keep the vectors of recent queries (at least the last 50) so that
  repeating one works offline and does not call the service again.

**Index and data on the device**

- **FR-014**: At content build, a vector MUST be made for each distinct stanza of each published
  hymn, using the representation chosen in User Story 3. A section repeated within a hymn MUST
  be indexed once for that hymn.
- **FR-015**: The meaning data MUST be part of the app data of its build: same hymns, same
  version, updated with it, and never mixed with another build's data.
- **FR-016**: The meaning data MUST be downloaded in the background after the app has loaded,
  once the app is idle, so that it neither delays the first launch nor waits for the first
  search by meaning. When the device asks to save data, the download MUST wait until the user
  first runs a search by meaning. If the user searches before the download ends, they are told
  it is in progress. Once on the device, the data MUST be kept and used offline.
- **FR-017**: Ranking (comparing the query vector with the stanza vectors) MUST run on the
  device, with no network.
- **FR-018**: The build MUST reuse the vectors of unchanged stanzas and recompute only new or
  changed ones, unless the way vectors are made has changed, in which case it MUST recompute all.

**Measured choice of what to index**

- **FR-019**: A reference set of at least 40 queries by meaning, each with one or more expected
  hymns, MUST be versioned with the other search reference queries. It MUST cover themes (grace,
  faithfulness, Easter, Christmas, communion, mission, comfort, praise), occasions (funeral,
  baptism, wedding), short queries, long queries and Bible references. Each query MUST name the stanza(s) it
  targets and share no word with them or their hymn's title, apart from stop words (plurals and
  words of the same stem count as the same word): synonyms, paraphrases and theological terms
  (rédemption, justification par la foi, souverain sacrificateur…) only.
- **FR-020**: A comparison MUST measure, on this set, at least these candidates: the stanza alone;
  the stanza with the hymn title; the stanza with the title and a short theme description of
  the hymn. It MUST also measure blending with word search. It MUST report the share of queries
  with an expected hymn in the top 1, 10 and 50, and the size of the meaning data.
- **FR-021**: The shipped representation MUST be the best-scoring candidate on the top-10 measure,
  unless a smaller one scores within 5 points of it, in which case the smaller one is chosen. The
  choice and scores MUST be recorded.
- **FR-022**: Theme descriptions, if used, MUST be stored apart from the hymn text, marked as
  generated, and MUST NEVER be displayed as lyrics or credits (Principle III). They exist only
  to build the index.

### Key Entities

- **Stanza vector**: The meaning vector of one distinct section of a hymn. Linked to its hymn and
  section; built from the indexed text (see Indexed representation).
- **Indexed representation**: What text is turned into a vector for a stanza (stanza alone, with
  title, with a theme description), and the way vectors are made, with a version.
- **Meaning data**: All stanza vectors of a build, with its version. Shipped with the app data,
  stored on the device.
- **Theme description**: Optional short generated text about a hymn's theme, used only to build
  the index. Stored apart from lyrics, never displayed.
- **Query vector**: The meaning vector of a user's query, returned by the service with its
  version. Recent ones are kept on the device.
- **Meaning-search service**: The online service that turns a query into a query vector. It
  holds no hymn data the device needs.
- **Reference query by meaning**: A query with its expected hymns, versioned with the search
  reference queries, used for the measured choice and as a regression test.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the reference set, at least 50% of queries have an expected hymn in the top 10
  results, and at least 75% in the top 50. (Lowered from 80% and 95% on 2026-11-18: the
  reference set expects one hymn per query, so other relevant hymns count as misses.)
- **SC-002**: On the reference set, search by meaning finds an expected hymn in the top 10 for at
  least twice as many queries as word search alone does.
- **SC-003**: On a mid-range phone, results appear within 2 seconds of pressing the button on a
  typical mobile connection, and within 300 ms for a query already run (no network).
- **SC-004**: The meaning data adds at most 10 MB to what a device downloads. The limit may be
  raised to 20 MB only if the measured comparison (FR-020) shows that the larger data finds an
  expected hymn in the top 10 for at least 3 more points of the reference queries (decision of
  2026-11-18).
- **SC-005**: With no connection, 100% of attempts at a new search by meaning end with a clear
  message within 1 second, and word search stays usable.
- **SC-006**: Word search results and speed (constitution: under 200 ms) are unchanged by this
  feature on the existing search reference queries.
- **SC-007**: After a content build where one hymn changed, fewer than 1% of stanza vectors are
  recomputed.
- **SC-008**: 0 theme descriptions or other generated text appear in any hymn view, excerpt or
  credit.

## Assumptions

- The user's design is kept: vectors are made offline at build time, the query vector comes from
  an online service, and ranking runs on the device. Running the whole search on the server
  would be simpler but would fail offline and send the hymn data's work to a server for every
  query; it is not chosen.
- The constitution already settles "meaning only or meaning plus words": word search stays in
  every case. When the user asks for a search by meaning, the two are blended in one list
  (FR-003).
- Results are hymns, not stanzas, because users look for a hymn to sing; the best stanza is shown
  to explain why it matched. This follows the request's "top 50".
- The way vectors are made must handle French well. Which model or provider is used, and where
  the service is hosted, are plan decisions. The service is new: today the app is fully static,
  and the plan must justify this added service (Principle V, Complexity Tracking).
- The service only turns text into vectors. It does not need the hymns and does not hold user
  data. Vectors of the hymns are not hymn text, so shipping them does not publish lyrics; they
  still follow each build's publication rule (only published hymns are indexed).
- If theme descriptions are measured, they are generated once by the maintainer at build time
  from the hymn's lyrics, reviewed by sampling, and regenerated only when the lyrics change.
- No accounts: the service cannot tell users apart beyond the rate limit per client.
- Query vectors kept on the device stay on the device and are cleared with the app's data.
- The search-by-meaning button's label and look follow the existing search screen design and are
  set in the plan; it must be reachable with one hand and by keyboard and screen reader
  (Principle VI).
- Out of scope: search by Bible verse (linking hymns to verses is a later extension, Principle V),
  automatic theme tags shown to users, other languages, search by meaning inside a collection.
