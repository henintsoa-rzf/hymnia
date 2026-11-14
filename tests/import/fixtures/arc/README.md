# Fixtures: Arc-en-ciel (`arc`)

The Arc-en-ciel hymnal comes from one public Google Doc, "Chants du recueil “Arc-en-ciel”"
(2nd edition, 1995, typed by Pierre Muller), read through its HTML export
(`https://docs.google.com/document/d/1-ygNIoB_dR9PDsrlMzMBnKGh5NLIkJsN/export?format=html`).
robots.txt of docs.google.com allows `/document`. The export was checked against the `.docx`
the maintainer has: same paragraphs, same text.

`document.html` is an **excerpt** of the export saved on 2026-11-13: the `<style>` element is
removed, and only the title, every section heading and 9 songs are kept, as served. The lyrics
belong to their authors and publishers; the excerpt is a test fixture only, never published.

## Structure

| Element | Meaning |
|---------|---------|
| `ol > li > h1` | Section of the hymnal (Psaumes, Chants Bibliques, …, Envoi): a part in `content/hymnals.json` |
| `ol > li > h2` | Subsection (Repas du Seigneur, Louons Dieu, …): ignored |
| `h3` | One song: "Ps 5 A. Entends, Seigneur, ma plainte", "352. O nuit bienveillante" |
| `body > p` | One stanza; lines separated by `<br>` |

Psalms keep their psalm number (1–150); other songs are numbered from 151 by section
(Chants Bibliques 151, Ouverture 201, …, Envoi 881). A letter marks a variant ("5 A", "367 A").

## Songs kept and why

| Song | Why it is here |
|------|----------------|
| Ps 1 | Plain numbered verses |
| Ps 5 A | Lettered number |
| Ps 24 | A note "(Pour le jour des Rameaux)" opening the paragraph of verse 6 |
| Ps 136 | Refrain labelled "Rif." |
| 258 | Unnumbered song; paragraph "Peut se chanter sur …" (note) |
| 320 | "R." refrain; footnote paragraph "* Version originale : …" |
| 352 | "1-4." parts sung after verses 1 to 4 |
| 467 | Two refrains "R1." and "R2." |
| 591, 592 | 592's heading is a plain paragraph inside 591 |
