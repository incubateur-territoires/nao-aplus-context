---
type: manual
comment: These are manual notes you want the agent to keep in mind, safe to edit.
---

## Vote d'un destinataire sur un étiquetage

Une ligne par personne et par étiquetage (`taggingId`, `userId` uniques ensemble). Une colonne par
axe : `procedureIsCorrect`, `blockageIsCorrect`. `null` = pas encore voté sur cet axe, à exclure
du dénominateur. Le vote juge le libellé (`ReportTagging.procedureLabel` / `blockageLabel`), pas
le tag : calculer les taux d'exactitude par libellé.
