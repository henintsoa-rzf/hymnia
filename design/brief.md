# Brief de design — Hymnia

À coller ou joindre dans Claude Design. Rédigé à partir de
`specs/001-hymnal-browse-search/` (spec, contrats) et de `.specify/memory/constitution.md`.

## 1. Le produit

Hymnia est un recueil numérique de chants et d’hymnes chrétiens francophones. Il réunit
plusieurs recueils (J’aime l’Éternel, Ailes de la Foi, À Toi la Gloire, Célébrons Dieu, Exo,
Écritures, Chorale Psalmodie…) dans une seule application.

**La promesse : trouver un chant en quelques secondes et le lire sans distraction.**

On l’utilise surtout pendant le culte ou la répétition. Le responsable annonce « JEM 245 », ou
quelqu’un se souvient d’un bout de phrase. La personne cherche sous pression de temps, souvent
debout, téléphone dans une main, parfois dans une salle peu éclairée ou au réseau faible.

## 2. Principes à respecter (constitution du projet)

- **Design épuré, centré sur le texte.** Chaque écran a un seul but. Les paroles sont le contenu
  principal : typographie très lisible, hiérarchie claire (strophes, refrain), aucune publicité
  ni décoration qui distrait.
- **La recherche d’abord.** Le champ de recherche est sur l’écran d’accueil, prêt à taper, sans
  navigation préalable.
- **Lisible en situation.** Mobile d’abord, utilisable à une main, texte agrandissable (de 85 %
  à 200 %), lisible de loin. Fonctionne hors ligne.
- **Accessible.** Contrastes WCAG 2.2 niveau AA en mode clair et sombre, cibles tactiles d’au
  moins 44 × 44 px, navigation au clavier, compatible lecteur d’écran.
- **Respect des auteurs.** Chaque chant affiche ses crédits (paroles, musique, traduction) et sa
  source. Ils sont discrets mais toujours présents.
- **Sobre et intemporel.** Pas d’effet de mode. L’application doit convenir à des églises de
  sensibilités diverses et à tous les âges.

## 3. Contraintes

| Sujet           | Contrainte                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Largeurs        | Mobile d’abord : 360 à 430 px. Doit aussi fonctionner sur tablette (768 px) et ordinateur (≥ 1280 px).                                                |
| Thèmes          | Mode clair et mode sombre, tous deux soignés. Par défaut : suit le système.                                                                           |
| Taille du texte | Réglable de 85 % à 200 %. La mise en page des paroles doit rester belle à 200 %.                                                                      |
| Langue          | Interface entièrement en français.                                                                                                                    |
| Plateforme      | Application web installable (PWA) : pas de barre d’onglets système, prévoir la zone sûre des iPhone.                                                  |
| Polices         | Gratuites et utilisables sur le web (par exemple Google Fonts), avec un bon rendu des accents et de la ponctuation française (« », ’, espaces fines). |

## 4. Écrans et états à dessiner

Les adresses (URL) sont fixées et les écrans doivent y correspondre.

### 4.1 Recherche — `/` (écran d’accueil)

Un seul but : trouver un chant. Les résultats s’affichent pendant la frappe, sans bouton
« Rechercher ».

États à dessiner :

1. **Requête vide.** Champ de recherche en évidence (curseur dedans), avec un texte d’aide
   comme « Numéro, titre ou paroles ». En dessous, la liste des recueils (nom et nombre de
   chants).
2. **Recherche par numéro** : on tape `JEM 245` ou `jem245`. Le chant exact arrive en premier, très
   visible.
3. **Numéro seul** : on tape `12`. Tous les chants numérotés 12 apparaissent, chacun avec son
   recueil.
4. **Numéro introuvable** : `CE 9999`. Message clair et calme : « Aucun chant n°9999 dans
   Cantiques d’exemple ». Pas une erreur rouge.
5. **Recherche dans les paroles** : on tape `a toi la gloir`, sans accents et avec une faute.
   Chaque résultat affiche le titre, le recueil et le numéro, et un extrait des paroles avec
   les mots trouvés surlignés.
6. **Filtre par recueil actif** : un ou plusieurs recueils sélectionnés sous forme de pastilles
   (« chips »). Le filtre actif est toujours visible et s’efface en un geste.
7. **Aucun résultat** pour une recherche texte.

### 4.2 Recueils — `/recueils`

La liste de tous les recueils, avec le nom complet, l’abréviation et le nombre de chants.

### 4.3 Un recueil — `/recueils/ce`

- Les chants du recueil dans l’ordre des numéros (numéro et titre). Il peut y en avoir
  plusieurs centaines.
- Un champ « Aller au numéro » qui fait défiler directement jusqu’au numéro.
- Certains numéros ont un suffixe (« 12a », « 3 bis »).

### 4.4 Un chant — `/recueils/ce/1` (l’écran le plus important)

- Titre et référence (abréviation du recueil et numéro, par exemple « CE 1 »).
- Paroles :
  - les strophes sont numérotées ;
  - le **refrain** est clairement distinct (retrait, style ou libellé « Refrain ») ;
  - il peut y avoir un **pont** ;
  - les lignes sont affichées exactement comme dans la source.
- Réglage de la taille du texte, accessible sans quitter l’écran.
- Crédits : paroles, musique, traduction. Puis la source : nom, lien et date.
- « Aussi dans » : les autres recueils où figure le même chant, par exemple « HE 7 ». Chacun est
  un lien.
- Chant précédent et chant suivant du même recueil : boutons et balayage horizontal.
- À dessiner aussi : le même chant avec le texte à 200 %, et en mode sombre.

### 4.5 Réglages — `/reglages`

- Thème : Système, Clair, Sombre.
- Taille du texte, avec un aperçu.

### 4.6 Page introuvable

Un recueil ou un numéro qui n’existe pas : message simple et lien « Retour à la recherche ».

### 4.7 Navigation générale

Trois destinations : **Recherche**, **Recueils** et **Réglages**. À vous de proposer la forme
la plus discrète et la plus pratique à une main, par exemple une barre en bas sur mobile et en
haut ou sur le côté sur ordinateur.

## 5. Contenu réel à utiliser dans les maquettes

Les recueils de l’échantillon sont fictifs. Les textes viennent de chants du domaine public.

**Recueils :**

| Abréviation | Nom                 | Chants |
| ----------- | ------------------- | ------ |
| CE          | Cantiques d’exemple | 10     |
| HE          | Hymnes d’exemple    | 7      |

Pour montrer de vrais noms, on peut aussi utiliser dans les maquettes « JEM — J’aime
l’Éternel » ou « AdF — Ailes de la Foi ».

**Liste du recueil CE :** 1 À toi la gloire · 2 C’est un rempart que notre Dieu · 3 Torrents
d’amour et de grâce · 5 Plus près de toi, mon Dieu · 7 Quel ami fidèle et tendre · 8 Tel que je
suis · 12 Debout, sainte cohorte · 12a Que Dieu se montre seulement · 20 Il est né le divin
Enfant · 23 Minuit, chrétiens

**Chant complet pour l’écran « Un chant » : CE 1 — À toi la gloire** (aussi dans HE 7)

> **1.** À toi la gloire, / Ô Ressuscité ! / À toi la victoire / Pour l’éternité ! /
> Brillant de lumière, / L’ange est descendu, / Il roule la pierre / Du tombeau vaincu.
>
> **Refrain :** À toi la gloire, / Ô Ressuscité ! / À toi la victoire / Pour l’éternité !
>
> **2.** Vois-le paraître : / C’est lui, c’est Jésus, / Ton Sauveur, ton Maître ! / Oh ! ne doute
> plus ! / Sois dans l’allégresse, / Peuple du Seigneur, / Et redis sans cesse / Que Christ est
> vainqueur !
>
> **3.** Craindrais-je encore ? / Il vit à jamais, / Celui que j’adore, / Le Prince de paix ; /
> Il est ma victoire, / Mon puissant soutien, / Ma vie et ma gloire : / Non, je ne crains rien !
>
> Paroles : Edmond Budry · Musique : Georg Friedrich Haendel
> Source : Domaine public

(Chaque « / » marque un retour à la ligne.)

**Exemple de résultats pour la recherche `12`** :
CE 12 Debout, sainte cohorte · HE 12 Les anges dans nos campagnes

**Exemple de résultat de recherche dans les paroles, pour `fleuve`** :

- _Torrents d’amour et de grâce_ — CE 3 — « À ce grand **fleuve** qui passe »
- _Plus près de toi, mon Dieu_ — CE 5 · HE 2 — « Déborde comme un **fleuve** »

## 6. Ce que j’attends de Claude Design

1. **Tokens de design**, pour le clair et le sombre :
   - couleurs : fond, surface, texte, texte secondaire, accent, surlignage de recherche,
     bordures, focus ;
   - typographie : polices, échelle des tailles, interlignes (en particulier pour les
     paroles) ;
   - espacements, rayons, ombres s’il y en a.
2. **Composants** :
   - champ de recherche ;
   - ligne de résultat (numéro, texte, extrait) ;
   - badge de référence (« CE 12 ») ;
   - pastilles de filtre ;
   - liste de recueils ;
   - vue des paroles (strophe, refrain, pont) ;
   - réglage de la taille du texte ;
   - bloc des crédits ;
   - navigation ;
   - boutons précédent/suivant ;
   - message « introuvable ».
3. **Une maquette par écran et par état** de la section 4, au format mobile, et au moins
   l’écran « Un chant » et l’écran « Recherche » au format ordinateur.
4. Une **icône d’application** simple pour l’écran d’accueil du téléphone, et la couleur du
   thème.

## 7. Après le design (pour le développement)

Enregistrer l’export ou le paquet de passation de Claude Design dans `design/handoff/`, avec
une capture de chaque écran et état. Noter les choix importants, et tout écart avec ce brief,
dans `design/decisions.md`. Le développement des écrans reprend ensuite à la tâche T024.
