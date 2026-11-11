# Hymnia

Recueil de chants et hymnes chrétiens, au design épuré, avec une recherche avancée : par
numéro (« CE 12 », « ce12 », « 12 »), par titre et par paroles, sans accents et avec une faute de
frappe tolérée. Plusieurs recueils, un même chant pouvant figurer dans plusieurs d’entre eux.

C’est une application web installable (PWA) qui fonctionne hors ligne après une première
visite. Elle est construite avec SvelteKit en mode page unique ; les chants sont des fichiers
JSON transformés en données statiques et en index de recherche au moment de la construction.

## Démarrer

```bash
npm install
npm run dev          # données + serveur de développement
npm run build        # données + site statique dans build/
npm run serve        # sert build/ comme un hébergeur statique (hors ligne compris)
```

Toutes les vérifications (tests unitaires, requêtes de référence, performance, tests de bout en
bout, accessibilité, hors ligne) et les scénarios manuels sont dans
[specs/001-hymnal-browse-search/quickstart.md](specs/001-hymnal-browse-search/quickstart.md).

## Ajouter des chants

Les chants sont dans `content/` : `content/hymnals.json` pour les recueils, un fichier
`content/hymns/<id>.json` par chant. Le format est décrit dans
[specs/001-hymnal-browse-search/contracts/content-schema.md](specs/001-hymnal-browse-search/contracts/content-schema.md).
`npm run data` vérifie le contenu et refuse de construire s’il y a une erreur. Un chant dont les
droits ne sont pas confirmés (`rights: "unconfirmed"`) n’est pas publié.

Les 12 chants de `content/` sont un **échantillon de test** : textes du domaine public saisis de
mémoire et non vérifiés, à ne pas publier tels quels.

## Organisation

| Dossier                              | Contenu                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/lib/search/`                    | Analyse des requêtes, moteur de recherche (MiniSearch), extraits, Web Worker            |
| `src/lib/data/`, `src/lib/domain/`   | Schéma des données, numérotation, accès au catalogue                                    |
| `src/lib/components/`, `src/routes/` | Écrans et composants                                                                    |
| `src/app.css`                        | Jetons de design (couleurs claires et sombres, typographie, espacements)                |
| `scripts/`                           | Construction des données, icônes, serveur de test                                       |
| `tests/`                             | Tests unitaires, requêtes de référence, performance, bout en bout                       |
| `design/`                            | Brief, maquettes Claude Design (`design/handoff/`) et décisions (`design/decisions.md`) |
| `specs/`                             | Spécifications, plans et tâches (Spec Kit)                                              |
