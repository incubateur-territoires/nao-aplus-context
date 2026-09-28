# Golden dataset

Un corpus de signalements caviardés que l'équipe annote à la main, deux tags par signalement : un tag **blocage** et un tag **démarche**. Chaque admin annote de son côté sur `/golden-dataset`, puis la restitution `/golden-dataset/resultats` met côte à côte les tags de tous les annotateurs et ceux des séries de modèles, mesure leur accord, et sert de plan de travail pour **adjuger** : retenir un tag de référence par axe, celui contre lequel les modèles seront ensuite évalués.

## Sub-features

- `golden-annotate` saisit les deux tags d'un signalement et navigue de position en position.
- `golden-overview` affiche une carte par signalement, une ligne par source, deux colonnes de tags.
- `golden-progress` affiche l'avancement de chaque annotateur et de chaque série de modèles, puis le compteur `Adjugés`.
- `golden-agreement` affiche l'accord entre annotateurs par axe et par paire.
- `golden-choose` retient le tag d'une source d'un clic sur son tag, et le relâche d'un second clic.
- `golden-reference` retient, depuis la ligne `Référence`, un tag qu'aucune source ne porte : `inconnu`, ou un texte saisi librement.
- `golden-filter` restreint la liste aux signalements à discuter, unanimes, adjugés, ou à tous.
- `golden-adjudicate-unanimous` retient d'un geste tous les axes que l'unanimité tranche.
- `golden-closed-taxonomy` affiche l'aperçu de la liste fermée : labels sans entrée, signalements non adjugés, distribution par tag, et une ligne `Fermé vN` par signalement.
- `golden-freeze` écrit la projection de la version courante dans `GoldenDatasetGold`, une fois pour tout le corpus.

## How to get to it (user POV)

- Ouvrir `/golden-dataset` pour annoter, `/golden-dataset?n=12` pour reprendre à une position.
- Ouvrir `/golden-dataset/resultats` pour la restitution, ou suivre le lien `Voir la restitution des annotations` affiché sous le dernier signalement.
- Aucune entrée de menu ne mène à ces pages : elles s'atteignent par leur URL.

## Driving it with agent-browser

Préconditions :

- Session posée sur un compte **admin**, et sur rien d'autre : `getCurrentUserRole` renvoie vers `/signalements` pour tout autre rôle. Un admin sans second facteur est bloqué sur `/configurer-2fa` avant d'y arriver, donc prendre un admin dont le 2FA est déjà posé.
- Le corpus doit exister : sans lui, l'annotation répond `Le corpus n'a pas encore été constitué.` et la restitution `Aucun signalement dans le corpus.`
- **Toutes les écritures de ce parcours sont partagées.** Les annotations et les tags de référence vivent dans la base de staging et appartiennent au travail de l'équipe. Relever l'état avant de le modifier, et rendre l'état de départ après.

- **Annoter.** Ouvrir `/golden-dataset`, `agent-browser wait --load networkidle`. Deux `textbox` nommés `Tag blocage` et `Tag démarche`, saisis avec `type` sur une référence de `snapshot`. Les boutons sont `Précédent`, `Suivant`, et `Enregistrer mon annotation` à la dernière position. Le log serveur contient `goldenDataset.saveAnnotation`. Un tag de plus de cinq mots ou de plus de soixante caractères bloque la navigation avec son message sous le champ.
- **Ouvrir la restitution.** Ouvrir `/golden-dataset/resultats`. Titre de niveau 1 `Restitution des annotations`, puis une carte par signalement dans un `article`, chacune avec un titre de niveau 3 qui est le sujet du signalement.
- **Lire l'avancement.** Sous le titre de niveau 2 `Avancement` : une liste par annotateur, une liste par série de modèles si au moins une a tourné, puis un paragraphe lisant `Adjugés x/total`. Un signalement compte comme adjugé quand ses **deux** axes portent un tag de référence.
- **Lire l'accord.** Sous le titre de niveau 3 `Accord entre annotateurs`, une ligne par axe comparable, chacune suivie d'une ligne par paire d'annotateurs, au format `Charles · Manon` puis `66,7 % (2/3)`. Le bloc entier est absent quand aucune paire n'a de signalement en commun, ce qui est le cas normal tant qu'une seule personne a annoté. Une paire sans comparaison n'apparaît pas.
- **Retenir le tag d'une source.** Dans le tableau d'une carte, chaque tag est un `button` dont le nom est le tag lui-même. Le cliquer avec `aplus-verify click` pose `aria-pressed="true"` sur **toutes** les sources qui portent ce texte à la casse et aux accents près, et sur cet axe seul. Un second clic le relâche. Le log serveur contient `goldenDataset.chooseGoldenTags`. L'écriture est optimiste : l'affichage bascule avant la réponse, donc juger sur le log et sur une relecture, pas sur la seule bascule.
- **La ligne Référence.** Dernière `row` du corps du tableau de chaque carte, reconnaissable au texte `Référence` de sa première `cell`. Ses deux cellules d'axe sont aux index des colonnes `Blocage` et `Démarche`, et contiennent, dans l'ordre : le tag retenu en `button` pressé quand il en existe un et qu'il ne vaut pas `inconnu`, un `button` nommé `inconnu`, puis un `textbox` nommé `Retenir un autre tag de blocage` ou `Retenir un autre tag de démarche` avec son `button` nommé `Retenir`.
- **Retenir `inconnu`.** Cliquer le `button` nommé `inconnu` de la cellule voulue. Il devient pressé, et le tag retenu qui s'affichait à sa gauche disparaît puisque c'est lui qui le porte désormais. Un second clic le relâche.
- **Saisir un tag libre.** Saisir dans le `textbox` de la cellule, puis valider **par la touche Entrée ou par le bouton `Retenir`** : les deux passent par le `submit` du même formulaire. Le tag apparaît alors pressé dans la ligne Référence. Contrairement aux tags de sources, cette saisie **retient sans jamais relâcher** : ressaisir le texte déjà retenu le confirme. Un texte refusé (plus de cinq mots, plus de soixante caractères) affiche son message sous le champ et n'émet aucune requête.
- **Filtrer.** Au-dessus de la liste, quatre `button` dans un `ul.fr-tags-group`, nommés avec leur compteur : `À discuter (N)`, `Unanimes (N)`, `Adjugés (N)`, `Tous (N)`. `Tous` est pressé à l'arrivée. Le filtre est local : il ne recharge rien et conserve l'ordre des positions.
- **Remplir les unanimes.** Le `button` nommé `Retenir les N unanimes`, à droite des filtres, où N est un nombre d'**axes** et non de signalements. Il est `disabled` quand N vaut 0. Le clic appelle `goldenDataset.adjudicateUnanimous`, qui écrit en une transaction tous les axes unanimes encore vides du corpus entier, puis invalide la restitution : la page se recharge, N retombe à 0 et le compteur `Adjugés` monte. Un échec s'affiche en `alert` lisant `Le remplissage a échoué. <message>`.
- **Lire l'aperçu de la taxonomie fermée.** Sous le titre de niveau 2 `Taxonomie fermée vN`, un paragraphe d'état (`Aperçu dérivé des labels de référence ; rien n'est écrit.` ou `Figée : x/total signalements.`), puis, tant que le corpus ne se projette pas entièrement, la liste `Labels sans entrée` (une ligne par label, avec son axe et ses positions) et la ligne `Signalements non adjugés`. Enfin une colonne par axe listant chaque tag et son compte, les tags sous trois items portant un badge `moins de 3`.
- **Lire le tag fermé d'un signalement.** Dernière `row` du tableau de chaque carte, première `cell` lisant `Fermé vN`. Ses cellules d'axe ne sont pas cliquables : le tag fermé se dérive du tag de référence par la projection. Une cellule lit `sans entrée` quand le label de référence n'est dans aucune paire de la liste, `–` quand l'axe n'est pas adjugé, et affiche `figé : <tag>` à côté du tag dérivé quand la ligne déjà écrite ne dit plus la même chose.
- **Preuve d'écriture.** Relire les colonnes retenues : `aplus-verify sql "select position, \"goldenBlockageTag\", \"goldenProcedureTag\" from \"GoldenDatasetItem\" order by position limit 10;"`. Capturer aussi `agent-browser screenshot` sur la carte concernée, ligne Référence visible.

## Gotchas

- **`Figer la vN` écrit une ligne par signalement du corpus et rien ne la reprend.** Aucune mutation ne supprime des lignes figées : un gel déclenché « pour voir » se défait à la main en base. Le bouton n'est actif que si tout le corpus se projette, donc il l'est rarement par accident — ne pas adjuger le corpus juste pour l'activer.
- Le tag fermé affiché ne prouve pas qu'une ligne est en base : il est dérivé au rendu. Seul le paragraphe `Figée : x/total` et une relecture de `GoldenDatasetGold` prouvent une écriture.
- **`Retenir les N unanimes` écrit sur tout le corpus en un clic**, pas sur la carte visible. Ne pas le déclencher pour « voir ce qu'il fait » : il pose des tags de référence dans le travail de l'équipe. Le vérifier sur un corpus dont on a relevé l'état avant, et savoir comment le rendre.
- Le nom `Retenir` du bouton de saisie libre est une sous-chaîne de `Retenir les N unanimes` et de `Retenir ce tag`. Chercher par nom exact, jamais par sous-chaîne, et se placer d'abord dans la bonne cellule.
- Tous les noms accessibles de la ligne Référence se répètent une fois par axe et une fois par signalement. Descendre dans l'`article` de la carte, puis dans la cellule, avant de désigner un bouton.
- L'égalité des tags est une égalité **canonique**, pas textuelle : `Dossier Bloqué` et `dossier bloqué` sont le même tag pour l'affichage pressé, pour l'unanimité et pour l'accord. Un test qui compare les textes bruts conclura à tort au désaccord.
- Un tag de référence peut ne correspondre à aucune source, parce que la saisie libre l'a posé ou parce que les annotations ont changé depuis. Il n'est visible que dans la ligne Référence.
- `inconnu` n'est pas l'absence de décision : c'est le tag que l'équipe pose quand elle juge le signalement indéterminable. Un axe sans tag de référence est un axe non tranché, et les deux se distinguent dans la base par `null` contre `'inconnu'`.
- Un clic sur un tag écrit **les deux axes** de l'item, pas seulement celui cliqué. Deux clics rapprochés sont sérialisés par un `scope` de mutation ; sans lui, la première requête commitait après la seconde et effaçait son effet.
- Les prédictions des modèles n'entrent jamais dans le calcul de l'accord : il se mesure entre humains, et confronter un modèle aux annotateurs mesurerait sa performance, pas la clarté de la consigne.
- L'annotateur enregistre **au passage au signalement suivant**, sans attendre la réponse. Quitter la page juste après une saisie peut donc perdre la dernière annotation ; le bouton de la dernière position, lui, attend la confirmation.
- La page d'annotation précharge les positions voisines. Une requête `goldenDataset.getItem` de plus dans le log n'est pas un double appel.
