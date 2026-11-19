# Stand de desserts — version 1.1 (retours de la première partie)

Date : 2026-11-19 — complète `2026-11-19-stand-desserts-design.md` (v1, déjà livrée sur `master`). Tout ce qui n'est pas modifié ici reste valable.

## Intention

Après la première vraie partie, le parent veut un jeu où **l'enfant observe et déduit** plutôt que de suivre une liste : le client montre le gâteau fini, à elle d'en tirer la forme, les couleurs et le nombre de chaque topping. Les commandes deviennent plus riches (plusieurs couleurs, plusieurs sortes de toppings) et les clients plus variés et plus vivants. C'est aussi un pas vers la future version éducative (observer, compter).

## Objectifs

1. **Clients variés** : des personnes très différentes et quelques animaux.
2. **Visage animé par parties** : les yeux clignent seuls, la bouche bouge seule.
3. **Commande = image du gâteau fini**, à déduire.
4. **Glaçage de 1 à 3 couleurs**, par zones.
5. **Bandeau du haut = le gâteau commandé en miniature**, l'élément de l'étape en cours mis en valeur.
6. **Toppings de 1 à 3 sortes** par commande, chacune avec son nombre.
7. **Au service, le gâteau est plus ou moins mangé** selon la réussite.

## Non-objectifs

- Pas de son, pas de lecture, pas d'exercices éducatifs (version suivante).
- Pas de changement de la pâte, du moule, de la cuisson (hors affichage), de la boutique, de la sauvegarde ni de l'installation.

## Anti-objectifs

- Une commande impossible à déduire de l'image (toppings qui se chevauchent, zones illisibles, dessert méconnaissable).
- Une aide qui compte à la place de l'enfant (cf. version éducative).
- Une commande qui utilise un élément non possédé.

## Décisions

### Commande (logique)

- Nouvelle forme : `{ dessert, shape, glaze: string[], toppings: Array<{ key, count }> }`.
  - `glaze` : 1 à 3 couleurs **distinctes**, dans l'ordre des zones de gauche à droite.
  - `toppings` : 1 à 3 sortes **distinctes**, chaque `count` ≥ 1, **total ≤ 6**.
- Tirage (proposition de l'auteur) : nombre de zones 1 / 2 / 3 avec probabilités 50 / 35 / 15 % ; nombre de sortes de toppings 1 / 2 / 3 avec 50 / 35 / 15 % ; chaque `count` tiré entre 1 et 4, tirage recommencé tant que le total dépasse 6. Toujours parmi les éléments possédés (le jeu de départ en a assez : 4 couleurs, 4 toppings).
- Rien de la commande n'est sauvegardé (seuls pièces et achats le sont) : aucune migration de sauvegarde.

### Zones de glaçage

- 1 couleur = tout le dessus ; 2 = **moitié gauche / moitié droite** ; 3 = **trois bandes verticales** de même largeur, calculées sur la largeur de la silhouette du moule (marche pour toutes les formes).
- Pendant le glaçage, de **fines lignes en pointillé** montrent les limites des zones sur le gâteau.
- Notation : chaque zone doit être couverte à **85 %** par sa couleur. Point « couleur » gagné seulement si **toutes** les zones sont justes. Raisons d'échec : `mauvaise-couleur` (une zone est surtout d'une autre couleur) ou `pas-couvert`.
- La barre de remplissage suit la **couverture globale** du dessus (toutes couleurs confondues), pour ne rien révéler sur les couleurs (décision de l'auteur).
- La couverture d'une zone se mesure sur **sa propre surface** (silhouette ∩ bande). Les pointillés sont un **repère, pas une barrière** : la peinture traverse les limites, et déborder d'une mauvaise couleur peut faire rater la zone voisine.
- Plusieurs pots par étape : elle choisit un pot, peint, en choisit un autre ; chaque cellule garde la dernière couleur posée (déjà le cas en v1).

### Toppings

- Notation : pour chaque sorte demandée, le nombre posé doit être **exact**, et aucune sorte non demandée ne doit être posée. Raisons : `mauvais-topping`, `pas-assez`, `trop` (avec la sorte concernée pour l'image du service).
- Placement libre ; la limite de 12 toppings posés est conservée.
- Dans l'image de commande et le bandeau, les toppings sont disposés **à peu près symétriquement** (paires en miroir de part et d'autre de l'axe vertical du gâteau, les mêmes sortes en miroir ; un topping impair sur l'axe), pour un visuel plus joli. (Demande du parent.)
- L'étincelle de la v1 (« le compte est juste ») ne se déclenche que quand **toutes** les sortes sont exactes.

### Image de commande (écran du stand)

- Le client arrive et montre **une seule grande bulle** avec le gâteau fini **en 3/4** : cuit doré, flanc du dessert, zones de glaçage, toppings **bien espacés et entiers** (comptables). Plus de bulles successives ni de points de progression.
- ✓ (ou toucher la bulle) lance la préparation.

### Flanc par dessert

- Le flanc en 3/4 doit montrer le dessert : **génoise et crème** pour le gâteau, **pâte dorée** pour la tarte, **caissette plissée** pour le cupcake — pour chaque forme de moule. (La manière de le produire — 15 dessins ou un motif par dessert découpé par la silhouette du flanc — est laissée à l'illustrateur.)
- Visible partout où le gâteau est en 3/4 hors du moule : image de commande, gâteau démoulé au four, service, bandeau. (Dans le moule, seul le dessus se voit, comme en v1.)
- Décision de l'auteur pour le rendu : **un motif de flanc par dessert** (`side-pattern-<dessert>`), découpé par la silhouette du flanc de chaque forme et ombré par le flanc existant — 3 nouveaux motifs plutôt que 15 dessins, et chaque nouveau moule acheté fonctionne avec les 3 desserts.

### Bandeau du haut (rappel de commande)

- Remplace la bande d'icônes : **le gâteau commandé en miniature** (3/4), avec l'élément de l'étape en cours **mis en valeur** (lueur pulsée ou léger rebond) :
  - pâte → le flanc ; moule → le contour ; cuisson → tout le gâteau (sa couleur dorée) ; glaçage → les zones ; toppings → les toppings.
- La chaleur à viser (flammes) est affichée **près du four**, plus dans le bandeau : comme la recette dans l'écran de la pâte, c'est une consigne, pas une devinette — l'enjeu de la cuisson reste de sortir le gâteau au bon moment.

### Service : le gâteau plus ou moins mangé

- Le client mange une part du gâteau **proportionnelle à la réussite**, en bouchées successives (chaque bouchée retire un morceau du gâteau en 3/4, avec des miettes) :
  - **5/5** : il mange **tout** — il ne reste que l'assiette et quelques miettes ;
  - **4/5** : 3 bouchées (il en laisse un petit bout) ;
  - **3/5** : 2 bouchées ;
  - **1–2/5** : 1 petite bouchée ;
  - **0/5** : il goûte du bout des lèvres et repousse l'assiette.
  (Barème proposé par l'auteur.)
- Les bouchées ont lieu avant la révélation des ✅/❌ ; les toppings disparaissent avec les morceaux mangés. L'expression du client suit (contente / bof / fâchée).

### Clients

- **Humains assemblés au hasard** : 6 coiffures (dont chauve, queue de cheval, chignon), couleur de cheveux (brun, noir, blond, roux, gris), 4 couleurs de peau, couleur du t-shirt, et parfois un accessoire (lunettes, casquette, nœud, barbe, moustache, boucles d'oreilles). Les âges se lisent aux combinaisons (cheveux gris + lunettes, barbe…).
- **Animaux** : chat, ours, lapin, chien — tête propre (oreilles, museau), mêmes yeux et bouches que les humains. **Environ 1 client sur 5.**
- **Jamais deux fois de suite le même client** (même combinaison).
- **Visage en pièces** : yeux (ouverts, fermés) et bouche (contente, bof, fâchée) séparés. Les yeux clignent seuls toutes les 2–5 s ; la bouche change au service et peut s'animer quand le client montre sa commande.
- Style S2, comme la cliente actuelle (qui devient une combinaison parmi d'autres).

### Dessins

- Les dessins font partie du travail (même illustrateur que la v1), avec les deux validations par le parent ; le code peut avancer en parallèle avec les dessins existants comme remplaçants.
- Contrat (décision de l'auteur) : on garde le schéma v1 — calques 300×300 empilés au même point ; peau, cheveux et t-shirt **teintés par le code** (dessinés clairs) ; accessoires, yeux, bouches et têtes d'animaux en calques séparés dans le même cadre.

- Même processus que la v1 : **pièces témoins** (2 humains, 1 animal, le clignement, 1 flanc par dessert), validation par le parent, puis **planche complète**, validation, puis intégration.

## Approches

- **Retenue : faire évoluer le jeu existant** (logique testée, moteur, écrans, dessins conservés ; seules les parties concernées changent).
- Écartées : tout refaire (jette du travail validé) ; un « mode » séparé (duplique les écrans).

## Laissé au constructeur

- Disposition des toppings dans l'image de commande (espacés, dans la silhouette, sans chevauchement).
- Forme exacte de la mise en valeur dans le bandeau.
- Mise à jour des tests existants (nouvelle forme de commande) et du script de partie automatique.
- Incrémenter `CACHE_VERSION`.
