# Passation design — Hymnia

- `decisions.md` : choix, écarts avec le brief, décisions D1–D2, questions ouvertes.
- `maquette/` : sources du canevas Claude Design.
  - `hymnia-app.css` : variables des tokens (clair `.hy-day`, sombre `.hy-evening`) et classes `hy-`.
  - `ds/hymnia/components/bundle.css` et `ds/hymnia/tokens.json` : design system Hymnia (classes `hb-`).
  - `*.dc.html` : un fichier par écran ou état (voir le tableau §12 de `decisions.md`).
    Le balisage et les classes sont réutilisables tels quels ; les `{{…}}`, `<sc-if>`, `<sc-for>`
    et le bloc `<script type="text/x-dc">` appartiennent au format de Claude Design
    (logique de démonstration : recherche, analyse des numéros, tailles de texte).
  - `canvas.json` : disposition du canevas.
- Captures : à exporter en PNG depuis le canevas, puis à ranger dans `design/handoff/`
  avec les noms du tableau §12.
