# Pêche et cuisine — pêche au lancer et combat (refonte de la phase Pêche)

Date : 2026-11-26. Modifie la phase Pêche de `2026-11-26-peche-cuisine-design.md` (geste de la canne en bambou). Taille : changement moyen (une scène réécrite + un module de logique).

## Intention

Rapprocher la pêche du plaisir des mini-jeux de pêche type Zelda. La personne à l'origine du projet veut retrouver deux moments : **le poisson qui s'approche** (l'attente) et **le combat pour le remonter**. Le lancer est un moment facile.

## Objectifs

- Séquence : **lancer → approche → ferrer → combat → poisson ramené**.
- Combat **tenir / relâcher** ; si elle force pendant que le poisson se débat, **la ligne casse et le poisson s'échappe**.
- Le combat dépend de la **taille** du poisson (annonce son poids avant la pesée).

## Non-objectifs

- Pas de changement de la liste de pêche, de la pesée, de la cuisine ni des niveaux.
- Pas de nouvelle canne (moulinet, épuisette : lot 3, ils pourront reprendre ce combat avec leur geste).
- Pas de son.

## Anti-objectifs

- Un lancer qui demande de la précision.
- Un combat frustrant (fenêtres trop courtes, ligne qui casse sans prévenir) ou gagné d'avance (on peut tenir tout le temps).
- Une punition : une ligne cassée ne coûte ni pièce ni erreur.

## Décisions (de la personne à l'origine du projet)

- Moments gardés : approche + combat. Combat = tenir pour remonter, lâcher quand il se débat. Forcer trop longtemps → la ligne casse, le poisson s'échappe, elle relance.
- Approche A (ci-dessous).

## Propositions de l'auteur (validées dans la conversation)

1. **Lancer** : toucher l'eau là où elle veut ; le bouchon y tombe. Aucune précision demandée. (Toucher hors de l'eau : rien.)
2. **Approche** : seuls les poissons **proches du bouchon** le remarquent (rayon fixe) ; le plus proche vient lentement vers l'appât, tourne, donne **0 à 2 fausses touches** (le bouchon frémit), puis **mord** (le bouchon s'enfonce, gros « plouf »). Aucun poisson proche : un poisson finit par venir au bout d'un moment (jamais d'attente infinie).
3. **Ferrer** : toucher pendant que le bouchon est enfoncé, fenêtre large (~1,5 s, × rythme). Trop tôt (pendant une fausse touche) ou trop tard : le poisson repart, aucune pénalité.
4. **Combat** : doigt appuyé = la ligne remonte (le poisson s'approche du bord). Le poisson **se débat** par moments (il s'agite, éclaboussures) ; tenir pendant qu'il se débat fait monter la **tension** ; la ligne passe blanc → orange → rouge et la canne se plie ; au-delà d'environ **1 s de tension (× rythme calme)**, la ligne **casse** (« clac »), le poisson repart dans l'étang, le bouchon revient. Lâcher fait redescendre la tension. Hors des moments où il se débat, tenir ne fait jamais casser.
5. **Taille** : petit = se débat rarement, court, peu de distance ; grand = plus souvent, plus longtemps, plus de distance.
6. **Observation** : elle voit quel poisson approche ; s'il n'est pas dans la liste elle peut ne pas ferrer. Remonté quand même : comme aujourd'hui (croix, remis à l'eau, point de la pêche raté).
7. **Niveaux** : le combat est le même à tous les niveaux ; seul le rythme (réglage parent) le ralentit.
8. La canne de départ (bambou) prend ce geste.

## Approches

- **Retenue — A : moteur de pêche pur + scène d'affichage.** Un module `src/logic/` sans Phaser (machine à états : attente → approche → fausses touches → morsure → combat → ramené / cassé / échappé ; tension, distance, crises « se débat » selon la taille), avec tous les réglages regroupés. La scène `FishingScene` est réécrite pour lancer, afficher et transmettre « doigt appuyé / relâché ». Tests par simulation de trois joueurs : *tient tout le temps* (casse sur un grand), *lâche au signal* (ramène tout), *hésitant* (y arrive, plus lentement).
- Écartée — B : tout dans la scène (minuteries Phaser) : impossible à tester, réglages du ressenti seulement en jouant.
- Écartée — C : prototype jetable d'abord : A permet déjà de régler en jouant.

## Contraintes

Celles de la collection : tablette, ≥ 96 px, pas de texte, ≤ 60 particules, rythme et mode soir, aucune dépendance, jeu indépendant (rien d'importé du stand, `shared/` intact). Version du cache à augmenter.

## Laissé au constructeur

Valeurs exactes des réglages (rayon d'attention, durées, fréquence et durée des crises par taille, vitesse de remontée), forme du module (pas de temps fixe ou basé sur le temps écoulé), dessins provisoires du bouchon, de la ligne et de la canne qui se plie ; une séance de réglage dans le navigateur à la fin.
