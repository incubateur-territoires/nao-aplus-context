---
type: manual
comment: These are manual notes you want the agent to keep in mind, safe to edit.
---

## Étiquetage automatique d'un signalement

Une ligne par couple (`reportId`, `recipeKey`) : `recipeKey` identifie la recette d'étiquetage
qui l'a produite. Deux axes : la démarche (`procedure*`) et le blocage (`blockage*`).
`*Tag` est la valeur fermée, `*Label` le libellé fin affiché. Les votes portent sur le libellé.
Les avis des destinataires sont dans `ReportTaggingVerdict` (`taggingId`).
