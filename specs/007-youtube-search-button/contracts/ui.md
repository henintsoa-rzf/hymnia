# UI Contract: YouTube search link on the hymn page

Route: `/recueils/[recueil]/[numero]` (with or without `?collection=<id>`), when a hymn is found.
Not shown on the « chant introuvable » page.

## Element

```html
<p class="hymn__youtube">
  <a href="https://www.youtube.com/results?search_query=<encoded title>"
     target="_blank" rel="noopener noreferrer">
    Rechercher sur YouTube <svg aria-hidden="true">…external…</svg>
  </a>
</p>
```

| Property | Value |
|----------|-------|
| Accessible name | « Rechercher sur YouTube » (visible text; icon hidden) |
| Role | link (native `<a>`) |
| `href` | `youtubeSearchUrl(entry.title ?? hymn.title)` — see [data-model.md](../data-model.md) |
| Opens | new tab / YouTube app; `noopener noreferrer` |
| Position | Right after the credits (`<HymnCredits>`), inside the lyrics block, phone and desktop |
| Not in | phone top bar, phone reading bar, desktop tools row |
| Look | Credits style: small, muted; outside-link icon after the text; global focus ring |
| Network | No request to any YouTube host before the link is followed |

## Helper

`youtubeSearchUrl(title: string): string` in `src/lib/format.ts` — pure; normalizes whitespace
(NBSP, narrow NBSP, runs), trims, encodes with `encodeURIComponent`.

| Input | Output `search_query` |
|-------|----------------------|
| `À Toi la gloire` | `%C3%80%20Toi%20la%20gloire` |
| `Ô Dieu, c'est toi` | `%C3%94%20Dieu%2C%20c'est%20toi` |
| `Mon Rédempteur  vit ` | `Mon%20R%C3%A9dempteur%20vit` |
| `« Gloire » !` | `%C2%AB%20Gloire%20%C2%BB%20!` |
