# Décisions de design — Hymnia

Ce document accompagne la maquette Claude Design et le brief `design/brief.md` (rédigé à partir
de `specs/001-hymnal-browse-search/` et de `.specify/memory/constitution.md`). Il fixe les choix
retenus, les écarts avec le brief et les questions encore ouvertes, pour reprendre le
développement des écrans à la tâche **T024**.

- **Maquette** : canevas Claude Design « Hymnia »
  (https://claude.ai/code/artifact/c1821717-c980-457b-b76b-ce63e1235743, privé : à partager
  depuis le menu Partager).
- **Design system** : « Hymnia » (https://claude.ai/code/artifact/f1dff752-b5c8-4ffe-a9b0-31bac4690dd4),
  composants HTML/CSS préfixés `hb-`. La maquette ajoute des classes d’application préfixées `hy-`
  (fichier `hymnia-app.css` du canevas).
- **Passation** : exporter le canevas (Partager › Exporter) et enregistrer les captures dans
  `design/handoff/`, une par écran et par état (noms proposés en §12).

---

## 1. Principes appliqués

| Principe (constitution)          | Traduction dans la maquette                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Design épuré, centré sur le texte | Un seul but par écran. Paroles en Literata, rien d’autre sur la page du chant. Pas d’image, pas de dégradé, pas d’animation des paroles. |
| La recherche d’abord             | `/` est l’écran Recherche : le champ est en haut, prêt à taper, les résultats arrivent pendant la frappe, sans bouton.      |
| Lisible en situation             | Mobile d’abord, barre de navigation et barre de lecture en bas (à portée du pouce), texte de 85 % à 200 %, mode sombre.   |
| Accessible                       | Contrastes AA dans les deux thèmes, cibles ≥ 44 × 44 px, vrais `<button>`/`<a>`/`<input>`, focus visible, `aria-live` pour les résultats. |
| Respect des auteurs              | Crédits sous le titre et bloc complet (paroles, musique, traduction, source) en fin de chant, toujours affichés.          |
| Sobre et intemporel              | Papier, encre et un seul rouge (« rubrique », d’après les rubriques des recueils imprimés). Pas d’effet de mode.            |

## 2. Tokens

Source : `tokens.json` du design system Hymnia, plus un ajout (`mark`).

### 2.1 Couleurs

| Token          | Rôle                               | Clair     | Sombre    |
| -------------- | ---------------------------------- | --------- | --------- |
| `paper`        | Fond de page                       | `#faf8f4` | `#141311` |
| `paper-raised` | Surface (champ, feuilles, barres)  | `#ffffff` | `#1d1b19` |
| `paper-sunken` | Surface creuse (puits, badges)     | `#f1eee7` | `#0e0d0c` |
| `ink`          | Texte                              | `#1e1c19` | `#ede8e0` |
| `ink-muted`    | Texte secondaire                   | `#5b564e` | `#a8a196` |
| `rubric`       | Accent (numéros, libellés, actif)  | `#9c3a2b` | `#e8907c` |
| `rubric-soft`  | Accent doux (sélection, cible)     | `#f6e9e4` | `#33221d` |
| `on-rubric`    | Texte sur fond accent              | `#ffffff` | `#1b0f0c` |
| `mark` *(ajout)* | Surlignage des mots trouvés      | `#f3e0a8` | `#4d3d12` |
| `line`         | Filet décoratif                    | `#e4dfd6` | `#2f2c28` |
| `line-strong`  | Bordure de contrôle (≥ 3:1)        | `#8a8378` | `#736c62` |
| `focus`        | Anneau de focus (= `rubric`)       | `#9c3a2b` | `#e8907c` |

Règles : le texte n’utilise que `ink`, `ink-muted`, `rubric` ou `on-rubric`. Les paroles ne sont
jamais en `rubric`. Thème par défaut : celui du système (`prefers-color-scheme`), modifiable dans
Réglages.

### 2.2 Typographie

- **Literata** (Google Fonts, axes `opsz` 7–72, `wght` 300–700, italique) pour tout ce qui
  appartient au chant ; **Instrument Sans** (`wght` 400–600) pour l’interface.
- URL : `https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,300..700;1,7..72,300..700&family=Instrument+Sans:wght@400..600&display=swap`
  (à auto-héberger pour le hors-ligne, voir §11).
- Chiffres tabulaires pour les numéros.

| Style          | Police  | Taille / interligne | Graisse | Usage                                      |
| -------------- | ------- | ------------------- | ------- | ------------------------------------------ |
| `hymn-number`  | Serif   | 2,2 × paroles (44/48 à 100 %) | 300 | Référence « CE 1 », en `rubric`    |
| `hymn-title`   | Serif   | 1,3 × paroles (26/34)         | 500 | Titre du chant                      |
| `lyric`        | Serif   | 20/32 à 100 % (interligne 1,6) | 400 | Lignes des strophes                |
| `refrain`      | Serif italique | comme `lyric`        | 400 | Lignes du refrain                   |
| `verse-number` | Serif   | 0,75 × paroles               | 600 | Numéro de strophe, en marge, `rubric` |
| `attribution`  | Serif italique | 15/22                 | 400 | Crédits, `ink-muted`                |
| `screen-title` | Sans    | 22/28               | 600     | Titre d’écran                              |
| `list-title`   | Sans    | 17/24               | 500     | Titre dans une liste                       |
| `body`         | Sans    | 16/24               | 400     | Textes, messages                           |
| `label`        | Sans    | 14/20               | 500     | Boutons, pastilles, libellés               |
| `caption`      | Sans    | 13/18               | 400     | Métadonnées, extraits courts               |
| `overline`     | Sans    | 12/16, +0,08 em, capitales | 600 | Titres de section, « Refrain », « Pont » |

### 2.3 Espacements, rayons, ombre, mise en page

- Échelle de 4 px : `4, 8, 12, 16, 24, 32, 48, 64`.
- Gouttière : 16 px (téléphone), 24 px (tablette et ordinateur).
- 32 px entre deux strophes ; 24 px entre l’en-tête du chant et la 1re strophe ; 48 px avant les
  crédits ; marge basse suffisante pour ne jamais passer sous la barre de lecture.
- Rayons : `radius-sm` 6 px (pastilles, badges), `radius-md` 10 px (boutons, champs, cartes),
  `radius-pill` pour les boutons-icônes ronds 44 × 44.
- Ombre `shadow-float` uniquement pour ce qui flotte : barre de lecture, feuilles.
- Colonne des paroles : `max-width: 34em`, centrée sur grand écran (la colonne, jamais les lignes).

## 3. Navigation

- **Trois destinations : Recherche · Recueils · Répertoire.**
  - Mobile : barre en bas, icône + libellé, au-dessus de la zone sûre de l’iPhone
    (`padding-bottom: env(safe-area-inset-bottom)`).
  - Ordinateur (≥ 1024 px) : barre en haut avec le nom « Hymnia » à gauche.
- **Réglages** s’ouvrent par une icône en haut à droite de l’écran Recherche (et de la barre
  ordinateur).
- **Écart avec le brief** : le brief propose Recherche · Recueils · Réglages. Choix retenu :
  Réglages sortent de la barre (réglés une fois), Répertoire y entre (favoris et listes, utilisés
  à chaque culte).
- **Le Répertoire reste visible** (onglet et signet sur le chant), même s’il est livré avant
  d’être complet (décision D1, §15). État vide : « Aucun chant dans votre répertoire. Touchez le
  signet d’un chant pour l’ajouter ici. »
- L’écran d’un chant n’affiche pas la barre de navigation : la lecture prend tout l’écran, le
  retour se fait par la flèche en haut à gauche.

## 4. Recherche — `/`

Deux types de recherche, **clairement séparés** par un sélecteur en haut de l’écran :
**« Numéro et paroles »** (par défaut) et **« Par le sens »**. Chacun a son propre champ.

### 4.1 Numéro et paroles

- Champ de 52 px de haut, texte 18 px (évite le zoom automatique d’iOS), texte d’aide
  « Numéro, titre ou paroles ». Bouton d’effacement (×) dès qu’il y a du texte.
- Résultats pendant la frappe, sans bouton « Rechercher ». Un résumé est annoncé aux lecteurs
  d’écran par une région `aria-live="polite"`.
- Normalisation de la requête : minuscules, accents retirés, espaces multiples réduits, ’ → '.

**Analyse de la requête** (expression utilisée dans la maquette) :
`^([a-z]{1,8})?\s*(\d{1,5})\s*(a|b|bis)?$`

| Requête          | Comportement                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| vide             | Texte d’aide, puis la liste des recueils (abréviation, nom, nombre de chants), chaque ligne mène au recueil. |
| `CE 7`, `ce7`    | **Résultat exact** en carte mise en avant (référence en grand, titre, recueil). En dessous : « Autres chants n° 7 » des autres recueils. |
| `12`             | Liste « Chants n° 12 » : tous les chants portant ce numéro, chacun avec son badge et le nom du recueil.     |
| `CE 9999`        | Message calme : « Aucun chant n° 9999 dans Cantiques d’exemple », lien « Voir les 10 chants du recueil ». Pas de rouge. |
| `JEM 245` sans recueil JEM | « Aucun recueil « JEM » dans Hymnia », lien vers Recueils.                                          |
| texte            | Recherche dans titres et paroles (ci-dessous).                                                                |

**Recherche texte** :
- Tous les mots doivent être présents (ET), insensible aux accents et à la casse, correspondance
  par sous-chaîne, ce qui tolère un mot incomplet (« gloir » → « gloire »). Une vraie tolérance
  aux fautes (distance d’édition) reste à préciser côté moteur (Q3).
- Une ligne de résultat par chant : titre, badges de toutes ses références (« CE 5 · HE 2 »),
  puis un extrait entre guillemets français : la première ligne des paroles qui contient tous
  les mots. Les mots trouvés sont surlignés (`<mark>`, fond `mark`, graisse 600), étendus au mot
  entier.
- Aucun résultat : « Aucun chant ne contient « … » », avec une suggestion (orthographe, autres
  mots, ou recherche par le sens).

**Filtres par recueil** :
- Pastilles sous le champ, une par recueil, sélection multiple. Une pastille active porte une
  coche, le fond `rubric-soft` et `aria-pressed="true"`. Un toucher l’efface.
- S’appliquent aux numéros seuls, à la recherche texte et à la recherche par le sens ; pas à une
  référence complète (« CE 7 » trouve CE 7 même si seul HE est filtré).
- Quand un filtre vide les résultats : bouton « Chercher dans tous les recueils ».

### 4.2 Par le sens

- Champ distinct : zone de texte de trois lignes, icône boussole, texte d’aide « Décrivez un
  thème ou une occasion, par exemple « espérance pour des obsèques » ».
- Vide : phrase d’explication, puis des **idées** en pastilles (Deuil, Noël, Pâques, Confiance,
  Pardon, Mission) qui remplissent le champ.
- Résultats sous « Proches par le sens · N », chacun avec ses badges et une ligne
  « Thèmes : … » qui explique le rapprochement. Six résultats au plus, triés par pertinence.
- Aucun résultat : « Aucun chant proche de cette idée », suggestion de reformuler.
- **La maquette simule** ce mode avec une table de synonymes et des thèmes par chant.
- **Hors ligne** (décision D2, §15) : viser un moteur entièrement local. S’il faut un service en
  ligne, l’onglet « Par le sens » reste visible hors ligne et affiche à la place des résultats :
  « La recherche par le sens demande une connexion » / « Vous êtes hors ligne. La recherche par
  numéro, titre ou paroles fonctionne sans réseau. », avec le bouton « Chercher par numéro et
  paroles ». Le texte saisi est conservé, et la recherche se relance au retour du réseau.
  Plan de travail : `SearchOffline`.

## 5. Recueils — `/recueils`

Liste de tous les recueils : vignette avec l’abréviation (serif, `rubric`), nom complet, ligne
« CE · 10 chants ». Toute la ligne est un lien.

## 6. Un recueil — `/recueils/ce`

- En-tête : retour vers Recueils, nom complet, « CE · 10 chants ».
- Champ **« Aller au numéro »** + bouton « Aller » (et touche Entrée). Le chant visé défile au
  centre et sa ligne est surlignée (`rubric-soft`). Numéro absent : message en ligne
  « Pas de n° 99 dans ce recueil. »
- Liste ordonnée par numéro (`<ol>`), numéro à droite d’une colonne fixe, titre. Prévoir
  plusieurs centaines de lignes : liste virtualisée ou rendue par morceaux si nécessaire.
- **Tri des numéros** : numérique, puis suffixe (`12` < `12a` < `12b` < `13`, `3` < `3 bis`).
  La comparaison pour « Aller au numéro » ignore espaces et casse (`3bis` = `3 bis`).

## 7. Un chant — `/recueils/ce/1`

### 7.1 Structure

1. Barre du haut : retour (nom du recueil), bouton « Ajouter au répertoire » (signet).
2. En-tête : référence « CE 1 » (style `hymn-number`, `rubric`), titre, une ligne de crédits
   courte (« Paroles : Edmond Budry · Musique : G. F. Haendel »).
3. Strophes : numéro dans la marge gauche (colonne de 24 px), lignes exactement comme dans la
   source, alignées à gauche, sans justification ni césure.
4. **Refrain** : libellé « Refrain » (`overline`, `rubric`), lignes en italique, retrait de 48 px.
   **Imprimé une seule fois**, après la première strophe qui en a un. Il n’est imprimé de
   nouveau que là où ses paroles changent (refrain propre à une strophe). Pas de rappel abrégé
   entre les strophes.
5. **Pont** : libellé « Pont », lignes en romain, même retrait que le refrain. Jamais de couleur
   pour distinguer refrain ou pont.
6. Crédits complets (filet `line` au-dessus) : Paroles, Musique, Traduction (si présente), puis
   Source : nom, lien, date.
7. « Aussi dans » : une ligne-lien par autre recueil (badge « HE 7 » + nom du recueil).

### 7.2 Lignes longues

Une ligne trop longue pour l’écran (surtout à 200 %) passe à la ligne **en retrait suspendu**
(`padding-left: 1em; text-indent: -1em`) pour qu’on voie qu’il s’agit d’une seule ligne de la
source.

### 7.3 Barre de lecture

Barre flottante en bas (`paper-raised`, `shadow-float`, zone sûre comprise) :
**précédent · taille du texte · suivant**.
- Précédent / suivant : chant voisin dans le même recueil. Le bouton « suivant » affiche la
  référence (« CE 2 ») ; son nom accessible donne aussi le titre. Au premier ou au dernier chant,
  le bouton est désactivé (`disabled`, `aria-disabled`).
- Balayage horizontal sur les paroles : même effet que précédent / suivant (seuil franc pour ne
  pas gêner le défilement vertical).
- Sur ordinateur : la barre devient une ligne « précédent / suivant » sous les crédits, et le
  réglage de taille passe en haut à droite de la colonne.

### 7.4 Taille du texte

- **7 crans : 85, 100, 115, 130, 150, 175, 200 %**, soit des paroles de 17 à 40 px.
- Tout l’en-tête et les numéros suivent la même échelle (multiples de la taille des paroles,
  variable CSS `--lyric`). L’interface (barres, boutons) ne change pas de taille.
- Réglage global, mémorisé sur l’appareil, modifiable dans le chant ou dans Réglages.
- La mise en page doit refluer sans rien couper à 200 % et à 200 % de zoom du navigateur.
- **Écart avec le design system** : il prévoyait 4 crans jusqu’à 30 px ; étendu pour couvrir
  85–200 % du brief.

### 7.5 Lecteurs d’écran

Le chant se lit comme un document : titre (`h1`), crédits, puis chaque strophe en paragraphe
avec « Strophe 1 » en texte masqué, « Refrain » et « Pont » lus comme libellés.

## 8. Réglages — `/reglages`

- **Thème** : sélecteur à trois choix Système / Clair / Sombre, avec une phrase qui décrit le
  choix courant. Défaut : Système.
- **Taille du texte** : les mêmes 7 crans, avec un **aperçu** (premières lignes de « À toi la
  gloire ») à la taille choisie. Phrase : « S’applique à tous les chants. Vous pouvez aussi la
  changer pendant la lecture. »

## 9. Page introuvable

Recueil ou numéro inexistant : la référence demandée en grand (« CE 99 »), titre « Chant
introuvable », explication en une phrase, bouton principal **« Retour à la recherche »**, lien
secondaire vers le recueil quand il existe. La barre de navigation reste visible.

## 10. Composants

| Composant (brief)          | Classe(s) de la maquette                         | Notes |
| -------------------------- | ------------------------------------------------ | ----- |
| Champ de recherche         | `hb-search` (+ `hy-focus` pour l’état focus)     | 52 px, texte 18 px |
| Champ « par le sens »      | `hy-sense`                                       | zone de texte, 3 lignes |
| Sélecteur de type / thème  | `hy-seg`                                         | boutons `aria-pressed` |
| Ligne de résultat          | `hy-result` (`__title`, `__refs`, `__meta`, `__excerpt`) | extrait avec `<mark>` |
| Résultat exact             | `hy-exact`                                       | carte bordée `line-strong` |
| Badge de référence         | `hy-ref`                                         | lien : 44 px de haut minimum |
| Pastilles de filtre        | `hb-chip`                                        | coche + `aria-pressed` |
| Liste de recueils          | `hy-row` + `hy-tile`                             | |
| Liste d’un recueil         | `hb-list`, `hb-item`, `hb-item__link`            | `is-target` pour « Aller au numéro » |
| Vue des paroles            | `hb-hymn`, `hb-header`, `hb-stanza` (`--refrain`, `--bridge`) | `--lyric` pour la taille |
| Réglage de taille          | `hy-stepper`                                     | `<output aria-live>` |
| Bloc des crédits           | `hb-credits`                                     | |
| Navigation                 | `hy-tabbar` / `hy-tab` (mobile), `hy-topnav` (ordinateur) | `aria-current="page"` |
| Précédent / suivant        | `hy-readbar`, `hy-nav-btn`                        | |
| Message « introuvable »    | `hy-message`                                     | ton calme, jamais rouge |
| Boutons                    | `hb-btn`, `--primary`, `--quiet`                 | un seul principal par écran, jamais sur un chant |

## 11. Plateforme (PWA)

- Pas de barre d’onglets système ; marges `env(safe-area-inset-*)` en haut et en bas.
- `theme-color` : `#faf8f4` (clair) et `#141311` (sombre), via deux balises `meta` avec `media`.
- Manifeste : `name` et `short_name` « Hymnia », `background_color` `#faf8f4`.
- **Icône** : H de Literata couleur papier sur fond `#9c3a2b`, petit filet sous la lettre.
  Tailles : 512 (et 512 maskable, zone sûre 80 %), 192, 180 (iOS), 32 (favicon).
- Hors ligne : polices auto-hébergées et mises en cache ; recueils, chants et recherche par
  numéro et paroles toujours disponibles hors ligne (index local). La recherche par le sens est
  locale si possible, sinon en ligne avec l’état hors ligne décrit en §4.2.

## 12. Correspondance maquette ↔ écrans ↔ captures

| Route / état                          | Plan de travail du canevas  | Capture proposée (`design/handoff/`) |
| ------------------------------------- | --------------------------- | ------------------------------------ |
| `/` requête vide                      | `Main`                      | `01-recherche-vide.png` |
| `/` numéro avec recueil (`ce7`)       | `SearchNumber`              | `02-recherche-numero-recueil.png` |
| `/` numéro seul (`12`)                | `SearchNumberOnly`          | `03-recherche-numero-seul.png` |
| `/` numéro introuvable (`CE 9999`)    | `SearchNotFound`            | `04-recherche-numero-introuvable.png` |
| `/` paroles (`a toi la gloir`)        | `SearchText`                | `05-recherche-paroles.png` |
| `/` filtre actif (`fleuve`, HE)       | `SearchFilter`              | `06-recherche-filtre.png` |
| `/` aucun résultat (`pélican`)        | `SearchNoResult`            | `07-recherche-aucun-resultat.png` |
| `/` par le sens                       | `SearchSemantic`            | `08-recherche-par-le-sens.png` |
| `/` par le sens, hors ligne           | `SearchOffline`             | `09-recherche-par-le-sens-hors-ligne.png` |
| `/recueils`                           | `Recueils`                  | `10-recueils.png` |
| `/recueils/ce`                        | `Recueil`                   | `11-recueil-ce.png` |
| `/recueils/ce/1`                      | `Chant`                     | `12-chant.png` |
| `/recueils/ce/1` à 200 %              | `Chant200`                  | `13-chant-200.png` |
| `/recueils/ce/1` sombre               | `ChantDark`                 | `14-chant-sombre.png` |
| `/reglages`                           | `Settings`                  | `15-reglages.png` |
| page introuvable                      | `NotFound`                  | `16-introuvable.png` |
| `/` ordinateur                        | `SearchDesktop`             | `20-recherche-ordinateur.png` |
| `/recueils/ce/1` ordinateur           | `ChantDesktop`              | `21-chant-ordinateur.png` |
| tokens et composants                  | `Components`                | `30-tokens-composants.png` |
| icône et couleur du thème             | `AppIcon`                   | `31-icone.png` |

Les plans « Répertoire », « Liste de lecture », « Accords et audio » et « Versets liés » sont
rangés sous « Répertoire et fonctions à venir (hors brief) » : ils ne font pas partie de la
spec 001. Le Répertoire est néanmoins visible dès T024 (D1).

## 13. Typographie française

- Espace insécable (U+00A0, ou fine U+202F) avant `! ? ; :` et à l’intérieur de `« »`.
- Apostrophe typographique `’` dans les titres et paroles ; la recherche la traite comme `'`.
- « n° » suivi d’une espace insécable ; « 85 % » avec espace insécable.
- Les paroles gardent la ponctuation, les capitales et l’orthographe de la source.

## 14. Écarts avec le brief

1. **Navigation** : Recherche · Recueils · Répertoire, Réglages par une icône (§3).
2. **Recherche par le sens** ajoutée, en type de recherche séparé (§4.2) ; absente du brief.
3. **État « numéro avec recueil »** montré avec `ce7` au lieu de `JEM 245` : l’échantillon ne
   contient pas JEM.
4. **Source** : l’échantillon ne donne que « Domaine public » ; le lien et la date sont prévus
   dans le bloc des crédits mais absents de la maquette.
5. **Pont** : CE 1 n’en a pas ; le style est défini dans la planche des composants avec des
   lignes génériques.
6. **Taille du texte** en 7 crans jusqu’à 200 %, au-delà des 4 crans du design system (§7.4).
7. **Token `mark`** ajouté pour le surlignage des mots trouvés ; seule couleur hors papier, encre
   et rubrique.
8. **Répertoire** (signet sur le chant, onglet) visible alors qu’il est hors spec 001 (D1).
9. **Recherche par le sens** possiblement en ligne, alors que le brief demande que tout
   fonctionne hors ligne (D2).

## 15. Décisions prises

- **D1. Répertoire** : il n’est pas masqué. L’onglet et le signet sont visibles ; tant que la
  fonctionnalité est incomplète, l’écran affiche son état vide (§3).
- **D2. Recherche par le sens hors ligne** : l’objectif est un fonctionnement entièrement hors
  ligne (par exemple des vecteurs calculés à l’avance et embarqués avec les recueils). Si ce
  n’est pas réalisable techniquement, une solution en ligne est acceptée, avec l’état hors
  ligne décrit en §4.2. Le reste de l’application doit toujours fonctionner hors ligne.

## 16. Questions ouvertes

- **Q3. Tolérance aux fautes** de la recherche texte : la maquette fait de la sous-chaîne sans
  accents ; décider d’une distance d’édition (par exemple 1 faute à partir de 5 lettres).
- **Q4. URL des modes de recherche** : proposer `/?q=…` pour « Numéro et paroles » et
  `/?sens=…` pour « Par le sens », afin de pouvoir partager et revenir en arrière.
- **Q5. Refrain variable** : le modèle de données doit permettre un refrain propre à une
  strophe, pour que l’affichage puisse le réimprimer seulement là où il change.
- **Q6. Données HE** : seuls HE 2, HE 7 et HE 12 sont connus dans l’échantillon ; compléter
  avant les captures définitives.
## 17. Mise en œuvre (T024–T062, 2026-11-11)

Ce qui a été fait différemment de la maquette, ou ajouté là où elle ne disait rien :

- **Recherche par le sens** : non construite. Elle ne fait pas partie de la spec 001 ; le
  sélecteur « Numéro et paroles / Par le sens » n’apparaît donc pas. À reprendre dans une
  spec dédiée (avec D2).
- **Répertoire** (D1) : onglet et signet fonctionnels, mais minimaux : la liste des chants
  marqués est gardée sur l’appareil (`localStorage`), sans listes ni partage.
- **Filtres** : une pastille « Tous les recueils » apparaît quand un filtre est actif (effacer
  en un toucher, FR-010).
- **Recherche texte** : les mots ne sont pas tous obligatoires (contrairement au ET de la
  maquette) ; les chants qui les contiennent tous passent devant. Une faute est tolérée à partir
  de 5 lettres (Q3 tranchée ainsi). Les mots d’une lettre (« à ») peuvent être surlignés.
- **Refrain** (Q5) : affiché à sa place dans la source ; un refrain identique au précédent
  n’est pas répété. Un refrain dont les paroles changent est réimprimé.
- **URL** (Q4) : `/?q=…&recueils=…` pour la recherche.
- **Crédits** : la ligne courte sous le titre ne garde que paroles et musique ; la source
  affiche « consultée le … ».
- **Ordinateur** : flèches gauche et droite pour le chant précédent ou suivant ; `/` et Entrée
  sur la recherche.
- **Polices** : Literata et Instrument Sans auto-hébergées (`@fontsource-variable`), latin
  seulement en cache hors ligne.
- **Icônes** : générées par `scripts/make-icons.ts` dans `static/icons/`.
- Les captures PNG de la maquette (§12) n’ont pas été exportées dans `design/handoff/` ; les
  sources `*.dc.html` ont servi de référence.
