# Pêche et cuisine — design

Date : 2026-11-26. Troisième jeu de la collection Ludeo, après le stand de desserts et le village des singes (spécifié). S'appuie sur la collection livrée (accueil, réglages communs, thèmes et niveaux communs, propositions par phase validées par le parent — voir `2026-11-19-educatif-design.md`).

## Intention

Un jeu en phases, comme le stand : elle **pêche** des poissons de couleurs et de tailles différentes, les **pèse** (une étiquette avec le poids se colle sur chacun), puis en **cuisine** elle répond à des commandes du type « 6 assiettes de poisson bleu » en choisissant parmi ses poissons ceux dont les poids font le total (5 + 1), les **découpe** en autant de portions que leur poids et **dresse** les assiettes.

Le cœur pédagogique est la **décomposition d'un nombre** (faire 6 avec 5 et 1). Chaque phase est un exercice d'un thème commun, sur 3 niveaux. Un **stock** gardé d'une partie à l'autre relie la pêche à la cuisine, et une **boutique** fait progresser le jeu (plus de place, plus de couleurs, d'autres cannes).

## Objectifs

1. Un nouveau jeu ajouté au menu de la collection, catégorie `compter-observer`, avec 5 phases ayant chacune un thème commun et **3 niveaux**.
2. Un **stock persistant** de poissons pesés, rempli par la pêche et vidé par la cuisine, qui garantit que **chaque commande est faisable** exactement.
3. Une apparition des poissons dans l'étang **guidée par l'état du stock**, avec du hasard.
4. Des pièces et une **boutique** propre au jeu : glacière (capacité + couleurs), étang, cannes (geste de pêche), garnitures.
5. Les réglages communs (rythme, mode soir), les niveaux par thème/phase et les propositions d'ajustement s'appliquent comme au stand.

## Non-objectifs

- Pas de son ni de voix (comme le reste de la collection pour l'instant ; les écrans doivent s'y prêter).
- Pas de code mis en commun avec le stand (voir Approches) ; pas de modification du stand.
- Pas de nouveau thème commun.

## Anti-objectifs

- Une aide qui compte ou additionne à sa place (ex. afficher la somme des poissons sélectionnés pendant le choix en cuisine).
- Une commande impossible avec ce qu'elle a dans son stock.
- Un niveau qui change sans validation du parent. Les achats de boutique ajoutent de la **variété** (plus de couleurs, autres gestes), jamais de difficulté « scolaire » : les nombres et totaux restent fixés par le niveau.
- Un échec vécu comme une punition : pas de « game over », pas de pièces retirées, pas de poissons perdus par erreur de l'enfant.
- Une consigne compréhensible seulement par le texte.
- Casser un autre jeu en modifiant celui-ci.

## Contraintes

- Identiques à la collection : tablette Android (Samsung, Chrome, paysage), PWA hors ligne sur GitHub Pages, Phaser local (`vendor/phaser.min.js`), aucune dépendance ajoutée, aucun texte nécessaire hors du thème « lecture », zones tactiles ≥ 96 px, ≤ 60 particules, aucune donnée qui sort de la tablette.
- Style graphique de la collection : SVG en couches dessiné à la main dans l'esprit S2 (couleurs vives, dégradés doux), **pas de style « kawaii »**. Chaque image dans son fichier, noms stables, licences notées (`ASSETS-LICENSES.md`).
- Le jeu s'intègre comme le prévoit `jeux/registry.js` : `jeux/peche-cuisine/collection.js` (ID, NAME, CATEGORY, TILE, SUPPORTS, PHASES, PRECACHE, reset), importé dans le registre ; `tests/registry.test.js` le vérifie.
- Rythme (`rythme`) et mode soir (`soir`) appliqués (`SUPPORTS = ['rythme', 'soir']`), lus via `shared/runtime.js`.

## Approches

- **Retenue : un jeu indépendant sur le modèle du stand.** Nouveau dossier `jeux/peche-cuisine/` avec sa propre logique pure (`src/logic/`, testée), ses scènes Phaser, sa boutique, ses pièces et sa sauvegarde. On s'inspire du stand (scène boutique, caisse, bulle de commande) en recopiant/adaptant, sans l'importer. Choix de la personne à l'origine du projet : « je veux pouvoir modifier chaque élément sans me soucier de casser un autre jeu ».
- Écartée : mettre d'abord en commun dans `shared/` la boutique, les pièces et la bulle de commande du stand. Moins de code en double, mais on retouche un jeu terminé et testé, et ce qui est « commun » se devine mal à partir d'un seul jeu (la boutique ici n'a rien à voir avec celle du stand). À reconsidérer quand il y aura trois jeux.

Ce que le jeu peut utiliser de `shared/` : uniquement les modules déjà prévus pour tous les jeux (runtime/réglages, niveaux et historique de phase, clients de la collection, rythme, soir). Il ne les modifie pas ; un besoin nouveau se règle dans le jeu.

## Décisions

### Déroulé d'une partie

Une partie = **pêche** (4 poissons) → **pesée** (ces poissons) → **2 commandes**, chacune : **cuisine** → **découpe** → **dressage** → paiement. Puis écran de fin de partie (pièces, accès boutique, rejouer). *(Nombre de commandes : proposition de l'auteur.)*

Les niveaux sont lus au début de la partie pour toutes les phases et gardés jusqu'à la fin (comme le stand, où ils sont lus par client).

### Poissons, tailles et poids

- Un poisson a une **couleur**, une **taille** (petit, moyen, grand) et un **poids entier**. **Les fourchettes de poids suivent le niveau de la phase Cuisine** (décidé) :
  - Cuisine N1 : poids **1 à 5** — petit 1, moyen 2–3, grand 4–5 (la pesée N1 compte donc au plus 5 points, en constellations) ;
  - Cuisine N2–N3 : poids **1 à 10** — petit 1–3, moyen 4–6, grand 7–10.
  Le dessin grandit un peu avec le poids à l'intérieur d'une catégorie, mais sans permettre de lire le poids à l'œil.
- Les poissons déjà en stock gardent leur poids. Si le parent baisse le niveau, ceux qui dépassent la nouvelle plage restent dans la glacière, ne servent à aucune commande, et elle peut les relâcher.
- Avant la pesée, elle ne connaît que la couleur et la catégorie ; **la pesée révèle le poids exact**. C'est pourquoi la pêche demande des catégories et non des poids.
- **Un poisson de poids n donne n portions** (n assiettes).

### Stock (glacière)

- Le stock contient des poissons **pesés** (couleur + poids). Il est **gardé d'une partie à l'autre** (sauvegarde locale).
- **Stock de départ** offert à la première partie : un petit stock dans les 2 couleurs de départ, avec au moins un petit poisson par couleur *(contenu exact : laissé au constructeur, ex. 4 poissons)*.
- **Capacité** de départ limitée (*ex. 8 places, proposition de l'auteur*), agrandie en boutique.
- Si le stock est **plein**, un poisson attrapé est **remis à l'eau** (petite animation joyeuse, pas une erreur).
- Une commande retire du stock exactement les poissons utilisés.
- **Relâcher** (décidé) : depuis la glacière (écran de cuisine ou de fin de partie), elle peut à tout moment **relâcher un poisson** (glisser vers l'eau, petite animation). Ce n'est jamais une erreur et ne rapporte rien. C'est ce qui évite une glacière bloquée par des poissons inutilisables.

### Couleurs

- **2 couleurs au départ** (bleu, rouge — proposition de l'auteur), le minimum pour que les commandes et la liste de pêche aient du sens.
- **Chaque agrandissement de la glacière débloque une couleur** de plus, jusqu'à 5–6 couleurs. Plus de couleurs = plus de variété (décision : variété, pas niveau).

### Apparition des poissons et liste de pêche

- La **liste de pêche** (4 poissons à attraper) est tirée **d'après l'état du stock** : elle favorise ce qui manque pour couvrir les commandes (couleurs peu présentes, absence de petit poisson dans une couleur), avec une part de hasard. Elle contient **au moins un petit** et, pour chaque couleur demandée, de quoi faire des combinaisons (au moins deux poissons d'une même couleur dans la liste ou dans liste + stock).
- L'**étang** montre des poissons de la liste et d'autres (intrus). La probabilité d'apparition d'un poisson dépend de l'état du stock et de la liste, **sans être déterministe**.
- Le poids exact d'un poisson attrapé est tiré au hasard dans sa catégorie, avec un biais vers ce qui rend des totaux faisables (formule laissée au constructeur ; voir « Laissé au constructeur »).

### Commandes faisables

- Une commande = une **couleur** + un **nombre d'assiettes** N.
- Elle est tirée parmi les totaux **réalisables exactement** avec les poissons de cette couleur dans le stock (somme d'un sous-ensemble), dans la plage du niveau de la phase Cuisine et avec le nombre de poissons du niveau.
- Le client montre la commande en image : poisson de la couleur + N assiettes. Au N1 en constellation, aux N2–N3 en chiffre (+ assiettes dessinées en N2).
- Une commande **ne sort jamais de la plage de son niveau**. Si une couleur n'a pas de total réalisable avec le nombre de poissons du niveau, la commande se rabat sur moins de poissons (un seul poisson dont le poids est dans la plage), puis sur une autre couleur. Le stock de départ, « au moins un petit » par liste et les poids par niveau garantissent qu'il existe toujours au moins une commande dans la plage ; les tests sur parties simulées le vérifient (y compris après une baisse de niveau). La liste de pêche suivante favorise ce qui manque.

### Clients

Les commandes sont passées par les **clients de la collection** (`shared/client.js`, les mêmes que ceux du stand), au comptoir de la cuisine.

### Les 5 phases

| Phase (id) | Thème | N1 | N2 | N3 |
|---|---|---|---|---|
| Pêche (`peche`) | `logique` | liste en images (poissons dessinés à la bonne couleur et taille) | nombre en chiffre + pastille de couleur + catégorie en picto | idem N2, plus long ou avec comparaisons (« plus petit que… ») *(laissé au constructeur dans l'esprit « comparaisons »)* |
| Pesée (`pesee`) | `nombres` | elle pose le poisson ; la balance compte (points qui s'allument un à un) ; l'étiquette se colle toute seule | la balance affiche le nombre ; elle choisit la bonne étiquette parmi 2–3 et la colle | balance à deux plateaux : elle pose des poids de 1, 2 et 5 jusqu'à l'équilibre ; l'étiquette porte le total de ses poids |
| Cuisine (`cuisine`) | `nombres` | total ≤ 5 ; un seul poisson ou deux petits ; étiquettes en chiffre + constellation | 2 poissons, total ≤ 10 | 2 ou 3 poissons, total ≤ 12 ; compléments (« j'ai un 5, il me manque 7 ») |
| Découpe (`decoupe`) | `couleurs-fractions` | traits de coupe en pointillés, elle les suit | elle place elle-même ses n−1 coupes ; le jeu vérifie qu'il y a n morceaux | les morceaux doivent être à peu près égaux |
| Dressage (`dressage`) | `logique` | une portion par assiette | une portion + une garniture par assiette, selon un motif AB (citron, salade, citron…) | motif plus long (AAB, ABC) ou modèle d'assiettes à reproduire |

**Pêche — gestes.** Le geste dépend de la **canne** utilisée :
- *Canne en bambou* (départ) : toucher un poisson, il mord après un instant, toucher à nouveau pour ferrer.
- *Canne à moulinet* (boutique) : glisser pour lancer, faire tourner le moulinet du doigt pour remonter.
- *Épuisette* (boutique) : entourer le poisson d'un geste du doigt.
Aucun geste ne doit demander de précision fine ni de rapidité excessive (rythme calme = plus lent).
Attraper un poisson **hors de la liste** : il est montré à côté de la liste (« pas demandé ») et remis à l'eau ; c'est l'erreur qui compte pour le point de la pêche. La pêche se termine quand la liste est complète.

**Pesée.** Les poissons pêchés passent un par un sur la balance. Au N2, une mauvaise étiquette est corrigée à ✓ (la balance montre le bon nombre, l'étiquette se remplace) ; au N3, elle appuie sur ✓ quand elle pense la balance équilibrée ; si ce n'est pas le cas, c'est raté, la balance montre les bons poids et l'étiquette juste se colle. **Réussi** (N2–N3) = les étiquettes de tous les poissons justes au premier ✓. Après la pesée, les poissons entrent dans le stock (ou retournent à l'eau si plein).

**Cuisine.** Elle voit **tout son stock** avec les étiquettes, rangé par couleur. Elle touche/glisse des poissons sur le plan de travail, puis ✓. **Aucun total affiché pendant le choix.** Si le total est faux : le point est raté, le jeu montre une combinaison juste (en image), et la suite se fait avec cette combinaison juste (seuls les poissons de la combinaison juste quittent le stock).

**Découpe.** Un poisson à la fois, un poisson de poids n en n portions (au plus 12 assiettes par commande grâce au plafond du N3) ; un poisson de 1 n'a pas de coupe (il passe directement).

**Dressage.** Autant d'assiettes que la commande ; les portions issues de la découpe sont posées une par assiette, puis garnies selon le motif du niveau. Les garnitures disponibles sont celles achetées (les motifs n'utilisent que celles-là ; 2 garnitures au départ pour pouvoir faire un AB).

### Règles des erreurs

Comme au stand : chaque phase a ↺ (recommencer l'étape) jusqu'à ✓ ; après ✓, pas de retour. Ce qui est raté reste raté et coûte une pièce, mais on ne bloque jamais : le jeu montre **ce qu'il fallait** et continue. Les pièces gagnées ne sont jamais retirées.

### Pièces et résultats

*(Proposition de l'auteur.)*
- **Pêche et pesée** : notées une fois par partie, à la fin de la pesée (récap : 1 pièce par phase réussie).
- **Chaque commande** : 3 points (cuisine, découpe, dressage), 1 pièce par point, client 😊 / 😐 / 😖.
- **Réussi / raté** d'une phase pour les propositions d'ajustement : réussi si son point est gagné. Pesée N1 (étiquette automatique) n'a pas de résultat (comme une phase `scored: false` au niveau 1) ; le constructeur choisit comment le déclarer dans `PHASES` sans modifier `shared/`.
- Une partie abandonnée (retour à l'accueil) ne compte pas ; ce qui a déjà été mis dans le stock y reste.

### Boutique

- Achats, prix en pièces dessinées (sans texte), prix bas au début :
  - **Glacière** : +capacité et **+1 couleur de poisson** par agrandissement.
  - **Étang** : plus grand, plus de poissons nagent à la fois.
  - **Cannes** : moulinet, épuisette (change le geste de pêche ; elle choisit sa canne avant de pêcher).
  - **Garnitures** : nouvelles garnitures pour le dressage (tomate, persil, olive…).
- Ce qui est acheté sert aussitôt : les commandes, listes et motifs n'utilisent que ce qu'elle possède.

### Sauvegarde et parent

- Sauvegarde locale du jeu (pièces, achats, stock), dans sa propre clé de stockage.
- `reset` (espace parent « remettre ce jeu à zéro ») efface pièces, achats et stock ; le stock de départ revient.

### Nom et menu

- Nom affiché au parent : **« Pêche et cuisine »**, id `peche-cuisine`, catégorie `compter-observer` *(proposition de l'auteur)*. Tuile : un poisson.

## Laissé au constructeur

- Formules exactes d'apparition et de tirage des poids, du moment qu'elles respectent : commandes toujours faisables, au moins un petit dans chaque liste, biais vers ce qui manque, part de hasard réelle. Logique pure, testée (y compris sur de nombreuses parties simulées : jamais de commande impossible).
- Contenu exact du stock de départ, capacités et prix de la boutique, nombre de couleurs maximum.
- Découpage en lots, fichiers, scènes ; dessins nécessaires (étang, bateau/ponton, poissons par couleur et taille, balance simple et à plateaux, poids, étiquettes, glacière, plan de travail, couteau, assiettes, garnitures, cannes) avec validation du parent comme d'habitude.
- Animations d'arrivée des poissons, de la balance, de la découpe ; mise à l'échelle.
- Ajout au precache et version du cache (`sw.js`).
