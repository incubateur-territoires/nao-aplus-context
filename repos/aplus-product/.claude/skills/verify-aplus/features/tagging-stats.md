# Étiquetage IA

Page admin en lecture seule qui mesure l'étiquetage IA des signalements et l'avis des destinataires sur ces étiquettes. Un rang de chiffres clés, une carte par axe (démarche, blocage) avec un graphique des dix libellés les plus attribués et un tableau des votes par libellé, puis un graphique des votes par semaine sur les douze dernières semaines. Vérifiée en live sur staging le 2026-10-15.

## Sub-features

- `tagging-kpis` affiche signalements étiquetés, votants, votes, taux d'approbation par axe et nombre d'utilisateurs ayant masqué le bloc de vote.
- `tagging-axis` compte chaque signalement sur son dernier étiquetage, sous le libellé affiché aux destinataires (`displayedTaggingOf`). Un axe sans libellé affiché (abstention, `autre`, `inconnu`, libellé hors taxonomie) compte sous `Sans libellé affiché`. Un vote reste attribué au libellé de l'étiquetage jugé, même remplacé depuis : un libellé peut donc avoir des votes et 0 signalement. Le blocage `aucun` compte dans la répartition mais ne reçoit jamais de vote.
- `tagging-review` pose un badge `À revoir` sur un libellé ayant au moins 5 votes et moins de 50 % d'approbation.
- `tagging-weekly` trace le total des votes par semaine (lundi UTC), selon la date du premier vote de la personne sur l'étiquetage.

## How to get to it (user POV)

- Menu déroulant `Administration`, puis `Étiquetage IA`.
- Ou directement `/admin/etiquetage`. Aucun paramètre d'URL.

## Driving it with agent-browser

Préconditions :

- Session posée sur un compte **admin** avec 2FA. Tout autre rôle est renvoyé vers `/tous-les-signalements`.
- Aucune écriture : le parcours est sans risque pour les données partagées.

- **Lire les chiffres clés.** Une liste de définitions (`dl`) : chaque `dt` porte le libellé, le `dd` voisin la valeur. Un taux sans vote s'affiche `–`.
- **Lire une carte d'axe.** Titres de niveau 2 `Démarche du citoyen` et `Blocage rencontré`. Le tableau DSFR a pour colonnes `Libellé`, `Signalements`, `Correct`, `Incorrect`, `Taux d'approbation`.
- **Lire les graphiques.** Web-components `bar-chart` : les attributs `x` et `y` portent les libellés et les valeurs sérialisés en JSON.

## Gotchas

- Sans étiquetage en base, la page n'affiche que `Aucun signalement n'a encore été étiqueté par l'IA.` Voir la fiche [Signalements anonymisés](./anonymized-reports.md) pour poser des lignes `ReportTagging` factices puis les supprimer.
- La procédure `taggingStats.get` charge tous les étiquetages et leurs votes à chaque affichage : aucune pagination. Sur staging (≈ 37 000 étiquetages), la page met ≈ 13 s au premier chargement à froid (compilation comprise), puis ≈ 2,5 s.
- Sur l'axe blocage, `Sans libellé affiché` regroupe la quasi-totalité des signalements. Il est donc exclu des graphiques et ne figure que dans les tableaux.
- Les chiffres clés se recoupent par une requête indépendante : nombre de `reportId` distincts dans `ReportTagging`, nombre de `userId` distincts et de colonnes non nulles dans `ReportTaggingVerdict`.
