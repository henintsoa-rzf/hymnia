# Hymnia

Recueil de chants et hymnes chrétiens, au design épuré, avec une recherche avancée : par
numéro (« JEM 245 », « jem245 », « 245 »), par titre et par paroles, sans accents et avec une faute de
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
droits ne sont pas confirmés (`rights: "unconfirmed"`) n’est pas publié, sauf en usage
personnel : avec `HYMNIA_PERSONAL_USE=1` dans `.env`, tous les chants sont publiés (une telle
copie ne doit pas être distribuée).

Les recueils d’exemple (CE, HE : 12 chants saisis de mémoire) servent aux tests et sont dans
`tests/fixtures/sample-content/` ; leurs identifiants `ce` et `he` sont refusés dans `content/`.
Les tests de bout en bout construisent l’application à partir de cet échantillon : relancer
`npm run data` ensuite pour retrouver la vraie collection dans `static/data/`.

## Importer des recueils

Les recueils réels viennent des sites sources, par l’outil d’import (feature 002) :

```bash
cp .env.example .env               # puis renseigner HYMNIA_CONTACT (adresse envoyée aux sites)
npm run import -- run --source jemaf --hymnal jem --dry-run --yes   # essai : rapport seulement
npm run import -- run --source jemaf --hymnal jem --yes
npm run import -- run --source jemaf --hymnal jem --yes --offline  # depuis le cache, sans réseau
npm run import -- report           # dernier rapport (aussi dans import/reports/)
npm run import -- check            # tout vérifier, sans réseau
```

Rien d’importé n’est publié tant que les droits ne sont pas enregistrés
(`npm run import -- rights set …`), sauf en usage personnel (`HYMNIA_PERSONAL_USE=1`, voir
plus haut). Ordre suivi pour le premier import, et ce qu’il a donné : section R13 de
[specs/002-hymnal-import/research.md](specs/002-hymnal-import/research.md). Les commandes, le format des fichiers d’`import/` et les
scénarios de vérification sont dans
[specs/002-hymnal-import/quickstart.md](specs/002-hymnal-import/quickstart.md). Pour ajouter un
site source : [scripts/import/sources/README.md](scripts/import/sources/README.md).

## Organisation

| Dossier                              | Contenu                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/lib/search/`                    | Analyse des requêtes, moteur de recherche (MiniSearch), extraits, Web Worker            |
| `src/lib/data/`, `src/lib/domain/`   | Schéma des données, numérotation, accès au catalogue                                    |
| `src/lib/components/`, `src/routes/` | Écrans et composants                                                                    |
| `src/app.css`                        | Jetons de design (couleurs claires et sombres, typographie, espacements)                |
| `scripts/`                           | Construction des données, icônes, serveur de test                                       |
| `scripts/import/`, `import/`         | Outil d’import des recueils et son état (sources, décisions, liens, rapports)           |
| `tests/`                             | Tests unitaires, requêtes de référence, performance, bout en bout                       |
| `design/`                            | Brief, maquettes Claude Design (`design/handoff/`) et décisions (`design/decisions.md`) |
| `specs/`                             | Spécifications, plans et tâches (Spec Kit)                                              |
