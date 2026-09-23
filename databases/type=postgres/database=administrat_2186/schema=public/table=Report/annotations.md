---
type: manual
comment: These are manual notes you want the agent to keep in mind, safe to edit.
---

## `DELETED` = purge automatique, pas une suppression

Seul chemin du code qui pose ce statut : un cron quotidien anonymise tout signalement `CLOSED`
depuis plus de 180 jours et le passe en `DELETED` (`src/app/services/report/report-deletion.ts`).
Un `DELETED` a donc été traité et clôturé. Le compter dans les volumes, et comme résolu.

## `CLOSED` peut être automatique

Un `COMPLETED` depuis plus de 30 jours passe `CLOSED` sans action humaine
(`src/app/api/cron/reports/auto-close/route.ts`). Le délai de traitement s'arrête à `COMPLETED`.

## `overdueAt` = date de marquage « en souffrance », pas une échéance

Posée par un cron hebdomadaire (lundi 7h) si aucune réponse d'opérateur 3 jours ouvrés après la
création, ou si la dernière réponse d'opérateur date de plus de 15 jours. Remise à vide à la
clôture. En retard = `overdueAt IS NOT NULL` et statut non terminal
(`src/app/api/cron/reports/overdue/route.ts`).
