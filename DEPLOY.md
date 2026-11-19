# Mettre le jeu en ligne et l'installer sur la tablette

## 1. Ce qu'il faut envoyer sur le site (FTP)

Envoyez tout le contenu du dossier du jeu **sauf** :

- `docs/`, `tests/`, `.superpowers/` (dossiers de travail, inutiles en ligne)
- `package.json`

Le fichier `ASSETS-LICENSES.md` peut être envoyé ou non, au choix : le jeu n'en a pas besoin.

Les dossiers essentiels sont `assets/`, `src/`, `vendor/`, et les fichiers `index.html`, `manifest.webmanifest`, `sw.js`.

Le jeu peut être à la racine d'un site, dans un sous-domaine (`jeu.monsite.fr`) ou dans un sous-dossier (`monsite.fr/jeu/`) : rien à modifier.

## 2. Vérifier le cadenas (HTTPS)

Ouvrez l'adresse du jeu dans Chrome. L'adresse doit commencer par `https://` et un cadenas doit apparaître à gauche. Sans HTTPS, le jeu fonctionne mais ne peut pas s'installer ni marcher hors connexion. Si besoin, activez le certificat HTTPS (souvent gratuit, "Let's Encrypt") dans l'espace client de l'hébergeur.

## 3. Installer sur la tablette Android

1. Connectez la tablette à Internet (Wi-Fi).
2. Ouvrez l'adresse du jeu dans **Chrome**. Laissez le jeu se charger jusqu'à l'écran du stand.
3. Touchez le menu **⋮** (en haut à droite) puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
4. Une icône de gâteau apparaît sur l'écran d'accueil. Lancez le jeu depuis cette icône : il s'ouvre en plein écran, en mode paysage.

Après cette première visite, le jeu marche **sans Internet**.

## 4. Mettre à jour le jeu

1. Modifiez les fichiers du jeu.
2. Dans `sw.js`, changez la ligne `const CACHE_VERSION = 'v1';` en `'v2'`, puis `'v3'`, etc. (à chaque mise à jour, sans exception : sinon la tablette garde l'ancienne version).
3. Envoyez de nouveau tous les fichiers modifiés (et `sw.js`).
4. Sur la tablette, avec Internet : ouvrez le jeu **deux fois** (le fermer complètement, puis le rouvrir). La première ouverture télécharge la nouvelle version, la seconde l'affiche.

## 5. Tout remettre à zéro (réservé aux parents)

Dans le jeu, maintenez le doigt **3 secondes** sur le coin **en haut à gauche** de l'écran : la progression (pièces, achats) est effacée.
