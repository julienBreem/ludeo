# Collection de jeux éducatifs — écran d'accueil et réglages communs

Date : 2026-11-19. Le projet `foodStand` devient une **collection** ; le stand de desserts (v1.1, livré) en est le premier jeu.

## Intention

Le parent va créer plusieurs jeux éducatifs pour sa fille de 6 ans (tablette Android). Il veut un **accueil** où l'enfant choisit un jeu par **catégorie d'apprentissage** (calcul, lecture…), et des **réglages communs** appliqués à tous les jeux. Ces réglages servent le bien-être de l'enfant : un **rythme adapté à son âge** (des scènes qui s'enchaînent trop vite ne conviennent pas aux plus jeunes) et un **mode soir** plus doux (pour ne pas l'exciter avant le coucher). Plus tard viendront des contrôles parentaux (durée de jeu, difficulté…).

## Objectifs

1. Un accueil sans texte pour l'enfant : avatar, grandes tuiles par catégorie.
2. Un **profil enfant** et des **réglages communs** (rythme, mode soir) lus par chaque jeu.
3. Des **recommandations** calculées à partir de l'âge et de l'heure, que le **parent valide** (rien ne change sans lui).
4. Le stand de desserts déménagé dans la collection, appliquant rythme et mode soir.
5. Une structure qui permet d'ajouter un jeu sans toucher aux autres.

## Non-objectifs

- Pas de protection de l'espace parent pour l'instant (décision du parent) — seulement un accès discret ; la place est gardée pour un verrou plus tard.
- Pas de limite de temps de jeu, pas de difficulté réglable, pas de son, pas de compte en ligne.
- Pas de nouveau jeu dans ce chantier.

## Anti-objectifs

- Un réglage qui change sans que le parent l'ait accepté.
- Du texte nécessaire à l'enfant sur l'accueil.
- Un jeu qui doit connaître les autres jeux pour fonctionner.
- Perdre la progression actuelle du stand de desserts (pièces, achats) ou devoir réinstaller l'appli sur la tablette.

## Contraintes

- Tablette Android, Chrome, paysage ; appli web installée (PWA), hors ligne, sur l'hébergement HTTPS du parent ; chemins relatifs (sous-dossier possible).
- Pas de dépendance npm ; Phaser 3.90.0 déjà embarqué ; style S2.
- Stockage local uniquement.

## Approches

- **Retenue (A) : une seule appli — l'accueil à la racine, un dossier par jeu** (`jeux/stand-desserts/`, …), un module partagé de réglages. Une seule installation et un seul mode hors ligne ; jeux indépendants.
- Écartée (B) : tout dans un seul moteur Phaser — jeux mêlés et chargés ensemble, l'ensemble s'alourdit à chaque jeu.
- Écartée (C) : une appli par jeu — une installation par jeu, réglages difficiles à partager.

## Décisions

### Accueil (enfant)

- En haut à gauche : **l'avatar** de l'enfant. En haut à droite : **⚙️** (accès parent, simple toucher), avec une **pastille** quand une recommandation attend.
- Au centre : une **grande tuile illustrée par catégorie qui a au moins un jeu** (les catégories vides ne s'affichent pas). Toucher une tuile ouvre la liste des jeux de la catégorie ; s'il n'y en a qu'un, le jeu se lance directement.
- Au départ, une seule catégorie : **« compter et observer »** (stand de desserts).
- Chaque jeu a un **bouton maison** pour revenir à l'accueil (sur son écran principal ; pour le stand : l'écran du stand).
- Passage accueil ↔ jeu par un fondu (la page se recharge).

### Espace parent (texte autorisé)

- Sections : **Profil** (prénom, mois et année de naissance, avatar), **Rythme**, **Mode soir**, **Recommandations**, **Jeux** (remise à zéro de la progression par jeu).
- La remise à zéro cachée dans le coin du stand (v1) est **retirée** au profit de la section Jeux.

### Profil

- Prénom (pour le parent), mois + année de naissance (l'âge se met à jour seul), avatar choisi parmi des combinaisons du système de clients du stand (coiffure, couleur, peau, accessoire) — proposition de l'auteur.

### Rythme

- Trois niveaux : **calme**, **normal**, **rapide**. Chaque jeu l'applique à sa façon.
- Pour le stand (proposition de l'auteur) : en **calme**, transitions entre écrans 2,5× plus lentes, animations ~1,5× plus lentes, client qui arrive plus lentement, zone verte du four 1,5× plus longue, moins de particules ; **normal** = comportement actuel ; **rapide** = transitions plus courtes.
- Recommandation par âge (validée par le parent) : **≤ 6 ans → calme**, **7–9 ans → normal**, **≥ 10 ans → normal** (rapide jamais recommandé, mais choisissable).

### Mode soir

- Le parent l'active avec une **heure de début et de fin** (par défaut 19:00 → 07:00). Pendant cette plage, sur l'accueil et dans les jeux : couleurs **adoucies et assombries** (teinte chaude), **pas de confettis ni d'effets clignotants**, et le **rythme calme** s'applique quel que soit le réglage.
- Chaque jeu fournit sa version douce (pour le stand : un filtre global sur l'image du jeu + suppression des confettis/étincelles suffit — décision de l'auteur).
- Recommandation : tant que le mode soir n'est ni activé ni ignoré, une recommandation « activer le mode soir à 19 h » est proposée.

### Recommandations

- Calculées au démarrage de l'accueil à partir du profil, des réglages et de l'heure. Chacune : une phrase d'explication, **Appliquer** / **Ignorer**.
- Rien ne change avant « Appliquer ». Une recommandation **ignorée ne revient pas** avant que sa situation change (par exemple un nouvel âge).
- Sans profil (premier lancement), l'accueil fonctionne avec rythme normal et sans mode soir ; une recommandation invite à remplir le profil.

### Structure

- **Règle de la collection (demande du parent) : tous les réglages communs — rythme, mode soir et ceux qui viendront — s'appliquent à l'accueil ET à chaque jeu.** Un jeu n'entre dans la collection que s'il les applique tous ; un test vérifie que chaque jeu du registre déclare les gérer.
- Un **registre des jeux** déclare pour chacun : identifiant, dossier, catégorie, image de tuile, sa remise à zéro, sa liste de fichiers, et la confirmation qu'il gère chacun des réglages communs.
- Un **module partagé** fournit aux jeux les réglages effectifs du moment (rythme, mode soir actif ou non), sans qu'ils lisent eux-mêmes le stockage.
- Stockage : une clé commune pour profil/réglages/recommandations ignorées ; **la sauvegarde du stand garde sa clé actuelle** (pas de migration, la progression est conservée).
- Hors ligne : un seul service worker à la racine qui met en cache l'accueil **et** tous les jeux ; `CACHE_VERSION` incrémenté.
- L'appli installée garde la même adresse : la tablette ouvre désormais l'accueil, sans réinstallation.

## Précisions (décisions de l'auteur après relecture)

- **Technique de l'accueil** : l'accueil et l'espace parent sont en **HTML/CSS** (vrais champs de saisie, cartes de recommandation), dans le style S2 ; Phaser reste à l'intérieur des jeux.
- **Réglages dans un jeu** : chaque jeu importe le module partagé, qui lit la clé commune et calcule les réglages effectifs. Le mode soir est **réévalué chaque minute** : s'il commence pendant une partie, l'ambiance douce s'installe en fondu (et le rythme calme s'applique à partir de la scène suivante).
- **Organisation des fichiers** : à la racine, l'accueil, le module partagé, `vendor/` (Phaser, partagé), le manifeste et le service worker ; chaque jeu dans `jeux/<id>/` avec son code, ses images et sa liste de fichiers. La liste mise en cache par le service worker est l'assemblage de celle de l'accueil et de celles déclarées par chaque jeu du registre.
- **Mode soir dans le stand** : un **filtre CSS** sur le canvas du jeu (adoucir, assombrir, réchauffer), et les confettis/étincelles coupés à la source (module d'effets).
- **Remise à zéro par jeu** : chaque jeu déclare dans le registre sa propre fonction de remise à zéro ; l'accueil ne connaît aucune clé de sauvegarde de jeu. Le stand utilise sa remise à zéro existante.
- **Recommandations ignorées** : mémorisées avec la situation pour laquelle elles ont été ignorées (pour le rythme : l'âge). Le mode soir ignoré ne revient pas (on peut toujours l'activer dans sa section). « Remplir le profil » ignoré ne revient pas non plus ; la section Profil reste accessible.
- **Bouton maison** : seulement sur l'écran du stand (début d'une commande) ; quitter abandonne la commande en cours sans rien perdre (les pièces ne sont gagnées qu'au service). Pas de confirmation.
- **Icône parent** : un petit engrenage dessiné en S2 (pas un emoji). Heures au format 24 h.

## Laissé au constructeur

- Mise en page exacte de l'accueil et de l'espace parent ; illustrations des tuiles et de l'icône maison (style S2) ; liste des jeux d'une catégorie.
- Valeurs précises des ralentissements et du filtre du soir, dans l'esprit ci-dessus.
- Déménagement des fichiers du stand et mise à jour des tests et du script de partie automatique.
