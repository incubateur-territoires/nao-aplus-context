# Golden dataset : où on en est, ce qui reste

Document de référence pour l'équipe. Il explique pourquoi on construit ce
jeu de données, ce qui est fait, et ce qui reste à faire, dans l'ordre.

## Pourquoi

On veut savoir, chiffres à l'appui, si Albert peut étiqueter seul les
signalements, et sur quels types de situations on peut lui faire confiance.

Chaque signalement reçoit deux étiquettes :

- **Blocage** : la cause concrète qui empêche la situation d'avancer
  (exemple : « perte d'accès à la messagerie »).
- **Démarche** : la prestation ou la procédure concernée (exemple : « RSA »).

Ces étiquettes serviraient à filtrer les signalements et à produire des
statistiques : quels blocages reviennent le plus, sur quelles prestations,
chez quel organisme. Étiqueter à la main des milliers de signalements n'est
pas tenable. Avant de confier la tâche à Albert, il faut mesurer sa fiabilité
sur des cas dont on connaît la bonne réponse. C'est le rôle du golden
dataset : un corrigé.

## Les trois niveaux d'étiquettes

C'est le point qui prête le plus à confusion.

| Niveau                       | Ce que c'est                                            | Combien                                                      | Où c'est stocké           |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ | ------------------------- |
| Annotations                  | Les étiquettes de chaque annotateur, prises séparément  | 168 libellés de blocage, 316 de démarche                     | `GoldenDatasetAnnotation` |
| Libellés de référence        | L'étiquette retenue par l'équipe en réunion, un par axe | 16 de blocage (plus « inconnu »), 46 de démarche             | `GoldenDatasetItem`       |
| Catégories (liste fermée v1) | Un regroupement des libellés de référence               | 11 de blocage, 16 de démarche, plus « autre » et « inconnu » | `GoldenDatasetGold`       |

Les catégories ne remplacent pas les libellés : elles les rangent, comme des
dossiers rangent des fichiers. Chaque libellé appartient à une seule
catégorie. Par exemple, « demande CEAM » et « demande carte vitale » sont
toutes deux dans la catégorie « carte vitale ».

Pourquoi deux niveaux : un score par étiquette n'a de sens qu'à partir de
3 signalements. Sur les 62 libellés de référence, 34 n'apparaissent qu'une
fois et 7 deux fois. Les catégories rendent chaque étiquette mesurable ; les
libellés gardent le détail. Les deux sont conservés, et Albert sera évalué
sur les deux.

## Ce qui est fait

1. **Le corpus.** 100 signalements réels, caviardés (les données
   personnelles sont retirées), recopiés dans une table à part pour survivre
   à la suppression automatique des signalements.
2. **L'annotation.** 5 annotateurs ont étiqueté les 100 signalements, sans
   voir les réponses des autres.
3. **La mesure de l'accord humain.** En comparant les mots exacts, les
   annotateurs ne tombent d'accord que dans 7 % des cas environ. Ce chiffre
   mesure surtout la variété du vocabulaire, pas un désaccord de fond : c'est
   ce qui a justifié la liste fermée.
4. **La réunion d'adjudication.** Pour chaque signalement et chaque axe,
   l'équipe a retenu un libellé de référence. 52 signalements sont jugés
   « inconnu » sur l'axe blocage : le texte ne permet pas de trancher.
5. **La liste fermée v1.** Les libellés de référence ont été regroupés en
   catégories, avec une définition et des exemples pour chacune. Les
   regroupements discutables ont été arbitrés (par exemple, la CEAM rejoint
   la carte vitale ; sept démarches de l'assurance maladie forment la
   catégorie « prestations maladie »).
6. **Le gel de la v1 (24 septembre 2026).** La catégorie de chaque
   signalement est écrite une fois pour toutes. Les 100 signalements sont
   classés. Toute modification ultérieure de la liste créera une v2 : on ne
   retouche pas une version sur laquelle des scores seront publiés.
7. **Les consignes pour Albert.** Le script de prédiction sait faire
   travailler Albert de trois façons, chacune formant une série de résultats
   distincte :
   - en texte libre, comme les annotateurs au départ ;
   - avec le menu des 27 catégories ;
   - avec le menu des 62 libellés, rangés par catégorie. La catégorie se
     déduit alors du libellé choisi, ce qui donne deux scores d'un coup.

   Dans tous les cas, Albert ne voit jamais les réponses de l'équipe.

8. **Le tirage 30 / 70 (24 septembre 2026).** 30 signalements de mise au
   point, répartis par organisme, et 70 d'examen. Le tirage est calculé par
   le code à partir d'une graine fixe (`src/utils/golden-dataset-split.ts`) :
   rien n'est stocké, et le même corpus donne toujours le même tirage.
9. **L'évaluation, en local.** Elle ne passe ni par la base ni par un
   déploiement. On exporte en CSV les trois tables du golden dataset dans
   `.golden-dataset/` (ignoré par git : ce sont des données réelles), puis :
   - `bun run golden-dataset:eval:predict` fait tourner Albert (variables
     `TAXONOMY`, `SPLIT`, `ALBERT_MODEL`, `NOTE`) et écrit un fichier par
     version de consigne dans `.golden-dataset/runs/` ;
   - `bun run golden-dataset:eval:score` corrige toutes les versions côte à
     côte et écrit `.golden-dataset/rapport.html`, avec le diff de consigne
     d'une version à l'autre. L'examen ne se corrige qu'avec `--examen`.
10. **La mise au point.** Trois versions de consigne sur les 30 :
    - v1, la consigne de départ : Albert ne répond jamais « inconnu » sur le
      blocage ;
    - v2, une règle qui demande « inconnu » quand le texte ne dit pas ce qui
      bloque : le blocage passe de 20-27 % à 40 % ;
    - v3, la même règle avec des exemples inventés : effet dans la marge du
      hasard.

    Puis quatre modèles d'Albert avec la v3 et le menu des libellés. Les plus
    gros gagnent sur l'abstention, pas sur la lecture des blocages.

11. **L'examen final (70 signalements, consigne v3, menu des libellés).**

    |                                         | Mistral Small 3.2 | Gemma 4 31B  |
    | --------------------------------------- | ----------------- | ------------ |
    | Démarche juste (catégorie)              | 86 % (76-92)      | 93 % (84-97) |
    | Blocage juste (catégorie)               | 57 % (45-68)      | 70 % (58-79) |
    | « Inconnu » bien placé                  | 18 / 34           | 27 / 34      |
    | Blocage trouvé quand l'équipe a tranché | 22 / 36           | 22 / 36      |

    Entre parenthèses, l'intervalle de confiance à 95 %.

## Ce qu'on en conclut

- **La démarche est fiable** avec Gemma 4 31B et le menu des libellés :
  93 %, au moins 84 % dans le pire des cas.
- **Le blocage ne l'est pas assez** pour produire des statistiques sans
  relecture. Le modèle reconnaît bien quand le texte ne permet pas de
  conclure, mais ne nomme juste un blocage réellement décrit que six fois
  sur dix. Un modèle plus gros n'y change rien : la limite tient autant aux
  textes, qui disent rarement ce qui bloque, qu'au modèle.
- Toute nouvelle consigne ou tout nouveau modèle se mesure d'abord sur les
  30 de mise au point ; l'examen ne se repasse que pour une recette retenue.

## Ce qui reste à faire

### Étiqueter les signalements en production

L'examen est concluant pour la démarche, pas pour le blocage. Une piste :
étiqueter la démarche automatiquement, et proposer le blocage comme une
suggestion qu'un humain valide.

Pour étiqueter un signalement, il faut d'abord le caviarder : on n'envoie
pas de données personnelles à Albert. Le caviardage est l'étape la plus
coûteuse, d'où la décision de **conserver le texte pseudonymisé de tous les
signalements**, et plus seulement à la suppression :

- **Le texte pseudonymisé** vit dans deux tables, une pour le sujet et la
  description, une pour les réponses. Sujet, description et réponses ne
  changent jamais : chaque morceau est caviardé une seule fois, au fil de
  l'eau, par un cron de nuit désactivé par défaut. Le traitement de
  suppression à six mois le réutilise au lieu de repayer le caviardage.
- **Les étiquettes** sont posées avec la recette de l'examen (labels fins,
  rangés par tag fermé), sur le sujet et la description pseudonymisés
  seulement. L'étiquetage a son propre cron, séparé de la pseudonymisation :
  il reprend chaque jour les signalements pseudonymisés pas encore étiquetés
  avec la recette courante. Le libellé fin est conservé à côté du tag fermé,
  avec la recette qui l'a produit. Le blocage n'est stocké qu'à titre de
  suggestion ; aucune interface ne les affiche encore.

La validation RGPD de ce nouveau traitement, qui conserve une copie
pseudonymisée des signalements encore ouverts, reste à confirmer par le
responsable produit avant d'activer le cron.

### Piste en attente : un lot plus grand, étiqueté par Albert et validé par l'équipe

L'examen sur 70 signalements suffit pour décider, pas pour dire sur quelles
démarches Albert se trompe : la plupart des catégories n'y ont qu'un ou deux
signalements. Plutôt que d'annoter un nouveau lot à l'aveugle, Albert
l'étiquette et l'équipe valide ou corrige chaque tag. C'est plus rapide, et
c'est le fonctionnement envisagé en production.

- **Taille.** Environ 200 signalements, sur la démarche d'abord.
- **Biais de validation.** Un relecteur accepte volontiers un tag plausible.
  Pour le mesurer, on mêle au lot une vingtaine de signalements des 100 déjà
  tranchés, et une vingtaine d'autres sont relus par deux personnes.
- **Correction.** Un tag refusé est remplacé par le bon : on obtient aussi le
  corrigé.
- **Préalable.** Les nouveaux signalements doivent être caviardés avant
  d'être envoyés à Albert, ce qui se lance sur la production.

## Règles à garder en tête

- Le corrigé figé ne se modifie jamais. Une nouvelle liste est une nouvelle
  version.
- Albert ne voit jamais les réponses humaines.
- Les scores en texte libre et en liste fermée ne se comparent pas entre eux :
  ce sont deux tâches différentes.
- Un score se lit avec sa marge d'erreur, et se découpe (par organisme, par
  catégorie) pour repérer les faiblesses qu'une moyenne cache.
