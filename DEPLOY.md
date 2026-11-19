# Mettre la collection de jeux en ligne et l'installer sur la tablette

Le site est publié **gratuitement sur GitHub Pages**. Vous n'avez rien à envoyer à la main : à chaque mise à jour fusionnée dans la branche `master`, une action automatique teste le site puis le publie.

L'adresse du site sera : `https://<compte>.github.io/<dépôt>/` (remplacez `<compte>` par votre nom d'utilisateur GitHub et `<dépôt>` par le nom du dépôt). Le site vit dans un sous-dossier : c'est prévu, rien à modifier.

Attention : le dépôt doit être **public** (c'est la condition de GitHub Pages gratuit), donc tout son contenu est visible de tous. Ne mettez jamais de mots de passe ou de données personnelles dans le dépôt. Les réglages et la progression de l'enfant restent sur la tablette, jamais dans le dépôt. Sur la tablette, ils sont rangés sous l'adresse `https://<compte>.github.io`, commune à tous les sites GitHub Pages de ce compte : un autre site publié sur le même compte pourrait les lire (le prénom et le mois et l'année de naissance de l'enfant). Ne publiez sur ce compte que vos propres sites, ou utilisez plus tard un nom de domaine dédié.

## 1. Première mise en ligne (une seule fois)

1. Sur github.com, créez un nouveau dépôt **public** (bouton **New**), sans fichier ajouté (ni README, ni licence).
2. Envoyez-y le projet en suivant les instructions que GitHub affiche sur la page du dépôt vide (la branche s'appelle `master`).
3. Dans le dépôt : **Settings** → **Pages** → à la ligne **Source**, choisissez **GitHub Actions**.
4. Onglet **Actions** : la publication démarre toute seule (sinon : « Publier le site » → **Run workflow**). Attendez la coche verte (1 à 2 minutes). Le lien du site s'affiche à la fin.
5. Ouvrez `https://<compte>.github.io/<dépôt>/` : l'accueil du jeu doit apparaître.

Seuls les fichiers du site sont publiés : `index.html`, `manifest.webmanifest`, `sw.js` et les dossiers `shared/`, `jeux/`, `vendor/`. Les dossiers `docs/`, `tests/`, `.superpowers/` et le fichier `package.json` ne sont jamais publiés.

Si la croix est rouge, c'est qu'un test automatique a échoué : rien n'est publié, l'ancienne version reste en ligne. Ouvrez l'exécution en échec dans l'onglet **Actions** pour lire l'erreur.

## 2. Installer sur la tablette Android (Chrome)

1. Connectez la tablette à Internet (Wi-Fi).
2. Ouvrez l'adresse du site dans **Chrome**. L'adresse commence par `https://` (GitHub Pages l'assure). Laissez l'accueil s'afficher (la grande tuile du gâteau).
3. Touchez le menu **⋮** (en haut à droite) puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
4. Une icône de gâteau (nommée « Ludeo ») apparaît sur l'écran d'accueil. Lancez l'application depuis cette icône : l'accueil s'ouvre en plein écran, en mode paysage ; la tuile du gâteau lance le stand de desserts.

Après cette première visite, l'accueil et tous les jeux marchent **sans Internet**.

**Tablette où le stand de desserts était déjà installé à une autre adresse** : ce sont deux applications distinctes (les pièces ne se transfèrent pas). Installez la nouvelle comme ci-dessus.

## 3. Mettre à jour le jeu (à chaque version)

1. Faites vos modifications, puis, dans `sw.js` (à la racine), augmentez le numéro de la ligne `const CACHE_VERSION = 'v5';` : `'v6'`, puis `'v7'`, etc. À **chaque** mise à jour, sans exception : sinon la tablette garde l'ancienne version. Un seul `sw.js` pour toute la collection.
2. Fusionnez les modifications dans `master` (par exemple en acceptant la « pull request »). L'action **Publier le site** se lance toute seule : attendez la coche verte dans l'onglet **Actions**.
3. Sur la tablette, **avec Internet** : ouvrez le jeu **deux fois** (fermez-le complètement, puis rouvrez-le). La première ouverture télécharge la nouvelle version, la seconde l'affiche.
4. Après la 2ᵉ ouverture, vérifiez que la nouveauté apparaît ; sinon, vérifiez que `CACHE_VERSION` a bien changé et que la coche verte est apparue, puis recommencez l'étape 3.

## 4. Organisation du projet et ajout d'un jeu

- `index.html` (à la racine) : **l'accueil**, page de démarrage de la collection (l'icône de la tablette l'ouvre).
- `shared/` : ce qui sert à tous (accueil, espace parent, profil, réglages, avatar).
- `jeux/<nom>/` : un dossier par jeu (le stand de desserts est dans `jeux/stand-desserts/`).
- `jeux/registry.js` : la liste des jeux et des catégories.
- `sw.js` : le fonctionnement hors connexion, commun à toute la collection.

Pour ajouter un jeu plus tard :

1. Créez un dossier `jeux/<nom>/` avec sa page `index.html` et ses fichiers.
2. Dans ce dossier, ajoutez `collection.js` sur le modèle de `jeux/stand-desserts/collection.js` : `ID` (le nom du dossier), `NAME` (nom français montré aux parents), `CATEGORY`, `TILE` (image de la tuile du jeu, dans son dossier), `SUPPORTS`, `PRECACHE` (tous les fichiers du jeu, pour le hors-connexion) et `reset` (efface la progression du jeu).
3. Dans `jeux/registry.js`, ajoutez une ligne `import` pour ce `collection.js` et ajoutez le jeu à la liste `GAMES`. Si la catégorie n'existe pas encore, ajoutez-la à `CATEGORIES`.
4. Le jeu **doit respecter tous les réglages partagés** : le **rythme** (calme, normal, rapide) et le **mode soir** (couleurs adoucies, pas de confettis). Il lit ces réglages via `shared/runtime.js` (voir `jeux/stand-desserts/src/ui/pace.js` pour un exemple) et les déclare dans `SUPPORTS` ; il doit aussi proposer un bouton retour vers l'accueil (`../../index.html`).
5. Lancez `npm test` : un test vérifie le registre, les réglages pris en charge et la liste des fichiers du hors-connexion. Puis augmentez `CACHE_VERSION` (partie 3).

## 5. Tout remettre à zéro (réservé aux parents)

Sur l'accueil, touchez la **roue dentée** en haut à droite (espace parent), puis la rubrique **Jeux** : **Remettre à zéro** efface la progression du jeu choisi (pièces, achats), après une confirmation. Les réglages de la rubrique **Difficulté** (niveaux, niveaux propres des phases) et les derniers résultats des phases sont gardés : ce sont des réglages du parent, pas une progression ; changer un niveau efface l'historique de la phase concernée (§6).

## 6. Difficulté (espace parent)

La rubrique **Difficulté** de l'espace parent règle le niveau (1 à 3) de deux façons. D'abord **par thème** (lecture, nombres) : le niveau choisi vaut pour toutes les phases de ce thème, dans tous les jeux. Ensuite **par phase** : une phase peut avoir son **propre niveau** (par exemple la pâte du stand), qui prend alors le pas sur celui du thème ; « Comme le thème » le retire. Un changement compte à partir de la partie suivante. Recommandations propose aussi, selon l'âge, un niveau pour chaque thème qu'utilise déjà un jeu (aujourd'hui lecture et nombres ; les autres thèmes ne servent encore à rien). Les **propositions** apparaissent dans Recommandations (et la pastille rouge de la roue dentée) : l'application garde les 5 derniers résultats de chaque phase ; si 3 des 4 derniers sont ratés, elle propose de baisser la phase d'un niveau (« trop dur »), et après 5 réussites de suite, de la monter ; la carte dit pourquoi (« ratée 3 fois sur les 4 dernières parties »). Seules comptent les parties jouées en entier au niveau réglé : une partie commencée avant un changement de niveau, ou une entrée de test (`?debug`), n'est pas enregistrée. **Appliquer** ne change que cette phase (son niveau propre) et efface son historique ; le thème et les autres phases ne bougent pas. Changer le niveau d'un thème efface aussi l'historique des phases qui le suivent.
