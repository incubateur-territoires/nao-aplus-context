# Golden dataset — prochaines étapes

État au 8 septembre 2026 : le corpus de 100 signalements pseudonymisés est figé,
et presque tous les annotateurs ont posé leurs deux tags (blocage, démarche) en
texte libre. Des runs exploratoires de plusieurs modèles ont tourné sur le même
corpus, à l'aveugle, sans voir nos réponses. La suite se joue en trois étapes,
puis une stratégie d'évaluation qui vaut pour toutes les suivantes.

## Étape 1 — La réunion d'adjudication

On se met ensemble devant la page de résultats, qui affiche pour chaque
signalement les tags de chaque annotateur côte à côte. Pour chacun des 100
signalements, trois cas :

- **Même chose.** On clique le tag, il devient le label de référence, on passe.
- **Même chose avec des mots différents** (« retard CPAM » vs « retard de
  traitement »). Pas un désaccord : on choisit la meilleure formulation et on
  note l'équivalence, elle servira à construire la taxonomie.
- **Vraie divergence de lecture.** On en discute et on tranche. Si on n'arrive
  pas à trancher, c'est une information en soi : le signalement est ambigu, et
  on le note comme tel plutôt que de forcer un label.

Avant de fusionner quoi que ce soit, on mesure notre taux d'accord brut entre
annotateurs, axe par axe. Ce chiffre est le plafond de l'exercice : si nous,
humains qui connaissons le métier, sommes d'accord à 75 %, on ne reprochera pas
à un modèle de ne pas faire 95 %. C'est la mesure d'ambiguïté de la tâche, et
elle se calcule une fois pour toutes sur les annotations libres, avant
harmonisation.

Sortie de l'étape : un label de référence par axe sur chacun des 100
signalements (le « gold »), et le taux d'accord humain qui servira de point de
comparaison.

## Étape 2 — La taxonomie fermée

À partir de tout ce qu'on a écrit en texte libre — et en regardant ce que les
runs exploratoires ont proposé spontanément, comme source d'inspiration mais pas
de décision — on dégage une liste fermée de tags par axe. Règles de
construction :

- Une dizaine à une vingtaine de tags par axe. Au-delà, les tags rares ne
  seront jamais mesurables sur 100 exemples.
- Chaque tag couvre au moins trois signalements du corpus. Un tag qui n'en
  couvre qu'un est une description, pas une catégorie.
- Les tags d'un même axe s'excluent mutuellement : un signalement ne doit pas
  pouvoir hésiter entre deux tags de la liste. Si deux tags se recouvrent, on
  les fusionne ou on redéfinit la frontière.
- On garde un tag « autre » par axe, et la possibilité de répondre « inconnu ».
  Sans exutoire, tout ce qui ne rentre pas déforme les autres catégories.
- Chaque tag reçoit une définition d'une ligne et un ou deux exemples. Ce guide
  d'annotation est le livrable : c'est lui qu'on donnera au modèle, et c'est lui
  qui permettra d'annoter les prochains corpus de façon cohérente.

On reprojette ensuite les 100 labels de référence sur la liste fermée. C'est le
golden dataset v1 : 100 signalements, deux tags fermés chacun, figé. Toute
modification ultérieure de la liste crée une v2, on ne retouche pas une version
sur laquelle des scores ont été publiés.

## Étape 3 — L'évaluation d'Albert en liste fermée

On fait passer le test à Albert : les mêmes 100 signalements, en choisissant
dans notre liste, sans jamais voir nos réponses. Techniquement c'est une
nouvelle consigne, donc une nouvelle série de prédictions — le schéma identifie
déjà une série par sa recette (modèle, hash des prompts, température), les runs
en texte libre et en liste fermée coexistent sans se mélanger.

Et on mesure : combien de fois il tombe juste, et quels types de situations il
rate. Le détail de la mesure est la section suivante.

## Stratégie d'évaluation

### Deux conditions, mesurées séparément

Le texte libre mesure l'alignement spontané : le modèle, sans liste, propose-t-il
les mêmes catégories que nous ? La liste fermée mesure la tâche réelle du
produit. Les deux sont utiles, mais leurs scores ne se comparent pas entre eux.

### Le gold, et une lecture indulgente en secours

Le score principal se calcule contre le label adjugé en réunion, pas contre un
vote majoritaire : l'adjudication a précisément servi à trancher les cas où la
majorité se trompe ou n'existe pas. On garde en score secondaire une lecture
indulgente — le modèle est compté juste s'il rejoint au moins un des
annotateurs — qui distingue « le modèle a une lecture défendable » de « le
modèle est à côté ».

### La règle d'équivalence est écrite, et symétrique

En liste fermée, la correspondance est exacte : même tag ou pas. En texte libre,
toute canonicalisation (synonymes, accents, pluriels) s'applique identiquement
aux réponses humaines et aux réponses du modèle, sinon on mesure la table de
synonymes autant que le modèle. Cette règle est déjà celle du code, elle vaut
aussi pour les analyses à la main.

### Les métriques

Par axe : exactitude stricte contre le gold, exactitude indulgente, et — dès que
la liste fermée existe — précision, rappel et F1 par tag, avec la matrice de
confusion. La matrice répond à la question qui compte : quels types de
situations il rate, et avec quoi il les confond.

Le comportement d'abstention se mesure à part : à quelle fréquence le modèle
répond « inconnu », et est-ce sur les signalements que nous-mêmes avons trouvés
indéterminables ? Un modèle qui ne s'abstient jamais sur des cas ambigus est
suspect, autant qu'un modèle qui s'abstient trop.

Les scores se découpent par organisme (les strates de l'échantillon existent
déjà), par tag, et par longueur de description, pour repérer les faiblesses
systématiques plutôt qu'un score moyen qui les masque.

### Un jeu de mise au point, un jeu de test

Cent exemples ne pardonnent pas l'itération : si on ajuste la consigne dix fois
en regardant le score sur les 100, le score final décrit notre consigne
sur-ajustée, pas le modèle. On réserve donc un sous-ensemble de mise au point
(environ 30 signalements, tirés selon les strates existantes pour rester
représentatif) sur lequel on itère librement sur la consigne, et le score
publié se calcule une seule fois par recette sur les 70 restants.

### L'honnêteté statistique

Sur 70 items de test, l'intervalle de confiance d'une exactitude est de l'ordre
de ±10 points. Deux modèles à 68 % et 74 % sont indistinguables ; on le dit, et
on ne classe pas les modèles sur des écarts que l'échantillon ne peut pas
établir. Ce qu'on peut établir : si un modèle atteint ou non le voisinage du
plafond humain, et quels tags il rate systématiquement.

### Le cycle de vie

Le golden dataset v1 est figé et versionné. Tout changement futur — de modèle,
de consigne, de température — repasse l'évaluation avant d'aller en production,
et la recette qui identifie chaque série rend les comparaisons rejouables. Quand
le tagage tournera en production, un second corpus tiré plus tard servira à
mesurer la dérive : le premier réflexe d'un dataset figé est de vieillir.

## Ce que ça implique côté code

Dans l'ordre où on en aura besoin :

1. Calcul du taux d'accord inter-annotateurs sur la page de résultats (avant la
   réunion, pour arriver avec le chiffre).
2. Saisie de la taxonomie fermée et reprojection des labels de référence
   (pendant ou juste après la réunion).
3. Variante « liste fermée » de la consigne de prédiction — nouvelle recette,
   même script, même garde de cécité.
4. Vue de scoring : exactitudes, F1 par tag, matrice de confusion, découpes par
   strate, séparation mise au point / test.
