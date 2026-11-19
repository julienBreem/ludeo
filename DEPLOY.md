# Mettre la collection de jeux en ligne et l'installer sur la tablette

## 1. Ce qu'il faut envoyer sur le site (FTP)

Le site est une **collection** : un accueil (à la racine) et les jeux, chacun dans `jeux/<nom>/` (le stand de desserts est dans `jeux/stand-desserts/`).

Envoyez tout le contenu du dossier du projet **sauf** :

- `docs/`, `tests/`, `.superpowers/` (dossiers de travail, inutiles en ligne)
- `package.json`

Les fichiers `ASSETS-LICENSES.md` peuvent être envoyés ou non, au choix : les jeux n'en ont pas besoin.

Les dossiers essentiels sont `jeux/`, `shared/`, `vendor/`, et les fichiers `index.html`, `manifest.webmanifest`, `sw.js` (à la racine).

La collection peut être à la racine d'un site, dans un sous-domaine (`jeu.monsite.fr`) ou dans un sous-dossier (`monsite.fr/jeu/`) : rien à modifier.

## 2. Vérifier le cadenas (HTTPS)

Ouvrez l'adresse du jeu dans Chrome. L'adresse doit commencer par `https://` et un cadenas doit apparaître à gauche. Sans HTTPS, le jeu fonctionne mais ne peut pas s'installer ni marcher hors connexion. Si besoin, activez le certificat HTTPS (souvent gratuit, "Let's Encrypt") dans l'espace client de l'hébergeur.

## 3. Installer sur la tablette Android

1. Connectez la tablette à Internet (Wi-Fi).
2. Ouvrez l'adresse du site dans **Chrome**. Laissez l'accueil s'afficher (la grande tuile du gâteau).
3. Touchez le menu **⋮** (en haut à droite) puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
4. Une icône de gâteau apparaît sur l'écran d'accueil. Lancez l'application depuis cette icône : l'accueil s'ouvre en plein écran, en mode paysage ; la tuile du gâteau lance le stand de desserts.

Après cette première visite, l'accueil et tous les jeux marchent **sans Internet**.

**Tablette où le stand de desserts était déjà installé** : rien à réinstaller. La même icône ouvre désormais l'accueil (après la mise à jour de l'étape 4), et les pièces et achats du stand sont conservés.

## 4. Mettre à jour le jeu

1. Modifiez les fichiers (accueil ou jeux).
2. Dans `sw.js` (à la racine), augmentez le numéro de la ligne `const CACHE_VERSION = 'v4';` : `'v5'`, puis `'v6'`, etc. (à chaque mise à jour, sans exception : sinon la tablette garde l'ancienne version). Un seul `sw.js` pour toute la collection.
3. Envoyez de nouveau tous les fichiers modifiés (et `sw.js`). Si des fichiers ont été déplacés ou supprimés, supprimez aussi les anciens sur le site (pour la collection : les anciens dossiers `assets/` et `src/` à la racine), **après** avoir envoyé le nouveau `sw.js`. Le logiciel FTP ne doit pas conserver la date des fichiers envoyés (réglage par défaut) : sinon le site peut répondre à la tablette que `sw.js` n'a pas changé.
4. Sur la tablette, avec Internet : ouvrez le jeu **deux fois** (le fermer complètement, puis le rouvrir). La première ouverture télécharge la nouvelle version, la seconde l'affiche.
5. Après la 2ᵉ ouverture, vérifiez que la nouveauté apparaît ; sinon, re-changez `CACHE_VERSION` (`'v5'`, etc.), renvoyez `sw.js` et recommencez l'étape 4.

## 5. Tout remettre à zéro (réservé aux parents)

Dans le stand de desserts, maintenez le doigt **3 secondes** sur le coin **en haut à gauche** de l'écran : la progression (pièces, achats) est effacée.
