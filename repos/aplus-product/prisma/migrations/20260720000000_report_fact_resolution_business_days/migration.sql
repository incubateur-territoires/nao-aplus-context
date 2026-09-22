-- Graphique « Délai de traitement » de la page /statistiques-2, passé en jours
-- OUVRÉS (décision produit, cohérente avec les délais de première réponse).
--
-- Ajoute à la vue matérialisée analytics.v_report_fact la colonne :
--   - "resolutionDelayBusinessDays" : délai création → résolution
--     (premier passage COMPLETED/CLOSED) en jours ouvrés FR (même formule que
--     "firstAnswerDelayBusinessDays" / "inTreatmentDelayBusinessDays" :
--     0 = résolu le jour même).
--
-- ⚠️ Comme les autres colonnes ouvrées, cette colonne vaut 0 (et NON NULL) pour
--    un signalement non résolu (generate_series borné par un NULL → 0 ligne).
--    Le dashboard doit donc toujours filtrer sur "hasResolution" = true.
--
-- La vue étant recréée (DROP + CREATE), TOUS les index sont recréés ici.
-- Idempotent vis-à-vis du type réel de l'objet (VIEW ou MATERIALIZED VIEW).

-- La vue est reconstruite intégralement : les tris (DISTINCT ON, agrégations,
-- merge joins) débordent sur disque avec le work_mem par défaut (2 Mo), ce qui
-- allonge la migration au point que la connexion du conteneur de build est
-- coupée (P1017). Ces réglages ne valent que pour cette transaction.
SET LOCAL work_mem = '64MB';
SET LOCAL jit = off;

CREATE SCHEMA IF NOT EXISTS analytics;

DO $$
DECLARE
  v_relkind "char";
BEGIN
  SELECT c.relkind INTO v_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'analytics'
    AND c.relname = 'v_report_fact';

  IF v_relkind = 'm' THEN
    EXECUTE 'DROP MATERIALIZED VIEW analytics.v_report_fact';
  ELSIF v_relkind = 'v' THEN
    EXECUTE 'DROP VIEW analytics.v_report_fact';
  END IF;
END $$;

CREATE MATERIALIZED VIEW analytics.v_report_fact AS
WITH

-- -----------------------------------------------------------------------
-- Années couvertes (pour le calcul des fériés)
-- -----------------------------------------------------------------------
year_range AS (
  SELECT generate_series(
    EXTRACT(YEAR FROM MIN("createdAt"))::int,
    EXTRACT(YEAR FROM MAX("createdAt"))::int
  ) AS y
  FROM public."Report"
  WHERE status <> 'DELETED'
),

-- Dimanche de Pâques par année — algorithme Meeus/Jones/Butcher
easter AS (
  SELECT y, make_date(y, month, day) AS easter_sunday
  FROM (
    SELECT y,
      (h + l - 7*m + 114) / 31      AS month,
      (h + l - 7*m + 114) % 31 + 1  AS day
    FROM (
      SELECT y, h, e, a, c,
        (32 + 2*e + 2*(c/4) - h - (c%4)) % 7                             AS l,
        (a + 11*h + 22 * ((32 + 2*e + 2*(c/4) - h - (c%4)) % 7)) / 451  AS m
      FROM (
        SELECT y, a, b, c, e,
          (19*a + b - (b/4) - ((b - ((b+8)/25) + 1)/3) + 15) % 30  AS h
        FROM (
          SELECT y,
            y % 19        AS a,
            y / 100       AS b,
            y % 100       AS c,
            (y / 100) % 4 AS e
          FROM year_range
        ) t1
      ) t2
    ) t3
  ) t4
),

-- 11 jours fériés légaux FR pour toutes les années couvertes
holidays AS (
  SELECT unnest(ARRAY[
    make_date(y, 1,  1),   -- Jour de l'An
    make_date(y, 5,  1),   -- Fête du Travail
    make_date(y, 5,  8),   -- Victoire 1945
    make_date(y, 7, 14),   -- Fête Nationale
    make_date(y, 8, 15),   -- Assomption
    make_date(y, 11,  1),  -- Toussaint
    make_date(y, 11, 11),  -- Armistice
    make_date(y, 12, 25),  -- Noël
    easter_sunday + 1,     -- Lundi de Pâques
    easter_sunday + 39,    -- Ascension
    easter_sunday + 50     -- Lundi de Pentecôte
  ]) AS holiday_date
  FROM easter
),

-- -----------------------------------------------------------------------
-- Première réponse — OPERATEUR uniquement (corrigé)
-- -----------------------------------------------------------------------
first_answers AS (
  SELECT DISTINCT ON (a."reportId")
    a."reportId",
    a.id          AS "firstAnswerId",
    a."createdAt" AS "firstAnswerAt",
    a."authorId"  AS "firstAuthorId"
  FROM public."Answer" a
  -- EXISTS plutôt qu'une jointure : un auteur membre de plusieurs équipes
  -- OPERATOR dupliquait ses réponses avant le DISTINCT ON (468k lignes triées
  -- au lieu de 300k), sans changer le résultat.
  WHERE a."isMetadataOnly" = false
    AND a."isOperatorOnly" = false
    AND a."isIrrelevant"   = false
    AND EXISTS (
      SELECT 1
      FROM public."_TeamToUser" tu
      JOIN public."Team" t ON t.id = tu."A"
      WHERE tu."B" = a."authorId"
        AND t.role = 'OPERATOR'
        AND t."deletedAt" IS NULL
    )
  ORDER BY a."reportId", a."createdAt" ASC, a.id ASC
),

-- -----------------------------------------------------------------------
-- Équipe & organisation du premier répondant
-- -----------------------------------------------------------------------
first_author_team AS (
  SELECT DISTINCT ON (fa."reportId")
    fa."reportId",
    t.id          AS "firstResponderTeamId",
    t.name        AS "firstResponderTeamName",
    o.id          AS "firstResponderOrganizationId",
    o."shortName" AS "firstResponderOrganizationShortName"
  FROM first_answers fa
  JOIN public."_TeamToUser" tu ON tu."B" = fa."firstAuthorId"
  JOIN public."Team" t         ON t.id   = tu."A"
  JOIN public."Organization" o ON o.id   = t."organizationId"
  ORDER BY
    fa."reportId",
    (t."deletedAt" IS NOT NULL) ASC,
    t.name ASC,
    t.id ASC
),

-- -----------------------------------------------------------------------
-- Équipes opérateur sollicitées
-- -----------------------------------------------------------------------
requested_teams AS (
  SELECT
    rt."A" AS "reportId",
    array_remove(array_agg(DISTINCT t.id    ORDER BY t.id),            NULL) AS "requestedTeamIds",
    array_remove(array_agg(DISTINCT t.name  ORDER BY t.name),          NULL) AS "requestedTeamNames",
    array_remove(array_agg(DISTINCT o.id    ORDER BY o.id),            NULL) AS "requestedOrganizationIds",
    array_remove(array_agg(DISTINCT o."shortName" ORDER BY o."shortName"), NULL) AS "requestedOrganizationShortNames"
  FROM public."_ReportToRequestedTeams" rt
  LEFT JOIN public."Team" t         ON t.id   = rt."B"
  LEFT JOIN public."Organization" o ON o.id   = t."organizationId"
  GROUP BY rt."A"
),

-- -----------------------------------------------------------------------
-- Flags réponses
-- -----------------------------------------------------------------------
answer_flags AS (
  SELECT
    a."reportId",
    bool_or(a."isIrrelevant") AS "hasIrrelevantAnswer"
  FROM public."Answer" a
  GROUP BY a."reportId"
),

-- -----------------------------------------------------------------------
-- Résolution : premier passage en COMPLETED ou CLOSED
-- -----------------------------------------------------------------------
resolution AS (
  SELECT
    h."reportId",
    MIN(h."createdAt") AS resolved_at
  FROM public."ReportStatusHistory" h
  WHERE h.status IN ('COMPLETED', 'CLOSED')
  GROUP BY h."reportId"
),

-- -----------------------------------------------------------------------
-- Prise en charge : premier passage en IN_TREATMENT
-- -----------------------------------------------------------------------
in_treatment AS (
  SELECT
    h."reportId",
    MIN(h."createdAt") AS in_treatment_at
  FROM public."ReportStatusHistory" h
  WHERE h.status = 'IN_TREATMENT'
  GROUP BY h."reportId"
)

-- -----------------------------------------------------------------------
-- Fait principal
-- -----------------------------------------------------------------------
SELECT
  r.id                                AS "reportId",
  r."createdAt"                       AS "reportCreatedAt",
  r."updatedAt"                       AS "reportUpdatedAt",
  r.status                            AS "reportStatus",
  r."authorId"                        AS "reportAuthorId",
  r."areaId"                          AS "areaId",
  area.name                           AS "areaName",
  area.timezone                       AS "areaTimezone",
  r."applicantTeamId"                 AS "authorTeamId",
  applicant_team.name                 AS "authorTeamName",
  author_org.id                       AS "authorOrganizationId",
  author_org."shortName"              AS "authorOrganizationShortName",

  -- Première réponse
  fa."firstAnswerId"                  AS "firstAnswerId",
  fa."firstAnswerAt"                  AS "firstAnswerAt",
  fat."firstResponderTeamId"          AS "firstResponderTeamId",
  fat."firstResponderTeamName"        AS "firstResponderTeamName",
  fat."firstResponderOrganizationId"  AS "firstResponderOrganizationId",
  fat."firstResponderOrganizationShortName" AS "firstResponderOrganizationShortName",

  -- Délais calendaires
  EXTRACT(EPOCH FROM (fa."firstAnswerAt" - r."createdAt"))::bigint AS "firstAnswerDelaySeconds",
  ROUND(EXTRACT(EPOCH FROM (fa."firstAnswerAt" - r."createdAt")) / 3600.0,  2) AS "firstAnswerDelayHours",
  ROUND(EXTRACT(EPOCH FROM (fa."firstAnswerAt" - r."createdAt")) / 86400.0, 2) AS "firstAnswerDelayDays",

  -- Délai en jours ouvrés FR (Lun-Ven, hors fériés)
  (
    SELECT COUNT(*)
    FROM generate_series(r."createdAt"::date, fa."firstAnswerAt"::date - 1, '1 day') AS d
    WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
      AND d NOT IN (SELECT holiday_date FROM holidays)
  ) AS "firstAnswerDelayBusinessDays",

  -- Flags & buckets
  (fa."firstAnswerAt" IS NOT NULL) AS "hasFirstAnswer",

  (
    fa."firstAnswerAt" IS NOT NULL
    AND fa."firstAnswerAt" - r."createdAt" <= INTERVAL '72 hours'
  ) AS "isFirstAnswerWithin72h",

  CASE
    WHEN fa."firstAnswerAt" IS NULL                                    THEN 'Non-répondues'
    WHEN fa."firstAnswerAt" - r."createdAt" <= INTERVAL '72 hours'    THEN '3 jours ou moins'
    ELSE 'Plus de 3 jours'
  END AS "firstAnswer72hBucket",

  CASE
    WHEN fa."firstAnswerAt" IS NULL THEN 'Non-répondues'
    WHEN (
      SELECT COUNT(*)
      FROM generate_series(r."createdAt"::date, fa."firstAnswerAt"::date - 1, '1 day') AS d
      WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
        AND d NOT IN (SELECT holiday_date FROM holidays)
    ) <= 3 THEN '3 jours ouvrés ou moins'
    ELSE 'Plus de 3 jours ouvrés'
  END AS "firstAnswerBusinessDaysBucket",

  -- Résolution (création → COMPLETED/CLOSED), pré-calculée pour le dashboard
  res.resolved_at                                                  AS "reportResolvedAt",
  EXTRACT(EPOCH FROM (res.resolved_at - r."createdAt"))::bigint    AS "resolutionDelaySeconds",
  ROUND(EXTRACT(EPOCH FROM (res.resolved_at - r."createdAt")) / 3600.0,  2) AS "resolutionDelayHours",
  ROUND(EXTRACT(EPOCH FROM (res.resolved_at - r."createdAt")) / 86400.0, 2) AS "resolutionDelayDays",
  (res.resolved_at IS NOT NULL)                                    AS "hasResolution",

  -- Délai création → résolution en jours ouvrés FR (Lun-Ven, hors fériés).
  -- Même formule que "firstAnswerDelayBusinessDays". Vaut 0 (pas NULL) si non
  -- résolu → le dashboard filtre sur "hasResolution" = true.
  (
    SELECT COUNT(*)
    FROM generate_series(r."createdAt"::date, res.resolved_at::date - 1, '1 day') AS d
    WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
      AND d NOT IN (SELECT holiday_date FROM holidays)
  ) AS "resolutionDelayBusinessDays",

  -- Prise en charge (création → IN_TREATMENT), pour le tableau
  -- « Délais de prise en charge » par équipe sollicitée
  it.in_treatment_at               AS "inTreatmentAt",
  (it.in_treatment_at IS NOT NULL) AS "hasInTreatment",
  (
    SELECT COUNT(*)
    FROM generate_series(r."createdAt"::date, it.in_treatment_at::date - 1, '1 day') AS d
    WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
      AND d NOT IN (SELECT holiday_date FROM holidays)
  ) AS "inTreatmentDelayBusinessDays",

  af."hasIrrelevantAnswer" AS "hasIrrelevantAnswer",

  -- Équipes sollicitées
  COALESCE(rt."requestedTeamIds",               ARRAY[]::text[]) AS "requestedTeamIds",
  COALESCE(rt."requestedTeamNames",             ARRAY[]::text[]) AS "requestedTeamNames",
  COALESCE(rt."requestedOrganizationIds",       ARRAY[]::text[]) AS "requestedOrganizationIds",
  COALESCE(rt."requestedOrganizationShortNames",ARRAY[]::text[]) AS "requestedOrganizationShortNames",
  COALESCE(array_length(rt."requestedTeamIds", 1), 0)            AS "requestedTeamsCount",

  -- Dimensions temporelles
  r."createdAt"::date                                      AS "reportCreatedDate",
  date_trunc('month', r."createdAt")::date                 AS "reportCreatedMonth",
  date_trunc('week',  r."createdAt")::date                 AS "reportCreatedWeek"

FROM public."Report" r
LEFT JOIN public."Area"         area           ON area.id         = r."areaId"
LEFT JOIN public."Team"         applicant_team ON applicant_team.id = r."applicantTeamId"
LEFT JOIN public."Organization" author_org     ON author_org.id   = applicant_team."organizationId"
LEFT JOIN first_answers         fa             ON fa."reportId"   = r.id
LEFT JOIN first_author_team     fat            ON fat."reportId"  = r.id
LEFT JOIN requested_teams       rt             ON rt."reportId"   = r.id
LEFT JOIN answer_flags          af             ON af."reportId"   = r.id
LEFT JOIN resolution            res            ON res."reportId"  = r.id
LEFT JOIN in_treatment          it             ON it."reportId"   = r.id
WHERE r.status <> 'DELETED';

-- Obligatoire pour REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX ON analytics.v_report_fact ("reportId");

-- Filtres temporels
CREATE INDEX ON analytics.v_report_fact ("reportCreatedAt");
CREATE INDEX ON analytics.v_report_fact ("reportCreatedMonth");

-- Filtres dimensionnels par NOM (conservés)
CREATE INDEX ON analytics.v_report_fact ("areaName");
CREATE INDEX ON analytics.v_report_fact ("authorTeamName");
CREATE INDEX ON analytics.v_report_fact ("authorOrganizationShortName");
CREATE INDEX ON analytics.v_report_fact ("firstResponderTeamName");
CREATE INDEX ON analytics.v_report_fact ("firstResponderOrganizationShortName");

-- Filtres sur tableaux par NOM (opérateur &&)
CREATE INDEX ON analytics.v_report_fact USING GIN ("requestedTeamNames");
CREATE INDEX ON analytics.v_report_fact USING GIN ("requestedOrganizationShortNames");

-- Filtres dimensionnels par IDENTIFIANT (page /statistiques)
CREATE INDEX ON analytics.v_report_fact ("areaId");
CREATE INDEX ON analytics.v_report_fact ("authorOrganizationId");
CREATE INDEX ON analytics.v_report_fact ("authorTeamId");

-- Filtres sur tableaux par IDENTIFIANT (opérateur &&)
CREATE INDEX ON analytics.v_report_fact USING GIN ("requestedOrganizationIds");
CREATE INDEX ON analytics.v_report_fact USING GIN ("requestedTeamIds");
