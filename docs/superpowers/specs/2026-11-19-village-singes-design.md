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
2. Une maison = une lettre (son principal), présentée par le singe (« le m fait mmm »).
3. Le mini-jeu des mots : **écouter** (toucher les syllabes, le singe les dit), puis **écrire** (remettre des cubes-lettres dans l'ordre, chaque cube dit son son, chaque syllabe finie est dite).
4. Chaque mot réussi débloque un objet à placer dans la maison ; ~4 objets installent le singe ; 8 à 10 objets par maison pour revenir.
5. **3 niveaux de difficulté progressifs** dans l'écriture (recopier → modèle caché → dictée), qui montent quand l'enfant revient dans une maison.
6. La **révision** : les mots des nouvelles maisons mélangent les lettres déjà vues ; les singes font des demandes d'objets des anciennes maisons.
7. Une **collection** (dans la maison de l'enfant) : lettres apprises, objets gagnés, emplacements vides pour ce qui reste.
8. Le jeu applique toutes les règles communes de la collection (rythme, mode soir, 3 niveaux).

## Non-objectifs

- Pas de tracé de lettres au doigt : « écrire » = choisir et ordonner des cubes-lettres.
- Pas de lecture de phrases ni de textes.
- Pas de monnaie ni de boutique (la récompense, ce sont les objets et le singe).
- Pas de réglage manuel de la difficulté par le parent dans cette version (les niveaux montent seuls).
- Pas de voix de synthèse de la tablette pendant le jeu (indisponible dans Chrome sur la tablette du test).
- Pas d'images générées par IA dans cette version (testées, écartées par le parent — voir Approches).
- Pas de mots à lettres muettes dans la version 1 (« lime », « lit », « riz »).

## Anti-objectifs

- Une aide qui lit ou compte à la place de l'enfant (même principe que le stand).
- Un mot où la lettre de la maison ne fait **pas** son son principal (« chat » dans la maison c, « ananas » pour le son [a]).
- Un découpage qui n'est pas en **syllabes** (« ch » seul n'est jamais présenté comme une syllabe ; les sons isolés n'existent que pour une lettre : la porte d'une maison, un cube).
- Punir l'erreur : pas de croix rouge, pas de compteur d'échecs, pas de perte.
- Du texte nécessaire à l'enfant en dehors des lettres et mots qu'elle apprend (consignes par la voix et l'image).
- Un style « mignon » : grands yeux noirs brillants, reflets, joues roses.
- Des éléments interactifs qui ne se détachent pas visuellement (une porte qu'on ne distingue pas du mur).

## Contraintes

- Celles de la collection (spec `2026-11-19-accueil-collection-design.md`) : tablette Android, **Chrome**, paysage, PWA hors ligne, GitHub Pages (**dépôt public**), chemins relatifs, pas de npm, Phaser 3.90.0 embarqué, stockage local uniquement, registre des jeux, bouton maison.
- Tout le son est **préparé à l'avance** sur le Mac du parent et livré comme fichiers ; rien n'est généré sur la tablette.
- Tout ce qui est publié (sons, images) doit avoir une licence qui permet la **diffusion publique**.
- Taille : le jeu est mis en cache hors ligne ; viser des fichiers légers (audio AAC/m4a courts, SVG).

## Nouvelle règle de la collection : 3 niveaux

Décision du parent : **chaque jeu de la collection a 3 niveaux de difficulté progressifs**, comme il applique le rythme et le mode soir. Le registre le déclare (par exemple `SUPPORTS` gagne `'niveaux'`) et `tests/registry.test.js` le vérifie. Le village l'applique dès sa création. **Le stand de desserts n'a pas encore de niveaux : c'est un chantier à part, à concevoir après le village** ; d'ici là, le contrôle du registre doit tolérer le stand (exception nommée et datée) ou la règle n'entre en vigueur qu'avec ce chantier — choix au constructeur, sans casser le stand.

## Approches

### Structure (une seule voie raisonnable)

Un jeu `jeux/village-singes/` en **Phaser**, comme le stand : son `collection.js` (ID, NAME, CATEGORY, SUPPORTS, PRECACHE, reset), ses scènes, sa logique pure testée, son fichier de données. Les alternatives (pages HTML/CSS seules, autre moteur) ne réutiliseraient ni le moteur ni les habitudes du stand.

### Son — choisi : fichiers préparés, voix Chatterbox

Tests comparatifs faits sur la tablette (15 sons et syllabes) :
- Voix de la tablette — écartée : absente du Chrome de la tablette.
- Voix du Mac (Thomas, la plus claire) — écartée : la licence macOS **interdit de diffuser ces voix dans un contexte de partage public**, or le site est public.
- Piper — écarté (moins clair ; licences des voix incertaines).
- Kokoro (Apache 2.0), Qwen3-TTS (Apache 2.0), **Chatterbox (MIT)** — **Chatterbox retenu par le parent** (le meilleur à l'écoute ; c'est aussi le seul qui prononce un vrai « ch » soufflé). Chatterbox imite une voix de référence : narratrice d'après Kokoro, singe d'après une voix créée avec Qwen3 (voir Son).

### Images — choisi : SVG dessinés à la main, en pièces

Tests faits :
- FLUX.1 schnell (texte → image) : objets réussis, mais singe « mignon », défauts fréquents (deux queues, mauvaises couleurs), pas animable.
- SVG dessiné à la main **repassé** par FLUX ou Z-Image-Turbo : FLUX n'apporte presque rien (et rajoute des joues roses) ; Z-Image « fort » (0,3) a le plus beau rendu, et un découpage en images-clés a été prouvé possible (poses du modèle + bouche/paupières redessinées par-dessus), mais demande beaucoup de travail et de vérification par image.
- **Retenu par le parent : les SVG dessinés à la main**, dans la direction validée, en pièces séparées animables. Les outils restent installés pour plus tard (`~/tools/flux-local/flux.sh`, `zimage.sh`).

## Décisions

### Village (écran terrain)

- En bas : la **maison de l'enfant** avec son **avatar** (celui du profil de la collection, `shared/avatar.js`). La toucher ouvre la **collection**.
- Sur le terrain : des **emplacements** de maison (autant que de lettres de la version). Un emplacement libre touché → la maison de **la lettre suivante de la progression** apparaît (**ordre fixe** — décision de l'auteur : les listes de mots peuvent compter sur les lettres déjà vues), avec la lettre sur la porte → un singe arrive et montre la lettre, **la narratrice** dit son son (« mmm »).
- Les singes installés se promènent **en tenue de métier** autour de leur maison.
- De temps en temps, un singe montre une **bulle avec l'image d'un objet** pas encore gagné d'une maison déjà construite (invitation à y retourner). Sans objet restant, pas de bulle.
- Bouton maison (retour à l'accueil de la collection) sur cet écran.

### Lettres et progression

- Une maison = **un son**, écrit par sa lettre (ou ses lettres : « ch » est une maison quand on y arrive, sur un seul cube).
- Ordre : voyelles **a, i, o**, puis consonnes qu'on peut tenir **m, l, s, r, f, ch**, puis **u, é, e**, puis les sons courts **p, t, b, d, n, v, j…**, puis les sons à deux lettres **ou, on, an…**
- **Version 1 : 6 maisons — a, i, o, m, l, s** (décision de l'auteur, à étendre par le seul fichier de données).

### Forme des lettres (décision du parent)

- **Minuscules d'imprimerie partout** (cubes, mots, syllabes, collection) : c'est la forme qu'elle lira à l'école.
- **Sur la porte de la maison : la capitale à côté de la minuscule** (« M m »), pour faire le lien avec ce qu'elle sait déjà écrire.
- Police : une police scolaire lisible (a et g « d'imprimerie » à un seul étage de préférence), **embarquée** pour le hors-ligne, licence libre vérifiée (OFL par exemple) — choix précis au constructeur.

### Mots, objets, métiers

- Chaque maison : **8 à 10 mots**, chacun = un objet (image) ; la lettre y fait **son son principal**, le mot commence de préférence par elle, sinon la contient.
- Préférer des mots **courts et réguliers** (2 syllabes), **sans lettre muette** (version 1) ; les maisons suivantes réutilisent les lettres déjà vues (lama, mamie…).
- Chaque mot porte son **découpage en syllabes** et en **graphèmes** (pour les cubes : « ch », « ou » = un cube).
- Chaque maison a un **métier qui commence par sa lettre** (ex. m musicien, p pompier, f fermier) : c'est la tenue du singe installé.
- La liste (lettres, mots, syllabes, graphèmes, métiers) est un **fichier de données** que l'auteur prépare et que le **parent relit** (vocabulaire belge compris) avant la fabrication des dessins et des sons.

### Écran de la maison (décoration)

- Intérieur de la maison avec des **places** pour les objets ; les objets gagnés sont posés à leur place (pas de placement libre dans cette version — décision de l'auteur).
- Les objets pas encore gagnés apparaissent en **silhouette** ; en toucher une lance le mini-jeu des mots pour ce mot.
- Au 4e objet gagné : le singe met sa tenue de métier (petite scène) et sera ensuite visible dehors.

### Mini-jeu des mots (le cœur)

1. **Écouter.** L'image de l'objet, le singe, et le mot écrit **découpé en syllabes de couleurs alternées** (mo | to). Elle touche une syllabe → le singe la dit. Glisser le doigt sous le mot (ou un bouton « tout le mot ») → le singe dit le mot entier. On passe à l'étape suivante quand chaque syllabe a été touchée au moins une fois.
2. **Écrire.** Des cases (une par graphème) et des **cubes-lettres**.
   - **Les lettres qu'elle n'a pas encore apprises sont déjà posées dans leur case, en gris** (décision du parent) ; elle ne place que les cubes des lettres apprises (au début 1 ou 2 cubes par mot, de plus en plus ensuite). Les sons à fabriquer restent limités aux lettres de la progression.
   - **Toucher un cube → la narratrice dit son son** (« mmm », « o ») — même fichier que la présentation de la lettre sur la porte (décision de l'auteur : un son de lettre = toujours la même voix).
   - Elle glisse les cubes dans les cases, **de gauche à droite** (la case active est mise en valeur — décision de l'auteur). Un mauvais cube **revient doucement** à sa place.
   - **Chaque syllabe complétée est dite** par le singe ; le mot complet est dit, puis l'objet « s'envole » vers la maison.
3. **Les 3 niveaux d'écriture** (par maison) :
   - **1 — recopier** : le mot modèle reste affiché au-dessus des cases ;
   - **2 — modèle caché** : le modèle s'affiche, puis se cache quand elle commence (un bouton œil le remontre) ;
   - **3 — dictée** : seulement l'image et le singe qui dit le mot (bouton pour le réentendre).
   - Cubes en trop : niveau 1 aucun ; niveau 2 un ou deux très différents ; niveau 3 des lettres proches (b/d, m/n) quand elles ont été vues.
4. **Montée des niveaux** : les 4 premiers mots d'une maison au niveau 1 ; les suivants au niveau 2 ; une fois tous les objets gagnés au niveau 2, la maison propose de refaire ses mots au niveau 3 (le singe gagne alors une petite décoration bonus — détail au constructeur).
5. Aucune limite de temps, aucun échec compté.

### Collection (maison de l'enfant)

- Une ligne par maison construite : la lettre, le singe en tenue (ou non), les objets gagnés et les **places vides** des objets restants ; les lettres pas encore construites en grisé.

### Son

- **Deux voix (décision du parent)** : une **narratrice** (femme) et **le singe** (jeune garçon).
- **Moteur : Chatterbox multilingue** (`mlx-community/chatterbox-multilingual-v3`, licence MIT), langue `fr`, lancé en local par `mlx-audio` (installé dans `~/tools/tts-local`). Chatterbox imite la voix d'un court extrait de référence :
  - **narratrice** : extrait lu par la voix française **ff_siwis de Kokoro** (Apache 2.0), elle-même issue de la *SIWIS French Speech Synthesis Database* (CC BY 4.0 : **attribution obligatoire**, voir Licences). Choisie par le parent à l'écoute (la voix créée par Qwen3 avait un accent chinois) ;
  - **singe** : extrait créé avec **Qwen3-TTS VoiceDesign** (Apache 2.0) à partir d'une description (« jeune garçon français natif de 8 ans, enjoué et curieux, voix aiguë, parle lentement en détachant chaque syllabe ») — voix entièrement synthétique, aucune personne réelle imitée. Choisie par le parent (« référence lente », sans ralentissement après coup).
  - Les deux extraits sont dans le dépôt : `docs/superpowers/specs/village-singes-prototypes/voix-reference-narratrice.wav` et `voix-reference-singe.wav` (le constructeur les range à côté du script de génération). Une génération avec Qwen3 échoue en silence quand sa sortie est redirigée vers `/dev/null` : garder la sortie lue (pipe).
- Ralentir après coup reste possible si besoin (étirement sans changer la hauteur, `audiotsm`, MIT) ; le réglage `--speed` de Chatterbox n'a aucun effet, pour que toutes les générations futures aient la même voix.
- Fichiers **m4a**, préparés par un **script du dépôt** (relançable quand on ajoute des mots).
- **Qui dit quoi (décision du parent, option B)** :
  - **la narratrice** : les consignes (phrases courtes, toujours accompagnées d'une image ou d'un geste), le **son de la lettre** quand une maison la reçoit, et le **son de chaque cube** ;
  - **le singe** : **toutes les syllabes et tous les mots** (c'est lui qui « lit » ce que l'enfant lui montre), et ses réactions (« Super ! », remerciements).
- Trois sortes de sons : **mots entiers** et **syllabes** (voix du singe), **sons de lettres/graphèmes** (voix de la narratrice), plus les **consignes** (narratrice) et les **réactions** (singe).
- **Sons isolés** : les voix de synthèse ont tendance à **épeler** (« ès », « cé ache »). Chatterbox a produit un vrai « ch » au test ; pour les autres, technique validée : prendre le début d'un mot (« sac » → « s ») et l'**allonger** à ~0,8 s, puis **vérifier par mesure** qu'il n'y a plus de voyelle. Sons voisés (m, l, r) et courts (p, t…) : technique équivalente au constructeur. Le **parent écoute et valide chaque son isolé** sur une page de test avant l'intégration.
- Quand le singe parle : bouche qui s'ouvre et se ferme, petit mouvement de tête. La narratrice n'a pas de personnage à l'écran (voix seule).

### Dessins (SVG à la main)

- **Direction validée par le parent** (d'après une image de référence de son choix, utilisée seulement comme direction, jamais copiée — elle est sous droits) : singe aux **proportions naturelles**, **yeux blancs avec une pupille noire** (regard de côté possible), **pas de reflets ni de joues roses**, masque du visage clair avec museau et narines, **contour noir épais**, **mèches de pelage**, **ombrage brun plus foncé** (cel shading).
- **Tout ce qui s'anime ou se touche est une pièce séparée**, avec son propre contour et une ombre ou un espace qui la détache :
  - singe : tête, bouche (fermée / ouverte), paupières, pupilles, bras (pivot à l'épaule), jambes, queue ; tenues de métier = calques par-dessus le même singe ;
  - cabane : toit (ombre portée sur le mur), murs, porte (charnière, intérieur sombre derrière), volets, panneau de la lettre (se balance), échelle, pilotis.
- Prototypes de référence : `docs/superpowers/specs/village-singes-prototypes/` — `v2/singe.svg`, `v2/cabane.svg` et `anim.html` (clignement, parole, coucou, porte, volets, panneau ; à ouvrir via un petit serveur local).
- Objets des mots, terrain, boutons, cubes, tuile de catégorie : même style.
- Le village a **son propre style** (contour noir épais, ombrage plat), différent du « cartoon 3D brillant » (S2) du stand et de l'accueil — décision de l'auteur ; la tuile de catégorie sur l'accueil reste dans le style S2 de l'accueil.

### Réglages communs

- **Rythme** : multiplie les durées d'animation, les pauses entre deux paroles du singe et les transitions (calme = plus lent), comme le stand (`shared/runtime.js`).
- **Mode soir** : filtre doux sur le canvas, pas de confettis ni d'étincelles, rythme calme ; réévalué chaque minute.
- **Niveaux** : ceux du mini-jeu des mots (ci-dessus).

### Sauvegarde et espace parent

- Sauvegarde propre au jeu (clé à lui) : maisons construites et leur emplacement, objets gagnés, niveau de chaque maison, singes installés.
- Espace parent, section **Jeux** : remise à zéro du village (via `reset` du registre).

## Licences (et ce qu'il faudrait changer si l'usage change)

| Élément | Licence | Usage actuel | Si l'usage change (commercial, diffusion large) |
| --- | --- | --- | --- |
| Chatterbox multilingue (moteur des deux voix) | MIT | Sons du jeu, publiés | Rien à changer |
| Kokoro ff_siwis (référence de la narratrice) | Apache 2.0 (modèle) | Création de la voix | Rien à changer |
| SIWIS French Speech Synthesis Database (données derrière ff_siwis) | CC BY 4.0 d'après la fiche Kokoro — licence d'utilisation de la base à vérifier | Voix de la narratrice | **Attribution obligatoire** dans `ASSETS-LICENSES.md` et les crédits : Yamagishi, Honnet, Garner, Lazaridis, *The SIWIS French Speech Synthesis Database*, University of Edinburgh (CSTR), 2017, https://doi.org/10.7488/ds/1705. La voix imite une locutrice réelle (enregistrements publiés pour la synthèse vocale) : si l'usage s'élargit, revérifier la licence de la base ou passer à une voix entièrement synthétique |
| Qwen3-TTS VoiceDesign (référence du singe) | Apache 2.0 | Création de la voix | Rien à changer |
| mlx-audio (outil) | MIT | Outil local, non distribué | Rien |
| Dessins SVG | CC0, faits pour le projet | Publiés | Rien |
| Police embarquée | OFL ou équivalent (à vérifier) | Publiée | Rien si OFL |
| *Non retenus, pour mémoire :* voix macOS (Thomas) | Contrat macOS : usage personnel, **pas de diffusion publique** | — | Interdite sur un site public |
| *Non retenus :* FLUX.1 schnell, Z-Image-Turbo | Apache 2.0 | — | Utilisables si on y revient |
| *Non retenus :* Kokoro | Apache 2.0 (données CC BY 4.0 : citer SIWIS) | — | Utilisable avec attribution |

Un fichier `jeux/village-singes/ASSETS-LICENSES.md` liste chaque dessin et chaque son (outil, voix, licence).

## Laissé au constructeur

- Mise en page exacte des écrans, animations du singe, petite scène de mise en tenue.
- La liste de mots, de syllabes et de métiers des 6 premières lettres (selon les règles ci-dessus), à faire relire au parent.
- Technique des sons isolés voisés et courts ; page de validation des sons pour le parent.
- La police (licence libre vérifiée).
- Récompense bonus du niveau 3 ; fréquence des bulles de demande des singes.
- Comment la règle des 3 niveaux entre dans le registre sans casser le stand (voir plus haut).
- Tests : logique pure (progression, niveaux, cubes pré-posés et cubes en trop, sauvegarde, cohérence entre découpage des mots et fichiers son/dessin) ; le test du registre couvre l'ajout du jeu ; le script de partie automatique (`tests/e2e`) parcourt une maison.

## Sources

- Référentiel des compétences initiales (FWB) : https://ifpc.cfwb.be/v5/documents/tc/refRCI.pdf
- Étude GraphoGame en maternelle, Frontiers in Psychology 2021 : https://www.frontiersin.org/articles/10.3389/fpsyg.2021.720548/endNote
- Guide GraphoGame (EEF) : https://www.cne.psychol.cam.ac.uk/files/graphogame_eef_teachers_handbookoct2018.pdf
- Guide phonologie (eduscol) : https://eduscol.education.fr/document/13870/download
- Licence macOS (voix système, Sierra) : https://www.apple.com/legal/sla/docs/macOS1012TouchID.pdf
- Chatterbox : https://github.com/resemble-ai/chatterbox
- Qwen3-TTS VoiceDesign : https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
