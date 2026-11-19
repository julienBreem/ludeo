# Village des singes — jeu de lecture et d'écriture

Date : 2026-11-19. Deuxième jeu de la collection (après le stand de desserts), dans une nouvelle catégorie **« lire et écrire »**.

## Intention

Le parent veut apprendre à lire (et un peu à écrire) à sa fille, **en 3e maternelle en Belgique**, sur la tablette Android de la collection. Aujourd'hui elle **reconnaît et écrit son prénom et celui de ses copines** (reconnaissance globale), mais ne déchiffre pas encore.

Le jeu : un **village de singes** que l'enfant construit. **Chaque maison appartient à une lettre.** L'enfant y installe un singe en lui **apprenant des mots** de cette lettre ; chaque mot appris devient un **objet** qui décore la maison. Quand le singe a appris assez de mots, il sort en **tenue de son métier** (un métier qui commence par la lettre) et vit autour de sa maison.

Le cœur du jeu — **le mini-jeu où l'enfant apprend des mots au singe** — doit être vraiment bien fait : c'est là que se fait l'apprentissage.

### Pédagogie retenue (recherches de l'auteur)

- Approche **syllabique / phonique** : correspondance lettre ↔ son, puis assemblage en syllabes, puis mots. C'est ce que recommandent la recherche et les référentiels (FWB : compétences initiales ; France : guide « Pour enseigner la lecture et l'écriture au CP ») ; les jeux qui ont un effet mesuré (GraphoGame) entraînent surtout lettre-son et déchiffrage, en complément de l'école.
- Prérequis de maternelle travaillés en même temps : entendre les syllabes d'un mot, entendre le son d'une lettre.
- **Jamais la méthode globale** comme principe (mots reconnus comme des images).
- Apprendre **en enseignant** : c'est l'enfant qui « apprend » au singe ; le singe parle, elle montre.

## Objectifs

1. Un village : terrain avec la maison de l'enfant (son avatar) en bas, des emplacements libres où construire des maisons de singe.
2. Une maison = une lettre (son principal), présentée par le singe (« le M fait mmm »).
3. Le mini-jeu des mots : **écouter** (toucher les syllabes, le singe les dit), puis **écrire** (remettre des cubes-lettres dans l'ordre, chaque cube dit son son, chaque syllabe finie est dite).
4. Chaque mot réussi débloque un objet à placer dans la maison ; ~4 objets installent le singe ; 8 à 10 objets par maison pour revenir.
5. Des **niveaux de difficulté** dans l'écriture (recopier → modèle caché → dictée), qui montent quand l'enfant revient dans une maison.
6. La **révision** : les mots des nouvelles maisons mélangent les lettres déjà vues ; les singes font des demandes d'objets des anciennes maisons.
7. Une **collection** (dans la maison de l'enfant) : lettres apprises, objets gagnés, emplacements vides pour ce qui reste.
8. Le jeu applique tous les réglages communs de la collection (rythme, mode soir).

## Non-objectifs

- Pas de tracé de lettres au doigt : « écrire » = choisir et ordonner des cubes-lettres.
- Pas de lecture de phrases ni de textes.
- Pas de monnaie ni de boutique (la récompense, ce sont les objets et le singe).
- Pas de réglage manuel de la difficulté par le parent dans cette version (les niveaux montent seuls ; un réglage parent pourra venir plus tard).
- Pas de voix de synthèse de la tablette pendant le jeu (indisponible dans Chrome sur la tablette du test, et de qualité variable).

## Anti-objectifs

- Une aide qui lit ou compte à la place de l'enfant (même principe que le stand).
- Un mot où la lettre de la maison ne fait **pas** son son principal (« chat » dans la maison C, « ananas » pour le son [a]).
- Un découpage qui n'est pas en **syllabes** (« ch » seul n'est jamais présenté comme une syllabe ; les sons isolés n'apparaissent que pour une lettre/un cube).
- Punir l'erreur : pas de croix rouge, pas de compteur d'échecs, pas de perte.
- Du texte nécessaire à l'enfant en dehors des lettres et mots qu'elle apprend (consignes par la voix et l'image).
- Un style d'image « kawaii » (grands yeux brillants) ; des images fautives (deux queues, objet méconnaissable, mauvaise couleur d'habit).

## Contraintes

- Celles de la collection (spec `2026-11-19-accueil-collection-design.md`) : tablette Android, **Chrome**, paysage, PWA hors ligne, GitHub Pages (dépôt public), chemins relatifs, pas de npm, Phaser 3.90.0 embarqué, stockage local uniquement, registre des jeux, réglages communs obligatoires (`SUPPORTS = ['rythme', 'soir']`), bouton maison.
- Tout le son et toutes les images sont **préparés à l'avance** sur le Mac du parent et livrés comme fichiers ; rien n'est généré sur la tablette.
- Taille : le jeu est mis en cache hors ligne ; viser des fichiers légers (audio AAC/m4a courts, images compressées).

## Approches

### Structure (une seule voie raisonnable)

Un jeu `jeux/village-singes/` en **Phaser**, comme le stand : son `collection.js` (ID, NAME, CATEGORY, SUPPORTS, PRECACHE, reset), ses scènes, sa logique pure testée, son fichier de données. Les alternatives (pages HTML/CSS seules, autre moteur) ne réutiliseraient ni le moteur ni les habitudes du stand.

### Son (choisi : B)

- A. Voix de synthèse de la tablette pendant le jeu — écartée : indisponible dans le Chrome de la tablette lors du test, « M » lu « èm », qualité variable.
- **B. Fichiers préparés sur le Mac** — retenue. Test comparatif fait (voix Mac Thomas, Flo, Eddy ; Piper siwis, upmc, tom) : **Thomas** a de loin la diction la plus claire (avis du parent).

### Images (choisi : B)

- A. Tout dessiné à la main en SVG — trop long pour ~60 objets et des singes en tenue.
- **B. FLUX.1 [schnell] en local** (outil installé pour toute la collection : `~/tools/flux-local/flux.sh`) pour les singes et les objets ; **SVG à la main** pour le terrain, les maisons, les cubes et l'interface (FLUX les rend mal). Retenue après test.

## Décisions

### Village (écran terrain)

- En bas : la **maison de l'enfant** avec son **avatar** (celui du profil de la collection, `shared/avatar.js`). La toucher ouvre la **collection**.
- Sur le terrain : des **emplacements** de maison (autant que de lettres de la version). Un emplacement libre touché → le jeu propose **la ou les 2 prochaines lettres** de la progression → la maison apparaît avec la lettre en grand sur la porte → un singe arrive, montre la lettre et dit son son (« mmm »).
- Les singes installés se promènent **en tenue de métier** autour de leur maison.
- De temps en temps, un singe montre une **bulle avec l'image d'un objet** pas encore gagné d'une maison déjà construite (invitation à y retourner). Sans objet restant, pas de bulle.
- Bouton maison (retour à l'accueil de la collection) sur cet écran.

### Lettres et progression

- Une maison = **un son**, écrit par sa lettre (ou ses lettres : « ch » est une maison quand on y arrive, sur un seul cube).
- Ordre : voyelles **a, i, o**, puis consonnes qu'on peut tenir **m, l, s, r, f, ch**, puis **u, é, e**, puis les sons courts **p, t, b, d, n, v, j…**, puis les sons à deux lettres **ou, on, an…**
- **Version 1 : 6 maisons — a, i, o, m, l, s** (décision de l'auteur, à étendre par le seul fichier de données).

### Mots, objets, métiers

- Chaque maison : **8 à 10 mots**, chacun = un objet (image) ; la lettre y fait **son son principal**, le mot commence de préférence par elle, sinon la contient.
- Préférer des mots **courts et réguliers** (2 syllabes), dont les autres sons sont simples ; les maisons suivantes réutilisent les lettres déjà vues (lama, lime, mami…).
- Chaque mot porte son **découpage en syllabes** et en **graphèmes** (pour les cubes : « ch », « ou » = un cube).
- Chaque maison a un **métier qui commence par sa lettre** (ex. M musicien, P pompier, F fermier) : c'est la tenue du singe installé.
- La liste (lettres, mots, syllabes, graphèmes, métiers) est un **fichier de données** que l'auteur prépare et que le **parent relit** (vocabulaire belge compris) avant la fabrication des images et des sons.

### Écran de la maison (décoration)

- Intérieur de la maison avec des **places** pour les objets ; les objets gagnés sont posés à leur place (pas de placement libre dans cette version — décision de l'auteur).
- Les objets pas encore gagnés apparaissent en **silhouette** ; en toucher une lance le mini-jeu des mots pour ce mot.
- Au 4e objet gagné : le singe met sa tenue de métier (petite scène) et sera ensuite visible dehors.

### Mini-jeu des mots (le cœur)

1. **Écouter.** L'image de l'objet, le singe, et le mot écrit **découpé en syllabes de couleurs alternées** (mo | to). Elle touche une syllabe → le singe la dit. Glisser le doigt sous le mot (ou un bouton « tout le mot ») → le singe dit le mot entier. On passe à l'étape suivante quand chaque syllabe a été touchée au moins une fois.
2. **Écrire.** Des cases vides (une par graphème) et des **cubes-lettres**. **Toucher un cube → il dit son son** (« mmm », « o »). Elle glisse les cubes dans les cases, **de gauche à droite** (la case active est mise en valeur — décision de l'auteur). Un mauvais cube **revient doucement** à sa place. **Chaque syllabe complétée est dite** par le singe ; le mot complet est dit, puis l'objet « s'envole » vers la maison.
3. **Niveaux d'écriture** (par maison) :
   - **1 — recopier** : le mot modèle reste affiché au-dessus des cases ;
   - **2 — modèle caché** : le modèle s'affiche, puis se cache quand elle commence (un bouton œil le remontre) ;
   - **3 — dictée** : seulement l'image et le singe qui dit le mot (bouton pour le réentendre).
   - Cubes en trop : niveau 1 aucun ; niveau 2 un ou deux très différents ; niveau 3 des lettres proches (b/d, m/n) quand elles ont été vues.
4. **Montée des niveaux** : les 4 premiers mots d'une maison au niveau 1 ; les suivants au niveau 2 ; une fois tous les objets gagnés au niveau 2, la maison propose de refaire ses mots au niveau 3 (le singe gagne alors une petite décoration bonus — détail au constructeur).
5. Aucune limite de temps, aucun échec compté.

### Collection (maison de l'enfant)

- Une ligne par maison construite : la lettre, le singe en tenue (ou non), les objets gagnés et les **places vides** des objets restants ; les lettres pas encore construites en grisé.

### Son

- **Voix : Thomas (macOS), débit ~120**, fichiers **m4a** préparés sur le Mac par un **script du dépôt** (relançable quand on ajoute des mots).
- Trois sortes de sons : **mots entiers**, **syllabes** (tous les mots découpés), **sons de lettres/graphèmes** (cubes, présentation de la maison).
- **Sons isolés** : la synthèse **épelle** les sons tenus (« ès », « cé ache »). Technique validée au test : prendre le début d'un mot (« chut » → « ch », « sac » → « s ») et l'**allonger** à ~0,8 s, puis **vérifier par mesure** qu'il n'y a plus de voyelle. Pour les sons voisés (m, l, r) et les sons courts (p, t…), le constructeur trouve une technique équivalente ; le **parent écoute et valide chaque son isolé** sur une page de test avant l'intégration.
- Le singe « parle » : petite animation de bouche/rebond pendant la lecture d'un son.

### Images

- **Singes et objets : FLUX.1 [schnell] local**, avec des descriptions qui disent toujours que ce sont des **éléments d'un jeu éducatif pour enfants sur tablette**, un sprite isolé sur fond blanc, sans texte. Style : **dessin vectoriel plat, contours brun foncé nets, couleurs chaudes douces**.
- Singe : **yeux simples, petits et ovales, pas d'anime ni de chibi**, proportions cartoon naturelles ; **même graine (11) et même description de base pour tous les singes**, seule la tenue change (validé au test : le même singe dans 4 tenues).
- **Relecture de chaque image par le constructeur** avant de la garder : défauts déjà rencontrés — deux queues, singe assis, objet méconnaissable (melon), mauvaise couleur d'habit (pompier brun), instrument tordu (trompette). Régénérer tant que l'image n'est pas juste ; garder la graine retenue dans les données.
- Fonds blancs rendus **transparents**, images redimensionnées et compressées.
- **Terrain, maisons, cubes, boutons, icône de tuile : SVG dessinés à la main**, dans le style plat des singes.
- Style du jeu : le village a **son propre style plat**, différent du « cartoon 3D brillant » (S2) du stand et de l'accueil (décision de l'auteur : c'est le style validé au test).

### Réglages communs

- **Rythme** : multiplie les durées d'animation, les pauses entre deux paroles du singe et les transitions (calme = plus lent), comme le stand (`shared/runtime.js`).
- **Mode soir** : filtre doux sur le canvas, pas de confettis ni d'étincelles, rythme calme ; réévalué chaque minute.

### Sauvegarde et espace parent

- Sauvegarde propre au jeu (clé à lui) : maisons construites et leur emplacement, objets gagnés, niveau de chaque maison, singes installés.
- Espace parent, section **Jeux** : remise à zéro du village (via `reset` du registre).

## Licences (et ce qu'il faudrait changer si l'usage change)

| Élément | Licence | Usage actuel | Si l'usage change |
| --- | --- | --- | --- |
| **Voix Thomas (macOS)** | Contrat de licence macOS : voix utilisables pour des **projets personnels, non commerciaux** ; **enregistrer ou diffuser les voix dans un contexte de partage public, à but lucratif ou non, n'est pas permis** (texte des versions Sierra/Snow Leopard ; texte actuel à vérifier) | Jeu familial — **mais les fichiers seraient publiés sur un site public (GitHub Pages)** : point à trancher par le parent | Changer de voix : le script de génération doit pouvoir changer de voix sans autre changement (Piper avec une voix à licence ouverte vérifiée, ou voix enregistrée par le parent) |
| FLUX.1 [schnell] | Apache 2.0 (poids du modèle) ; images produites sans restriction | Libre | Rien à changer, même en usage commercial |
| mflux (outil) | MIT | Outil local, non distribué | Rien |
| Piper (non retenu) | Moteur MIT ; chaque voix a sa licence (siwis : CC BY 4.0 annoncé, contesté par des sites tiers ; upmc, tom : non vérifiées) | — | Vérifier la licence de la voix avant usage |
| Dessins SVG | CC0, faits pour le projet | Libre | Rien |

Un fichier `jeux/village-singes/ASSETS-LICENSES.md` liste chaque image (outil, graine, description) et chaque son (voix, outil).

## Laissé au constructeur

- Mise en page exacte des écrans, animations du singe, petite scène de mise en tenue.
- La liste de mots, de syllabes et de métiers des 6 premières lettres (selon les règles ci-dessus), à faire relire au parent.
- Technique des sons isolés voisés et courts ; page de validation des sons pour le parent.
- Outil de détourage des fonds blancs (licence libre vérifiée), formats et tailles des fichiers.
- Récompense bonus du niveau 3.
- Fréquence des bulles de demande des singes.
- Tests : logique pure (progression, niveaux, choix des cubes en trop, sauvegarde, découpage des mots cohérent avec les fichiers son/image) ; le test du registre couvre l'ajout du jeu ; le script de partie automatique (`tests/e2e`) parcourt une maison.

## Sources

- Référentiel des compétences initiales (FWB) : https://ifpc.cfwb.be/v5/documents/tc/refRCI.pdf
- Étude GraphoGame en maternelle, Frontiers in Psychology 2021 : https://www.frontiersin.org/articles/10.3389/fpsyg.2021.720548/endNote
- Guide GraphoGame (EEF) : https://www.cne.psychol.cam.ac.uk/files/graphogame_eef_teachers_handbookoct2018.pdf
- Guide phonologie (eduscol) : https://eduscol.education.fr/document/13870/download
- Licence macOS (voix système, Sierra) : https://www.apple.com/legal/sla/docs/macOS1012TouchID.pdf
- FLUX.1 [schnell] : https://together.ai/models/flux-1-schnell
