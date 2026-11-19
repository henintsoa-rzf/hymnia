# Contract: Search field and its search-by-meaning mode (UI)

This replaces the "When the action is offered" section and the "Words" and "Query edited" rows of
the UI states table in
[feature 011's meaning-search contract](../../011-semantic-search/contracts/meaning-search.md).
Everything else there (worker messages, response, ranking, waiting, preparing, errors) is
unchanged.

## `SearchBox.svelte`

```ts
props: {
  value?: string;                          // bindable; always one line
  input?: HTMLTextAreaElement;             // bindable; was HTMLInputElement
  mode?: 'word' | 'meaning';               // bindable
  meaningAvailable?: boolean;              // from the page load (manifest), not from the query
  onsubmit?: () => void;                   // Enter; the page decides what it does (mode.ts)
  onmodechange?: (mode: 'word' | 'meaning') => void;
}
```

The `meaningActive` and `onmeaning` props go.

## Layout

| | Word mode | Meaning mode |
|---|-----------|--------------|
| Field height (mobile / ≥ 1024 px) | 52 / 56 px | 104 / 112 px |
| Text | one line, no wrap, 18 px | wraps, 3 lines visible then scrolls inside, 18 px |
| Frame | `--line-strong`; focused `--focus` 2 px | `--meaning`; focused `--meaning` 2 px |
| Leading icon | `search`, `--ink-muted`, centred | `meaning`, `--meaning`, aligned to the first line |
| Placeholder | « Numéro, titre ou paroles » | « Décrivez un thème, une idée, un passage… » |
| Accessible name | « Rechercher par numéro, titre ou paroles » | « Rechercher par le sens : décrivez ce que vous cherchez » |
| Clear button | inside the field, right, centred | inside the field, top right |
| Mode button | 52 / 56 px square, icon `meaning`, not pressed | same size and place, pressed: `--meaning` on `--meaning-soft`, frame `--meaning` |

The mode button sits right of the field when `meaningAvailable`, from the first paint. Field +
button fit a 320 px wide screen with a 16 px gutter. The height change animates in 160 ms, not
under `prefers-reduced-motion: reduce`.

Neither the field's outer box nor the mode button changes size or position while the value
changes. Only the clear button appears or disappears, inside the field's existing padding.

## Mode button

- `<button type="button" aria-pressed="true|false" aria-label="Rechercher par le sens"
  title="Rechercher par le sens">`.
- Press: toggles the mode, calls `onmodechange`, keeps the focus and caret in the field
  (the button does not take focus on pointer press; keyboard users keep it on the button).

## Page behaviour (`src/routes/+page.svelte`)

| Event | Effect |
|-------|--------|
| Turn the switch on | Nothing is searched; the launch button appears under the switch (disabled while the field is empty) |
| Launch button or Enter key | See research R6 (`decideSubmit`): a text runs the search by meaning, again if already shown; a hymn number opens its hymn; empty does nothing |
| Leave mode | Cancel a search in progress, drop results by meaning, show word results; drop `sens=1` |
| Edit text | Nothing is sent. Before a first launch, word results update as you type; once launched, the results by meaning stay until the next launch (a hymn number typed meanwhile shows its hymn; emptying the field drops them); mode and `sens=1` stay |
| Change the hymnal filter | The launched text is searched again with the new filter (its vector is cached) |
| Load with `sens=1` | Meaning mode; text query → search by meaning once the worker is ready |
| `meaningAvailable` false | No switch; `sens=1` ignored |

The mode control is a switch (`role="switch"`, `aria-checked`, « Recherche par le sens »); the
launch button (« Lancer la recherche par le sens ») shows in the meaning mode only, under the
switch, so the column is as tall as the doubled field and nothing moves while typing.

`src/lib/meaning/mode.ts`:

```ts
export type SubmitAction = 'open-first' | 'run-meaning' | 'none';
export function decideSubmit(input: {
  mode: 'word' | 'meaning';
  queryKind: ParsedQuery['kind'];   // from parseQuery, synchronous
}): SubmitAction;

/** Line breaks (typed or pasted) become one space. */
export function singleLine(text: string): string;
```

## Status line and help

- The status line (`MeaningStatus`) and the screen-reader summary are unchanged.
- The keyboard help in the desktop aside adds: « En mode “par le sens”, <kbd>Entrée</kbd> lance
  la recherche. »

## Accessibility

- The mode is announced through the button's `aria-pressed` and the field's accessible name.
- Color is not the only cue (height, icon, placeholder, pressed state).
- axe checks pass in both modes, light and dark (`tests/e2e`).
