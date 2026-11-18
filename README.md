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

## Recherche par le sens

Le bouton « Par le sens » trouve des chants par leur idée ou leur thème, pas seulement par
leurs mots (feature 011, [specs/011-semantic-search/](specs/011-semantic-search/quickstart.md)).
Chaque strophe est transformée en vecteur à la construction ; la requête est transformée en
ligne par le serveur (`POST /api/embed`), puis comparée sur l’appareil. Les résultats suivent
l’ordre du sens ; un titre exact reste en tête. Chaque strophe est indexée avec le titre du chant
et une courte description de ses thèmes, générée par Claude et jamais affichée
(`content/generated/themes.json`).

```bash
# .env : MAMMOUTH_API_KEY=…  (et, au besoin, EMBEDDINGS_BASE_URL, EMBEDDINGS_MODEL)
npx tsx scripts/semantic/smoke.ts "la fidélité de Dieu"   # vérifie le fournisseur
npx tsx scripts/semantic/generate-themes.ts   # .env : ANTHROPIC_API_KEY ; descriptions des chants nouveaux ou modifiés
npm run data                     # ajoute les vecteurs (cache dans .cache/embeddings/)
npx tsx scripts/semantic/evaluate.ts        # compare ce qu’on indexe ; écrit tests/queries/meaning-evaluation.json
npx tsx scripts/semantic/query-vectors.ts   # vecteurs des requêtes de référence (test hors ligne)
```

Sans clé et avec un cache incomplet, `npm run data` saute cette étape avec un avertissement :
l’application fonctionne, sans le bouton. Seuls les textes nouveaux ou modifiés sont envoyés
d’une construction à l’autre. Après un import, lancer d’abord `generate-themes.ts` : si les
paroles d’un chant ont changé depuis sa description, `npm run data` s’arrête et le demande. Un
chant sans description (nouveau, ou dont la description citerait les paroles) est indexé avec
son seul titre, avec un avertissement. Pour relancer la comparaison, lancer `evaluate.ts` puis
reporter le choix dans `src/lib/meaning/config.ts`.

Déploiement (Cloudflare Workers, une seule route serveur `/api/embed`) :

```bash
npx wrangler secret put MAMMOUTH_API_KEY    # une fois
npm run build && npx wrangler deploy
```

Confidentialité : le texte d’une recherche par le sens est envoyé à Mammouth AI, qui le
transmet à OpenAI (`text-embedding-3-large`), sans identité ni cookie ; le serveur ne journalise
pas les requêtes. Les 50 dernières requêtes restent sur l’appareil pour fonctionner hors ligne.

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
