# Ludeo — dimension éducative : thèmes communs, niveaux, et le stand de desserts

Date : 2026-11-19. S'appuie sur la collection livrée (accueil, réglages communs, recommandations validées par le parent) et sur le stand de desserts v1.1.

## Intention

Faire de chaque phase de jeu un **exercice** adapté à l'enfant (6 ans aujourd'hui), sans perdre le plaisir du jeu. Les **thèmes d'apprentissage sont communs à toute la collection** (un futur jeu de lecture utilisera le même thème « lecture » et les mêmes niveaux), et la **difficulté se règle facilement**, **phase par phase**. Quand une phase est trop dure (ou trop facile), l'application **le remarque et propose** d'ajuster **cette phase seulement** ; comme tous les réglages, le parent valide.

## Objectifs

1. Un **catalogue de thèmes commun** à la collection, chacun avec **3 niveaux** au sens partagé (1 ≈ grande section, 2 ≈ CP, 3 ≈ CE1).
2. Chaque **phase** d'un jeu déclare son thème ; son niveau vient du réglage du thème, éventuellement **surchargé pour cette phase**.
3. Une **proposition d'ajustement automatique par phase**, fondée sur les réussites/échecs récents, présentée comme recommandation au parent.
4. Les 7 phases du stand de desserts réécrites en 3 niveaux chacune (ci-dessous).
5. L'erreur fait apprendre : au service, chaque point raté montre **ce qu'il fallait**.

## Non-objectifs

- Pas de son ni de voix (prévu plus tard ; les écrans doivent s'y prêter).
- Pas de suivi pédagogique détaillé pour le parent (statistiques, historiques) au-delà de ce qu'il faut pour les propositions.
- Pas de nouveau jeu.

## Anti-objectifs

- Une aide qui compte ou lit à la place de l'enfant.
- Un niveau qui change sans validation du parent.
- Un échec vécu comme une punition (pas de « game over », pas de perte de pièces déjà gagnées).
- Un exercice dont la consigne **n'est compréhensible que par le texte** : hors de la phase de lecture, tout texte est un **complément** d'une image, d'un nombre ou d'un pictogramme, jamais la seule source d'information.

## Contraintes

- Inchangées : tablette Android, PWA hors ligne sur GitHub Pages, pas de dépendance, style S2, ≥ 96 px, ≤ 60 particules, pas de texte nécessaire au-delà de ce que le thème « lecture » prévoit, réglages communs appliqués à chaque jeu.

## Approches

- **Retenue : thèmes et niveaux dans la couche commune** (`shared/`), lus par chaque jeu comme le rythme et le mode soir ; chaque phase déclare son thème dans le registre du jeu ; la logique d'exercice reste propre à chaque jeu.
- Écartée : niveaux propres à chaque jeu — pas de cohérence entre jeux, et le parent devrait tout régler jeu par jeu.
- Écartée : ajustement automatique silencieux — contraire à « rien ne change sans le parent ».

## Décisions

### Thèmes communs (catalogue de la collection)

| Thème | Niveau 1 | Niveau 2 | Niveau 3 |
|---|---|---|---|
| `lecture` | mots associés à l'image | mots seuls, chiffres | phrases, nombres en lettres |
| `nombres` | dénombrer ≤ 5 (constellations) | chiffres et additions ≤ 10 | compléments et doubles ≤ 20 |
| `geometrie` | reconnaître une forme | propriétés (côtés, coins) | assembler / orienter |
| `temps` | minuterie à secteur | lire un nombre sur un cadran | horloge, heures et demi-heures |
| `couleurs-fractions` | couleurs prêtes, moitiés | mélanges, moitiés et tiers | mélanges, parts inégales et quarts |
| `logique` | correspondance simple | suites (AB, AAB, ABC) | comparaisons (=, +1, −1) |
| `monnaie` | compter des pièces de 1 | additionner 1, 2, 5 | rendre la monnaie |

Les phrases de niveau sont des repères communs ; chaque jeu les décline.

### Réglage de la difficulté

- Dans l'espace parent, une section **Difficulté** : un niveau (1–3) **par thème**, qui s'applique à toutes les phases de ce thème dans tous les jeux.
- Sous chaque jeu, la liste de ses phases avec leur niveau effectif ; chaque phase peut être **surchargée** (« niveau propre à cette phase ») et revenir au niveau du thème.
- Recommandation initiale par âge, à valider (comme le rythme) : **≤ 5 ans → 1 ; 6 ans → 1 ; 7 ans → 2 ; ≥ 8 ans → 3** (proposition de l'auteur, la fille commence au niveau 1 partout).

### Propositions d'ajustement par phase

- Chaque phase enregistre localement ses derniers résultats (réussi / raté).
- **Trop dur** : au moins **3 échecs sur les 4 dernières parties** de cette phase → recommandation « Baisser la phase *X* du jeu *Y* au niveau *n−1* ».
- **Trop facile** : **5 réussites d'affilée** → recommandation « Monter la phase *X* au niveau *n+1* ».
- Recommandations dans l'espace parent (pastille sur ⚙️), Appliquer / Ignorer ; l'ajustement est une **surcharge de cette phase seulement**. Ignorée, elle ne revient qu'après une nouvelle série (historique remis à zéro). Après un changement de niveau, l'historique de la phase repart de zéro.
- Pas de proposition sous le niveau 1 ni au-dessus de 3.

### Le stand de desserts, phase par phase

Chaque phase : thème principal, puis niveaux.

**1. Commande — `lecture`** (la mémoire fait partie de ses niveaux 2 et 3)
- N1 : gâteau en image ; **mots en étiquettes autour du gâteau, jamais dessus**, avec un trait vers l'élément (forme, chaque zone de couleur, chaque sorte de topping) ; toucher un mot fait briller l'élément. Bulle agrandie.
- N2 : image montrée ~5 s (plus au rythme calme) puis cachée ; restent les **mots seuls** avec un pictogramme neutre de catégorie ; nombres en chiffres ; le bandeau du haut montre les mots.
- N3 : **une phrase** (« Un cœur rose et violet, avec deux fraises et une étoile. »), nombres en lettres ; bandeau = la phrase ; un **œil gratuit** remontre l'image **2 s**.
- Erreur : au service, le mot raté surligné.

**2. Pâte — `nombres`**
- Une **plaque à côté du bol** reçoit l'emballage vide de chaque ingrédient versé (coquille, paquet de farine plié, papier de beurre, pot de sucre, bouteille de lait, papier de chocolat), rangés par sorte ; les **coquilles dans une boîte à œufs 2×5** (une deuxième boîte après 10). À tous les niveaux.
- Une **boîte de 5 œufs** glissable d'un coup aux niveaux 2 et 3.
- N1 : quantités en **constellations de dé**, ≤ 5 (pas de points qui se remplissent ; la plaque suffit).
- N2 : **chiffres** et une **addition** (« 2 + 1 »), résultats ≤ 10.
- N3 : **compléments** (le bol contient déjà des ingrédients, leurs emballages sont sur un petit plateau à part : « il en faut 7, il y en a déjà 3 ») et **doubles** (« ×2 ») ; ≤ 20 ; additions à deux termes.
- Le réalisme des quantités n'est pas requis.
- Erreur : la recette réapparaît, ce qu'elle a mis / ce qu'il fallait (avec l'opération).

**2 bis. Pâte — ajustements après la première planche (validés par le parent)**
- **Prise multiple** : appui long sur un ingrédient → la main en ramasse un de plus toutes les ~0,6 s (plus lent au rythme calme) ; au-dessus de la main, **points de dé au N1**, **chiffre aux N2–N3** ; glisser dans le bol verse tout d'un coup ; lâcher ailleurs remet tout sur l'étagère. Appui bref = un seul. La boîte de 5 œufs est retirée.
- **Nombres revus à la baisse** : N1 1–4 par ingrédient, total ≤ 8 ; N2 une addition de résultat ≤ 6, autres 1–3, total ≤ 10 ; N3 complément de total ≤ 10, ×2 sur un nombre ≤ 4, total ≤ 12.

**3. Moule — `geometrie`**
- Nouvelles formes de départ : **triangle, rectangle, ovale** ; en boutique : **losange, hexagone** (cœur, étoile, licorne restent).
- N1 : retrouver la forme parmi **4 moules**, dont un piège proche ; toucher un moule affiche son nom.
- N2 : un **indice** affiché à l'écran du moule, surtout en images (nombre en points, coin ou côté surligné sur un pictogramme), mot en dessous : « 3 côtés », « 4 coins », « pas de coin », « 4 côtés pareils » ; formes non géométriques : indices amusants (« une corne », « 5 pointes »). Toucher un moule fait briller ses coins un par un (c'est elle qui touche).
- N3 : **le moule en morceaux** (2–3 pièces, parfois tournées) à assembler.
- Aux niveaux 2–3, le bandeau du haut ne montre pas la forme pendant cette phase. La commande montre le gâteau normalement.

**4. Cuisson — `temps`**
- Les flammes de chaleur restent à tous les niveaux.
- N1 : **minuterie ronde** avec secteur vert.
- N2 : minuterie **numérotée 1–5**, consigne « jusqu'au 3 » (chiffre + points) ; tolérance invisible ; durées différentes selon le dessert.
- N3 : **horloge** (petite aiguille, heures pleines puis demi-heures) : « il est 2 h, cuire 1 heure » → elle règle le **réveil** sur 3 h, lance, le temps passe en accéléré (1 h ≈ 6 s, plus lent au rythme calme), sort à l'heure. Un mauvais réglage du réveil donne un gâteau mal cuit (noté).

**5. Glaçage — `couleurs-fractions`**
- N1 : pots aux couleurs demandées ; 1 ou 2 zones (moitiés) ; pointillés.
- N2 : **pots de base rouge, bleu, jaune, blanc + bol de mélange** (rouge+blanc = rose, rouge+bleu = violet, bleu+jaune = vert, rouge+jaune = orange, bleu+blanc = bleu clair) ; le pot obtenu rejoint l'étagère ; bol vidable ; jusqu'à 3 zones égales ; pointillés.
- N3 : mélanges ; **parts inégales** (un tiers / deux tiers, un quart / trois quarts) = 3 ou 4 bandes dont plusieurs de même couleur ; **pas de pointillés**, seulement des **graduations sur le bord**.
- Boutique : aux niveaux 2–3, elle vend de nouvelles **bases** (marron, noir…) au lieu de couleurs toutes faites.
- Erreur : la zone ratée, la couleur attendue et **sa recette de mélange**.

**6. Toppings — `logique`**
- N1 : nombres exacts par sorte, ≤ 5 d'une sorte, pose libre (jeu actuel).
- N2 : **couronne d'emplacements** (6–8) au bord ; début du motif déjà posé ; compléter la suite (AB → AAB → ABC) ; noté emplacement par emplacement.
- N3 : **carte d'indices** en images et signes (🍓🍓🍓 ; ⭐ = 🍓 ; 🕯 = 🍓 + 1 ; plus tard − 1) ; pose libre ; nombres exacts.
- Aux niveaux 2–3, le bandeau ne montre pas les toppings pendant cette phase.
- Erreur : N2 emplacements faux entourés avec le bon topping en transparence ; N3 la carte rappelée avec les nombres attendus.

**7. Service et boutique — `monnaie`**
- Le client paie selon la réussite (0–5), comme aujourd'hui ; c'est elle qui **encaisse**. À 0, pas d'étape de caisse.
- N1 : pièces de 1 posées une par point ; elle les glisse dans la caisse puis choisit le total parmi 3 (en constellations) ; si faux, on recompte ensemble (les pièces se rallument une à une).
- N2 : pièces de 1 et 2, billet de 5 ; choisir le total parmi 3 (chiffres).
- N3 : un **ticket** indique la somme due ; le client paie plus (5, puis 10) ; elle **rend la monnaie** depuis la caisse ; ✓ ; si faux, le client montre la différence. Une petite **réserve** est fournie si la caisse ne suffit pas (hors gains).
- **Pièces et billets stylisés** (grands « 1 », « 2 », « 5 »), pas de reproduction des euros.
- Boutique : prix en pièces de 1 dessinées (N1), en euros (N2), et « combien me manque-t-il ? » avec une tirelire (N3).

### Règles communes

- **Le service montre ce qu'il fallait** pour chaque point raté, en image.
- **Pas de chronomètre** hors de la phase `temps`.
- Le **rythme** et le **mode soir** continuent de s'appliquer.
- Les pièces gagnées ne sont jamais retirées.

## Précisions (décisions de l'auteur après relecture)

- **7 thèmes** : `memoire` n'est pas un thème réglable à part ; elle fait partie des niveaux de la commande.
- **Réussi / raté d'une phase** (pour les propositions) : la phase est réussie si son point est gagné au service (toutes les zones, tous les emplacements justes). La **commande** n'a pas de résultat propre et ne génère pas de proposition (son niveau se règle à la main). Le **service** est raté si le premier total (N1–N2) ou le premier rendu de monnaie (N3) est faux, même si le client paie quand même. Une partie abandonnée (retour à l'accueil, boutique) ne compte pas.
- **Niveaux d'une partie** : lus **au début de chaque client** pour toutes les phases et gardés jusqu'au service ; un changement par le parent s'applique au client suivant. Des phases à des niveaux différents dans la même partie, c'est normal.
- **Une proposition à la fois par phase.** Une surcharge de phase reste en place même si le niveau du thème change ; le parent peut la retirer. Après tout changement de niveau d'une phase, son historique repart de zéro.
- **Texte hors lecture** : l'indice du moule est d'abord un pictogramme (le mot est dessous) ; l'horloge de la cuisson N3 montre l'heure de départ **sur une petite horloge dessinée** (« 2 h » en complément) ; le ticket du service N3 affiche un **nombre** et des pièces dessinées.
- **Prix de la boutique en N1** : pièces de 1 dessinées **groupées par 5** (rangées comme la boîte à œufs) ; N3 : la tirelire montre ce qu'elle a et ce qui manque, en pièces groupées et en nombre.
- **Couleurs et sauvegardes** : pas de migration. Au N1, les couleurs possédées sont des pots tout prêts (comme aujourd'hui). Aux N2–N3, l'étagère montre les **bases** (rouge, bleu, jaune, blanc — toujours disponibles) et les bases achetées ; les commandes n'utilisent que des couleurs **obtenables** avec ces bases (rose, violet, vert, orange, bleu clair, et les bases elles-mêmes). Les couleurs déjà achetées (bleu, vert) restent utiles au N1.
- **Registre** : chaque jeu ajoute à son `collection.js` la liste de ses **phases** (identifiant, nom en français pour le parent, thème) ; les tests du registre vérifient que chaque thème existe dans le catalogue commun.

## Laissé au constructeur

- Mise en page des étiquettes de la commande N1, de la carte d'indices, de la caisse ; animations.
- Liste exacte des mots et phrases (vocabulaire simple, script lisible).
- Génération des exercices (recettes, motifs, indices, montants) dans les bornes de chaque niveau.
- Dessins nouveaux (emballages vides, boîte à œufs, plateau, nouvelles formes et moules, minuterie, horloge, bol de mélange, pots de base, couronne d'emplacements, pièces et billets, ticket, tirelire, caisse) — avec validation du parent comme d'habitude.
