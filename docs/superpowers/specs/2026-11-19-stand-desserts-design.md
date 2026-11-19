# Stand de desserts — design

Date : 2026-11-19

## Intention

Un mini-jeu pour une fille de 6 ans, sur sa tablette Android, **sans aucune publicité**. Elle tient un stand de desserts : un client passe commande, elle prépare le dessert en une suite de mini-jeux, le client paie selon la qualité. L'argent sert à acheter de nouveaux éléments dans une boutique.

## Objectifs

- Un jeu complet et rejouable : commande → 5 mini-jeux de préparation → service et paiement → client suivant.
- Jouable par une enfant qui ne lit pas (ou peu) : **toute l'information passe par l'image** (pictos, chiffres simples, jauges, visages).
- Belles animations et beaux sprites (souhait explicite).
- Installable sur l'écran d'accueil, fonctionne hors ligne, aucune pub, aucun compte, aucune donnée qui sort de la tablette.

## Non-objectifs (pour cette version)

- **Pas de son** (ni bruitages ni voix). Décidé : « on verra plus tard ». Prévoir seulement que l'ajout ultérieur soit facile.
- Pas de publication sur un store, pas d'appli native.
- Pas de multi-profils, pas de synchronisation entre appareils.

## Anti-objectifs (échec même si « ça marche »)

- Toute publicité, achat intégré, lien externe, ou collecte de données.
- Un écran qui exige de lire du texte pour être compris.
- Un échec bloquant (« game over ») : on passe toujours au client suivant.
- Des zones tactiles trop petites ou des gestes trop précis pour un doigt de 6 ans.

## Contraintes

- Tablette **Android Samsung de quelques années** (haut-parleurs « AKG », donc probablement une Galaxy Tab de la gamme S), navigateur Chrome, mode **paysage**. Matériel correct mais pas récent : la peinture au doigt, les particules et la mesure de couverture doivent rester fluides sur ce type d'appareil (ex. mesurer la couverture sur une copie basse résolution, limiter les particules). Résolution de jeu de référence à choisir par le constructeur, avec mise à l'échelle.
- Jeu web installable (PWA) : hébergé en HTTPS, fonctionne **hors ligne** après la première visite.
- **Hébergement : nom de domaine et hébergement de base de la personne à l'origine du projet** (fichiers statiques envoyés par FTP ou équivalent, par ex. sur un sous-domaine). Aucun code serveur nécessaire. **HTTPS obligatoire** (sinon pas d'installation ni de hors ligne) : vérifier qu'un certificat est actif (souvent Let's Encrypt inclus). L'adresse définitive doit être fixée avant la première installation sur la tablette.
- **Phaser** (moteur de jeu web, gratuit, MIT), chargé comme un fichier local — pas de CDN au moment du jeu (hors ligne).
- Licences des images : uniquement CC0 (ou équivalent sans obligation), vérifiées et notées.

## Approches considérées

1. **Page web sans librairie, dessins SVG en code.** Simple, zéro dépendance. Écartée : la personne à l'origine du projet veut des animations riches et de beaux sprites ; tout ferait à la main (particules, tweens, glisser-déposer, rendu de la peinture).
2. **Phaser + sprites (retenue).** Fournit animations, particules, glisser-déposer, teinte de sprites (indispensable pour le glaçage de n'importe quelle couleur), rendu vers texture (peinture au doigt). Choisie par la personne à l'origine du projet.
3. **Appli native Android/iOS.** Écartée : passage par un store ou contraintes de signature, sans bénéfice ici.

## Ce qui a été décidé

### Style graphique

**Cartoon 3D brillant** (style « S2 », choisi le 2026-11-19 parmi 4 variantes dessinées) : couleurs vives, dégradés doux, reflets, ombres légères, contours fins colorés plutôt que gros traits noirs — le rendu des jeux mobiles récents.

**Vues du gâteau** (décision de l'auteur) : pendant la **peinture** et les **toppings**, le gâteau est montré **vu de dessus** (peinture au doigt simple et précise). Partout ailleurs (moule, four, service, bulle de commande), il est montré **en 3/4 avec son épaisseur** (génoise, crème, glaçage). La vue 3/4 réutilise le dessus (écrasé verticalement) posé sur un flanc dessiné par forme.

Écarté : l'isométrique (forme moins lisible, peinture sur face inclinée, 1,5–2× plus de dessin).

### Images

Mélange :
- Ingrédients et toppings repris de packs **CC0** (ex. OpenGameArt « SVG dessert ingredients », Kenney) **quand ils collent au style** ; sinon redessinés.
- Pièces sur mesure dessinées en SVG dans le style retenu, puis exportées en sprites : bases de dessert (et leurs états), glaçage (dessiné **en blanc** pour être teinté), moules, client(s), stand, interface.
- Chaque image doit pouvoir être remplacée plus tard sans toucher au code (fichier par élément, noms stables).

### Déroulé d'une partie (un client)

**0. Commande.** Un client arrive au stand. Une bulle montre la commande **une étape à la fois** ; elle touche ✓ pour passer à la suivante. Points de progression visibles (●○○○).
Bulles : dessert → forme → couleur → toppings (avec nombre).
Ensuite, **la commande complète reste affichée en petit en haut de tous les écrans suivants** (elle n'a pas à la mémoriser).

**1. Pâte.** Une recette en images (ingrédient + « ×N ») est affichée. Une étagère propose les bons ingrédients **et des intrus**. Elle **fait glisser** chaque ingrédient dans le bol. Puis un fouet apparaît : elle **mélange en faisant des cercles** avec le doigt. Réussi si : ingrédients et quantités exacts, aucun intrus, et assez mélangé. Sinon la pâte reste visiblement ratée (grumeleuse) jusqu'au service.

**2. Moule.** 3–4 **vrais moules** proposés (moules en silicone colorés et brillants, vus en 3/4, avec bord et fond — pas une simple forme) ; elle touche le bon, la pâte coule dedans et le remplit. Le dessert cuit **dans son moule** et est **démoulé** à la sortie du four. Mauvais moule = la forme servie n'est pas celle demandée.

**3. Cuisson.** La recette indique une chaleur cible (1–3 flammes). Elle règle la chaleur, lance le four, le dessert **gonfle et dore en direct**. Une jauge monte : jaune (pas cuit) → vert (parfait) → marron (brûlé). Elle appuie sur « Sortir ! ». Une chaleur trop forte fait monter la jauge plus vite (fenêtre verte plus courte) ; trop faible, plus lentement. Résultat visible : pâle, doré ou brûlé.

**4. Couleur.** Elle choisit un pot de glaçage puis **peint au doigt** sur le dessert. Il faut couvrir la surface (seuil de couverture) avec la bonne couleur. Indicateur de couverture visible.

**5. Toppings.** Elle **fait glisser chaque topping un par un** et le pose où elle veut. La commande peut demander un **nombre précis** (« 3 étoiles ») : il faut le bon topping et le bon nombre.

**6. Service.** Le client goûte. Les 5 points (pâte, moule, cuisson, couleur, toppings) s'affichent un par un, ✅ ou ❌, avec **une petite image de ce qui n'allait pas** (ex. gâteau brûlé). **1 pièce par point réussi** (0 à 5). Visage du client : 😊 / 😐 / 😖 selon le score. Bouton « Client suivant ».

### Règle des erreurs

**Les erreurs comptent** (choix explicite) : ce qui est raté reste raté jusqu'au service et coûte des pièces. Pas de « game over ».

**Recommencer une étape** (choix explicite) : chaque étape a un bouton ↺ qui remet l'étape à son début (bol vide, glaçage effacé, toppings retirés, nouvelle pâte au four…). L'étape n'est verrouillée que lorsqu'elle appuie sur ✓ ; après ✓, pas de retour en arrière. Pour le moule, toucher un moule le sélectionne, ✓ valide. Pour la cuisson, ↺ reste possible après « Sortir ! » tant que ✓ n'est pas appuyé (application littérale de « chaque étape » — à confirmer). Pas de bouton « annuler le dernier geste » : seulement recommencer l'étape entière.

### Argent et boutique

- Les pièces s'accumulent. Une **boutique légère** permet de débloquer : nouveaux toppings, nouveaux moules, nouvelles couleurs, décorations du stand.
- Contenu de départ (assez pour jouer sans rien acheter) : 3 desserts (gâteau, tarte, cupcake), 3 moules (rond, carré, cœur), 4 couleurs, 4 toppings (fraises, pépites de chocolat, vermicelles, bougie).
- Exemples de déblocages : toppings (étoiles, bonbons, chantilly…), moules (étoile, licorne…), couleurs, décorations (guirlande, auvent rayé, pancarte).
- **Les clients ne commandent que ce qu'elle possède.** Chaque achat élargit les commandes possibles.
- Prix bas au début (premier achat après 2–3 clients), qui montent doucement.
- Prix affichés en pièces (pictos), sans texte.

### Sauvegarde et parent

- Sauvegarde **automatique et locale** (stockage du navigateur) : pièces, achats. Rien sur un serveur.
- **Zone parent cachée** (appui long dans un coin) : remise à zéro de la progression.

### Installation

- Sur l'hébergement de la personne à l'origine du projet (voir Contraintes). Prévoir une procédure simple de mise à jour : envoyer le dossier construit, et que la tablette récupère la nouvelle version (mise à jour du cache hors ligne) sans réinstaller.
- Sur la tablette Android : ouvrir l'adresse dans Chrome, « Ajouter à l'écran d'accueil » / « Installer l'appli ». Ensuite plein écran, paysage, hors ligne.

## Décisions de l'auteur (à vérifier par la personne à l'origine du projet)

- La commande inclut une **bulle « forme »** (nécessaire pour que l'étape moule ait une bonne réponse). La séquence est donc dessert → forme → couleur → toppings.
- Chaque dessert a **sa propre recette** (ingrédients/quantités) et **sa chaleur cible**. Tarte et cupcake utilisent des moules adaptés (moule à tarte, caissette) ; « forme » s'applique à ces moules aussi.
- **Les formes sont communes à tous les desserts** : un moule acheté (ex. étoile) sert pour le gâteau, la tarte et le cupcake. Côté images, une forme = une silhouette (masque) appliquée à la texture du dessert, et non un dessin par couple dessert/forme. La silhouette sert aussi de masque pour mesurer la couverture du glaçage.
- **Toppings commandés : un seul type, en nombre exact (1 à 5)** au départ. Réussi seulement si le bon type et le bon nombre, sans topping en plus ni d'un autre type. Les commandes à deux types pourront venir plus tard comme difficulté.
- **5 points notés → 0 à 5 pièces** (et non 0 à 6 évoqué au début).
- Pas de compte à rebours ni de pression de temps, sauf la jauge de cuisson.

## Laissé au constructeur

- Version exacte de Phaser (dernière stable, figée et embarquée localement), structure des fichiers, mise en place PWA (manifest, service worker).
- Seuils précis : couverture de peinture, quantité de « mélange » suffisante, largeur de la fenêtre verte selon la chaleur, prix exacts de la boutique.
- Choix précis des packs CC0 et liste des éléments redessinés ; fichier listant les licences.
- Nombre et variété des clients (apparences), animations d'arrivée/départ.
- Séparer la logique pure (génération de commande, notation, économie, sauvegarde) du rendu Phaser pour pouvoir la tester automatiquement.
