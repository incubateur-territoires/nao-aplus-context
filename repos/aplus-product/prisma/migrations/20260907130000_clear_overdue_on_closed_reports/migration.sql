-- Des signalements fermés restaient marqués « en souffrance » : les chemins de
-- clôture hors mutation standard (désactivation d'utilisateur, retrait d'équipe,
-- cron d'auto-clôture) ne remettaient pas "overdueAt" à null. Le cron overdue ne
-- ciblant que les statuts actifs, ces lignes ne se corrigeaient jamais.
--
-- Le code remet désormais "overdueAt" à null sur tous les chemins de clôture
-- (cf. CLOSED_REPORT_DATA dans src/utils/report.ts) ; cette migration rattrape
-- les lignes existantes. L'invariant : seul un signalement encore actif
-- (PENDING_ASSIGNMENT, IN_TREATMENT) peut être « en souffrance ».
UPDATE "Report"
SET "overdueAt" = NULL
WHERE "overdueAt" IS NOT NULL
  AND "status" NOT IN ('PENDING_ASSIGNMENT', 'IN_TREATMENT');
