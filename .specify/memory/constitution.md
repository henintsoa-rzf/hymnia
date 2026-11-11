<!--
Sync Impact Report
- Version change: (template vierge) → 1.0.0
- Principes définis (création initiale) :
  - I. Recherche avancée au cœur du produit
  - II. Design épuré, centré sur le texte
  - III. Fidélité des textes et respect des droits
  - IV. Modèle multi-recueils unifié
  - V. Simplicité et livraison incrémentale
  - VI. Accessibilité et lecture en situation
- Sections ajoutées : Contenu et sources ; Flux de développement et qualité ; Gouvernance
- Sections supprimées : aucune
- Templates : aucun modifié (les templates lisent la constitution à l'exécution)
- TODO différés : aucun
-->

# Hymnia Constitution

Hymnia est un recueil numérique de chants et d'hymnes chrétiens francophones qui réunit
plusieurs recueils (Ailes de la Foi, JEM, Arc-en-ciel, Célébrons Dieu, À Toi la Gloire,
Exo, Écritures, Chorale Psalmodie, les Getty…) et mise sur un design épuré et une
recherche avancée.

## Core Principles

### I. Recherche avancée au cœur du produit

- Trouver un chant DOIT être l'action la plus rapide de l'application : accessible
  depuis l'écran principal, sans navigation préalable.
- La recherche DOIT couvrir au minimum : recueil + numéro (ex. « JEM 245 »), titre,
  paroles (texte intégral), et filtres par recueil et par thème/étiquette, combinables.
- La recherche DOIT tolérer les accents, la casse, la ponctuation et les fautes de frappe
  courantes (« eternel » trouve « Éternel »).
- La recherche sémantique (par sens ou par thème) est un objectif explicite ; elle DOIT
  compléter la recherche lexicale, jamais la remplacer.
- Les résultats DOIVENT s'afficher en moins de 200 ms sur le corpus complet pour les
  recherches lexicales, sur un appareil mobile courant.

**Pourquoi** : en culte ou en répétition, on cherche un chant sous pression de temps,
souvent à partir d'un numéro ou d'un fragment de paroles mémorisé.

### II. Design épuré, centré sur le texte

- Chaque écran DOIT avoir un but unique et identifiable ; tout élément qui ne sert pas
  ce but est retiré.
- Les paroles sont le contenu principal : typographie lisible, hiérarchie claire
  (strophes, refrain, ponts), aucune publicité ni distraction visuelle.
- Une fonctionnalité nouvelle (accords, audio, extensions) NE DOIT PAS alourdir la
  vue de lecture par défaut ; elle s'active à la demande.
- L'interface DOIT proposer un mode clair et un mode sombre cohérents.

**Pourquoi** : la sobriété est la promesse du produit et sa différence face aux
sites sources, souvent chargés.

### III. Fidélité des textes et respect des droits

- Les paroles DOIVENT être reproduites fidèlement à la source ; toute correction est
  tracée (source, date, nature de la modification).
- Chaque chant DOIT afficher ses crédits connus : auteurs, compositeurs, traducteurs,
  recueil et numéro d'origine, ainsi que la source des données.
- L'import de contenu depuis un site tiers DOIT respecter ses conditions d'utilisation
  et le droit d'auteur ; un contenu dont la licence d'usage est incertaine est marqué
  comme tel et n'est pas publié sans validation.
- Les fichiers audio et les accords suivent les mêmes règles de provenance et de crédits.

**Pourquoi** : il s'agit d'œuvres protégées et de textes liturgiques ; une erreur ou
une attribution manquante nuit à la confiance et peut engager une responsabilité.

### IV. Modèle multi-recueils unifié

- Un chant est une entité unique, identifiée indépendamment de ses apparitions ; il peut
  figurer dans plusieurs recueils avec des numéros différents.
- Le modèle de données DOIT distinguer : chant, recueil, numérotation, version de texte,
  crédits, thèmes/étiquettes, ressources musicales (accords, audio).
- Ajouter un nouveau recueil NE DOIT PAS exiger de modification du code applicatif,
  seulement un import de données conforme au schéma.
- Les données sources et les données utilisateur (favoris, listes, listes de lecture)
  DOIVENT rester séparées.

**Pourquoi** : les mêmes chants circulent entre JEM, Ailes de la Foi, À Toi la Gloire,
etc. ; un modèle unifié évite les doublons et rend la recherche et les filtres fiables.

### V. Simplicité et livraison incrémentale

- Chaque fonctionnalité est livrée en tranche utilisable de bout en bout, dans l'ordre :
  consultation + recherche → listes/favoris/filtres → musique (accords, audio) →
  extensions (rapprochement chants/versets).
- Aucune dépendance, couche d'abstraction ou service externe sans besoin présent et
  démontré (YAGNI) ; toute complexité ajoutée est justifiée dans le plan.
- Les comportements critiques (recherche, import et normalisation des données,
  numérotation) DOIVENT être couverts par des tests automatisés.

**Pourquoi** : le périmètre visé est large ; la livraison par tranches garde un produit
utile à chaque étape et évite l'enlisement.

### VI. Accessibilité et lecture en situation

- L'application DOIT être utilisable sur mobile en priorité, à une main, et rester
  lisible de loin (taille de texte ajustable).
- La consultation des chants déjà chargés DOIT fonctionner hors ligne.
- L'interface DOIT viser la conformité WCAG 2.2 niveau AA (contrastes, navigation
  clavier, lecteurs d'écran).

**Pourquoi** : l'application sert dans des lieux de culte où le réseau est souvent
faible et le public varié.

## Contenu et sources

- Sources de référence identifiées : conducteurdelouange.com (AdF, JEM, Exo, CD, ATG),
  jemaf.fr (JEM, AdF, ATG, audio MP3), psalmodie.ch (Chorale Psalmodie),
  ecrituremusique.com (Écritures).
- Chaque import DOIT être reproductible (script versionné dans `scripts/`), idempotent,
  et conserver l'URL et la date de la source pour chaque chant.
- Les textes sont stockés en Unicode normalisé (NFC) ; la normalisation pour la
  recherche (accents, casse) est dérivée et ne modifie jamais le texte affiché.
- La langue de l'interface et du contenu est le français ; le modèle ne DOIT pas
  empêcher l'ajout ultérieur d'autres langues.

## Flux de développement et qualité

- Toute fonctionnalité suit le flux Spec Kit : spécification → plan → tâches →
  implémentation, avec vérification de conformité à cette constitution à l'étape du plan.
- Toute modification de la recherche DOIT être validée par un jeu de requêtes de
  référence (numéros, fragments de paroles, fautes de frappe, thèmes) dont les résultats
  attendus sont versionnés.
- Toute modification d'interface DOIT être vérifiée sur mobile, en mode clair et sombre.
- Les écarts à un principe sont consignés dans la section « Complexity Tracking » du plan,
  avec la justification et l'alternative plus simple écartée.

## Governance

- Cette constitution prévaut sur toute autre pratique du projet. En cas de conflit,
  la constitution s'applique jusqu'à son amendement.
- Amendement : proposition écrite décrivant le changement et son motif, mise à jour de
  ce fichier via `/speckit-constitution`, et mise à jour du rapport d'impact.
- Versionnage sémantique : MAJEUR pour la suppression ou redéfinition incompatible d'un
  principe ; MINEUR pour l'ajout d'un principe ou d'une section, ou un élargissement
  substantiel ; CORRECTIF pour les clarifications et la forme.
- Conformité : chaque plan (`/speckit-plan`) et chaque revue de code vérifient le respect
  des principes ; toute complexité non justifiée est refusée.

**Version**: 1.0.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-11
