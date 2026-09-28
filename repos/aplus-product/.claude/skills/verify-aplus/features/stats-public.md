# Statistiques publiques

`/statistiques` est un tableau de bord accessible sans compte : volumes de signalements, délais de prise en charge, répartition par opérateur et par état. Chaque graphique expose ses données brutes à l'export, et un panneau de filtres restreint la période et le périmètre.

## Sub-features

- `stats-open` affiche le tableau de bord sans authentification.
- `stats-filters` restreint les graphiques par période et par périmètre.
- `stats-filter-memory` conserve les filtres d'une visite à l'autre.
- `stats-export` exporte les données d'un graphique donné.
- `stats-care-delays` affiche les délais de prise en charge par équipe, en nombre et en taux.
- `stats-charts` rend les cinq graphiques du tableau de bord.

## How to get to it (user POV)

- Choisir `Statistiques` dans le menu principal ou dans le pied de page.
- Ouvrir `/statistiques` directement, sans être connecté.

## Driving it with agent-browser

Préconditions :

- Aucune. La page est dans la liste des chemins publics de `src/proxy.ts`.
- Pour vérifier l'accès anonyme, purger la session : `agent-browser cookies clear`.

- **Accès anonyme.** Lancer `agent-browser cookies clear` puis `agent-browser open http://localhost:3000/statistiques` et `agent-browser wait --load networkidle`. Le titre de niveau 1 est `Statistiques` et la page s'affiche sans redirection vers `/connexion`.
- **Graphiques présents.** Relever les titres de niveau 2 : `Nombre de signalements`, `Signalements pris en charge en 72h ouvrées ou moins`, `Répartition des signalements par opérateur sollicité`, `Nombre de jours ouvrés entre la création et la prise en charge`, `Répartition des signalements par état`. Chacun porte un bouton `Exporter les données de « <titre> »`.
- **Prise en charge.** Dans `Nombre de jours ouvrés entre la création et la prise en charge` et `Signalements pris en charge en 72h ouvrées ou moins`, « prise en charge » désigne le premier geste de l'opérateur : passage en En cours de traitement ou directement en Traité (`hasTakenInCharge` dans la vue), pas la première réponse dans le fil. Un signalement fermé par l'aidant sans réponse n'est pas pris en charge : il n'apparaît dans aucun des deux graphiques. Le graphique 72h est un chiffre vedette, pas un donut : le pourcentage des signalements pris en charge en 3 jours ouvrés ou moins, parmi les signalements pris en charge (même population que le graphique des jours ouvrés), suivi d'une ligne `3 jours ouvrés ou moins : <n> sur <total> signalements`. Sa vue tableau donne les deux lignes (`3 jours ouvrés ou moins`, `Plus de 3 jours ouvrés`) avec la colonne `Part`. La même phrase de définition est affichée sous le titre des deux graphiques. Le tableau se lit en cochant `Tableau` dans le fieldset `Affichage de « <titre> »` ; la prop `id` de `StatCard` n'est pas observable dans le DOM (le `SegmentedControl` DSFR génère ses propres noms), seuls les fichiers d'export (`jours-creation-prise-en-charge`, `prise-en-charge-72h`) la reflètent.
- **Traitement.** Dans `Nombre de jours ouvrés entre la création et le traitement`, « traitement » désigne le premier passage au statut Traité (`hasCompleted` dans la vue), et lui seul : un signalement fermé sans avoir été traité n'y entre pas, même s'il a été pris en charge. C'est un camembert avec pourcentages, aux 11 catégories toujours présentes, de `0 jour ouvré` à `10 jours ouvrés et +` (une catégorie vide reste dans la légende et dans le tableau, à 0). Sous le titre, une phrase distingue le traitement de la prise en charge (« un signalement pris en charge en un jour peut être traité dix jours plus tard »). Le fichier d'export est `delai-de-traitement`.
- **Opérateurs sollicités.** `Répartition des signalements par opérateur sollicité` compte une part par couple (signalement, opérateur) : un signalement adressé à deux opérateurs compte dans les deux. Le `TOTAL` du donut dépasse donc le nombre de signalements ; ce n'est pas un défaut, et la phrase sous le titre le dit.
- **Filtres.** Choisir le bouton `Filtrer les statistiques`, restreindre la période, appliquer. Les valeurs des graphiques changent et le log serveur contient `stats.getDashboard`.
- **Mémoire des filtres.** Après application, un encart de niveau 3 `Mémoire des filtres` apparaît avec un bouton `Masquer le message`. Recharger la page : les filtres appliqués sont toujours actifs.
- **Export.** Choisir `Exporter les données de « Nombre de signalements »`. Le bouton se déplie sur les formats disponibles ; les données exportées correspondent aux valeurs affichées.
- **Délais par équipe.** Vérifier que les colonnes de délais affichent **à la fois un nombre et un taux**, et non un taux seul. Le tableau applique la même définition de la prise en charge que les graphiques (`hasTakenInCharge`, premier geste de l'opérateur) et affiche la même phrase sous son titre ; le délai est celui du signalement, donc une équipe co-sollicitée hérite du délai même si une autre équipe a fait le geste.
- **Cohérence des données.** Confronter le total affiché à la vue : `aplus-verify sql "select count(*) from analytics.v_report_fact;"`. Sans filtre, le total du graphique « Nombre de signalements » est égal à ce compte, signalements `DELETED` compris. Un écart s'explique par les filtres actifs ou par le rafraîchissement de la vue (30 min), à établir avant de conclure à un défaut.
- **Signalements supprimés.** La légende de « Répartition des signalements par état » n'a pas d'entrée `Supprimé` : les `DELETED` (anonymisés après 6 mois et soft-deletes hérités) sont fondus dans `Fermé`, qui est donc la plus grosse part. Vérifiable sans navigateur : `curl 'http://localhost:3000/api/trpc/stats.getDashboard?input=%7B%22json%22%3A%7B%7D%7D'` renvoie `reportsByStatus` avec quatre libellés au plus, `Fermé` en dernier.
- **Preuve.** Lancer `agent-browser snapshot -i` et `agent-browser screenshot "$PWD/.claude/skills/verify-aplus/evidence/statistiques.png"`, filtres appliqués visibles.

## Gotchas

- Les colonnes de délais en jours ouvrés valent `0` et jamais `NULL`. Un `0` signifie « pris en charge le jour même », pas « non renseigné ».
- Le tableau de bord lit un schéma d'analytics rafraîchi par le cron `/api/cron/analytics/refresh`. Des données figées peuvent venir d'un rafraîchissement non joué, pas de la page.
- `analytics.v_report_fact` est une vue matérialisée. Une migration qui la recrée la laisse remplie de l'état au moment de la migration : de nouvelles colonnes (`takenInCharge*`, `completed*`) ne bougent qu'après un `REFRESH MATERIALIZED VIEW`, joué par le cron ou par un déploiement. En production la vue est gérée à la main : la migration s'y rejoue telle quelle, puis la vue se rafraîchit.
- La vue d'analytics contient les signalements soft-supprimés et la page les compte, dans toutes les séries. Sur le staging ils représentent près de 80 % du total et gonflent la part « Fermé » du graphique par état : ce n'est pas un défaut. Un `count(*) ... where status <> 'DELETED'` sur `Report` sera donc inférieur au total affiché.
- La page est publique : la piloter avec une session active masque le vrai comportement anonyme. Purger les cookies avant de vérifier l'accès.
