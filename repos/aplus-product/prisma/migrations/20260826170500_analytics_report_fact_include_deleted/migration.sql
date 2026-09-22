-- Sync analytics.v_report_fact with the prod definition (business days,
-- resolution / in-treatment delays, operator-only first answer), and include
-- soft-deleted reports so Metabase volume charts match public."Report".
-- Filtering by status remains available via reportStatus in Metabase.
-- Prod object is a MATERIALIZED VIEW (not a plain VIEW).

-- La vue est reconstruite intégralement : les tris (DISTINCT ON, agrégations,
-- merge joins) débordent sur disque avec le work_mem par défaut (2 Mo), ce qui
-- allonge la migration au point que la connexion du conteneur de build est
-- coupée (P1017). Ces réglages ne valent que pour cette transaction.
SET LOCAL work_mem = '64MB';
SET LOCAL jit = off;

DROP MATERIALIZED VIEW IF EXISTS analytics.v_report_fact;

CREATE MATERIALIZED VIEW analytics.v_report_fact AS
WITH year_range AS (
  SELECT generate_series(
    EXTRACT(year FROM min(r."createdAt"))::integer,
    EXTRACT(year FROM max(r."createdAt"))::integer
  ) AS y
  FROM public."Report" r
),
easter AS (
  SELECT
    t4.y,
    make_date(t4.y, t4.month, t4.day) AS easter_sunday
  FROM (
    SELECT
      t3.y,
      (t3.h + t3.l - 7 * t3.m + 114) / 31 AS month,
      (t3.h + t3.l - 7 * t3.m + 114) % 31 + 1 AS day
    FROM (
      SELECT
        t2.y,
        t2.h,
        t2.e,
        t2.a,
        t2.c,
        (32 + 2 * t2.e + 2 * (t2.c / 4) - t2.h - t2.c % 4) % 7 AS l,
        (t2.a + 11 * t2.h + 22 * ((32 + 2 * t2.e + 2 * (t2.c / 4) - t2.h - t2.c % 4) % 7)) / 451 AS m
      FROM (
        SELECT
          t1.y,
          t1.a,
          t1.b,
          t1.c,
          t1.e,
          (19 * t1.a + t1.b - t1.b / 4 - (t1.b - (t1.b + 8) / 25 + 1) / 3 + 15) % 30 AS h
        FROM (
          SELECT
            year_range.y,
            year_range.y % 19 AS a,
            year_range.y / 100 AS b,
            year_range.y % 100 AS c,
            year_range.y / 100 % 4 AS e
          FROM year_range
        ) t1
      ) t2
    ) t3
  ) t4
),
holidays AS (
  SELECT unnest(ARRAY[
    make_date(easter.y, 1, 1),
    make_date(easter.y, 5, 1),
    make_date(easter.y, 5, 8),
    make_date(easter.y, 7, 14),
    make_date(easter.y, 8, 15),
    make_date(easter.y, 11, 1),
    make_date(easter.y, 11, 11),
    make_date(easter.y, 12, 25),
    easter.easter_sunday + 1,
    easter.easter_sunday + 39,
    easter.easter_sunday + 50
  ]) AS holiday_date
  FROM easter
),
first_answers AS (
  SELECT DISTINCT ON (a."reportId")
    a."reportId",
    a.id AS "firstAnswerId",
    a."createdAt" AS "firstAnswerAt",
    a."authorId" AS "firstAuthorId"
  FROM public."Answer" a
  WHERE a."isMetadataOnly" = false
    AND a."isOperatorOnly" = false
    AND a."isIrrelevant" = false
    AND EXISTS (
      SELECT 1
      FROM public."_TeamToUser" tu
      JOIN public."Team" t ON t.id = tu."A"
      WHERE tu."B" = a."authorId"
        AND t.role = 'OPERATOR'::public."OrganizationRole"
        AND t."deletedAt" IS NULL
    )
  ORDER BY a."reportId", a."createdAt" ASC, a.id ASC
),
first_author_team AS (
  SELECT DISTINCT ON (fa."reportId")
    fa."reportId",
    t.id AS "firstResponderTeamId",
    t.name AS "firstResponderTeamName",
    o.id AS "firstResponderOrganizationId",
    o."shortName" AS "firstResponderOrganizationShortName"
  FROM first_answers fa
  JOIN public."_TeamToUser" tu
    ON tu."B" = fa."firstAuthorId"
  JOIN public."Team" t
    ON t.id = tu."A"
  JOIN public."Organization" o
    ON o.id = t."organizationId"
  ORDER BY
    fa."reportId",
    (t."deletedAt" IS NOT NULL) ASC,
    t.name ASC,
    t.id ASC
),
requested_teams AS (
  SELECT
    rt."A" AS "reportId",
    array_remove(
      array_agg(DISTINCT t.id ORDER BY t.id),
      NULL
    ) AS "requestedTeamIds",
    array_remove(
      array_agg(DISTINCT t.name ORDER BY t.name),
      NULL
    ) AS "requestedTeamNames",
    array_remove(
      array_agg(DISTINCT o.id ORDER BY o.id),
      NULL
    ) AS "requestedOrganizationIds",
    array_remove(
      array_agg(DISTINCT o."shortName" ORDER BY o."shortName"),
      NULL
    ) AS "requestedOrganizationShortNames"
  FROM public."_ReportToRequestedTeams" rt
  LEFT JOIN public."Team" t
    ON t.id = rt."B"
  LEFT JOIN public."Organization" o
    ON o.id = t."organizationId"
  GROUP BY rt."A"
),
answer_flags AS (
  SELECT
    a."reportId",
    bool_or(a."isIrrelevant") AS "hasIrrelevantAnswer"
  FROM public."Answer" a
  GROUP BY a."reportId"
),
resolution AS (
  SELECT
    h."reportId",
    min(h."createdAt") AS resolved_at
  FROM public."ReportStatusHistory" h
  WHERE h.status = ANY (ARRAY[
    'COMPLETED'::public."ReportStatus",
    'CLOSED'::public."ReportStatus"
  ])
  GROUP BY h."reportId"
),
in_treatment AS (
  SELECT
    h."reportId",
    min(h."createdAt") AS in_treatment_at
  FROM public."ReportStatusHistory" h
  WHERE h.status = 'IN_TREATMENT'::public."ReportStatus"
  GROUP BY h."reportId"
)
SELECT
  r.id AS "reportId",
  r."createdAt" AS "reportCreatedAt",
  r."updatedAt" AS "reportUpdatedAt",
  r.status AS "reportStatus",
  r."authorId" AS "reportAuthorId",
  r."areaId" AS "areaId",
  area.name AS "areaName",
  area.timezone AS "areaTimezone",
  r."applicantTeamId" AS "authorTeamId",
  applicant_team.name AS "authorTeamName",
  author_org.id AS "authorOrganizationId",
  author_org."shortName" AS "authorOrganizationShortName",
  fa."firstAnswerId" AS "firstAnswerId",
  fa."firstAnswerAt" AS "firstAnswerAt",
  fat."firstResponderTeamId" AS "firstResponderTeamId",
  fat."firstResponderTeamName" AS "firstResponderTeamName",
  fat."firstResponderOrganizationId" AS "firstResponderOrganizationId",
  fat."firstResponderOrganizationShortName" AS "firstResponderOrganizationShortName",
  EXTRACT(EPOCH FROM (fa."firstAnswerAt" - r."createdAt"))::bigint AS "firstAnswerDelaySeconds",
  ROUND(
    EXTRACT(EPOCH FROM (fa."firstAnswerAt" - r."createdAt")) / 3600.0,
    2
  ) AS "firstAnswerDelayHours",
  ROUND(
    EXTRACT(EPOCH FROM (fa."firstAnswerAt" - r."createdAt")) / 86400.0,
    2
  ) AS "firstAnswerDelayDays",
  (
    SELECT count(*)::bigint
    FROM generate_series(
      r."createdAt"::date::timestamptz,
      (fa."firstAnswerAt"::date - 1)::timestamptz,
      INTERVAL '1 day'
    ) AS d(d)
    WHERE EXTRACT(dow FROM d.d) BETWEEN 1 AND 5
      AND d.d NOT IN (SELECT holiday_date FROM holidays)
  ) AS "firstAnswerDelayBusinessDays",
  (fa."firstAnswerAt" IS NOT NULL) AS "hasFirstAnswer",
  (
    fa."firstAnswerAt" IS NOT NULL
    AND fa."firstAnswerAt" - r."createdAt" <= INTERVAL '72 hours'
  ) AS "isFirstAnswerWithin72h",
  CASE
    WHEN fa."firstAnswerAt" IS NULL THEN 'Non-répondues'
    WHEN fa."firstAnswerAt" - r."createdAt" <= INTERVAL '72 hours' THEN '3 jours ou moins'
    ELSE 'Plus de 3 jours'
  END AS "firstAnswer72hBucket",
  CASE
    WHEN fa."firstAnswerAt" IS NULL THEN 'Non-répondues'
    WHEN (
      SELECT count(*)
      FROM generate_series(
        r."createdAt"::date::timestamptz,
        (fa."firstAnswerAt"::date - 1)::timestamptz,
        INTERVAL '1 day'
      ) AS d(d)
      WHERE EXTRACT(dow FROM d.d) BETWEEN 1 AND 5
        AND d.d NOT IN (SELECT holiday_date FROM holidays)
    ) <= 3 THEN '3 jours ouvrés ou moins'
    ELSE 'Plus de 3 jours ouvrés'
  END AS "firstAnswerBusinessDaysBucket",
  res.resolved_at AS "reportResolvedAt",
  EXTRACT(EPOCH FROM (res.resolved_at - r."createdAt"))::bigint AS "resolutionDelaySeconds",
  ROUND(
    EXTRACT(EPOCH FROM (res.resolved_at - r."createdAt")) / 3600.0,
    2
  ) AS "resolutionDelayHours",
  ROUND(
    EXTRACT(EPOCH FROM (res.resolved_at - r."createdAt")) / 86400.0,
    2
  ) AS "resolutionDelayDays",
  (res.resolved_at IS NOT NULL) AS "hasResolution",
  (
    SELECT count(*)::bigint
    FROM generate_series(
      r."createdAt"::date::timestamptz,
      (res.resolved_at::date - 1)::timestamptz,
      INTERVAL '1 day'
    ) AS d(d)
    WHERE EXTRACT(dow FROM d.d) BETWEEN 1 AND 5
      AND d.d NOT IN (SELECT holiday_date FROM holidays)
  ) AS "resolutionDelayBusinessDays",
  it.in_treatment_at AS "inTreatmentAt",
  (it.in_treatment_at IS NOT NULL) AS "hasInTreatment",
  (
    SELECT count(*)::bigint
    FROM generate_series(
      r."createdAt"::date::timestamptz,
      (it.in_treatment_at::date - 1)::timestamptz,
      INTERVAL '1 day'
    ) AS d(d)
    WHERE EXTRACT(dow FROM d.d) BETWEEN 1 AND 5
      AND d.d NOT IN (SELECT holiday_date FROM holidays)
  ) AS "inTreatmentDelayBusinessDays",
  af."hasIrrelevantAnswer" AS "hasIrrelevantAnswer",
  COALESCE(rt."requestedTeamIds", ARRAY[]::text[]) AS "requestedTeamIds",
  COALESCE(rt."requestedTeamNames", ARRAY[]::text[]) AS "requestedTeamNames",
  COALESCE(rt."requestedOrganizationIds", ARRAY[]::text[]) AS "requestedOrganizationIds",
  COALESCE(rt."requestedOrganizationShortNames", ARRAY[]::text[]) AS "requestedOrganizationShortNames",
  COALESCE(array_length(rt."requestedTeamIds", 1), 0) AS "requestedTeamsCount",
  r."createdAt"::date AS "reportCreatedDate",
  date_trunc('month', r."createdAt")::date AS "reportCreatedMonth",
  date_trunc('week', r."createdAt")::date AS "reportCreatedWeek"
FROM public."Report" r
LEFT JOIN public."Area" area
  ON area.id = r."areaId"
LEFT JOIN public."Team" applicant_team
  ON applicant_team.id = r."applicantTeamId"
LEFT JOIN public."Organization" author_org
  ON author_org.id = applicant_team."organizationId"
LEFT JOIN first_answers fa
  ON fa."reportId" = r.id
LEFT JOIN first_author_team fat
  ON fat."reportId" = r.id
LEFT JOIN requested_teams rt
  ON rt."reportId" = r.id
LEFT JOIN answer_flags af
  ON af."reportId" = r.id
LEFT JOIN resolution res
  ON res."reportId" = r.id
LEFT JOIN in_treatment it
  ON it."reportId" = r.id;

CREATE UNIQUE INDEX "v_report_fact_reportId_idx"
  ON analytics.v_report_fact USING btree ("reportId");
CREATE INDEX "v_report_fact_reportCreatedAt_idx"
  ON analytics.v_report_fact USING btree ("reportCreatedAt");
CREATE INDEX "v_report_fact_reportCreatedMonth_idx"
  ON analytics.v_report_fact USING btree ("reportCreatedMonth");
CREATE INDEX "v_report_fact_areaName_idx"
  ON analytics.v_report_fact USING btree ("areaName");
CREATE INDEX "v_report_fact_authorTeamName_idx"
  ON analytics.v_report_fact USING btree ("authorTeamName");
CREATE INDEX "v_report_fact_authorOrganizationShortName_idx"
  ON analytics.v_report_fact USING btree ("authorOrganizationShortName");
CREATE INDEX "v_report_fact_firstResponderTeamName_idx"
  ON analytics.v_report_fact USING btree ("firstResponderTeamName");
CREATE INDEX "v_report_fact_firstResponderOrganizationShortName_idx"
  ON analytics.v_report_fact USING btree ("firstResponderOrganizationShortName");
CREATE INDEX "v_report_fact_requestedTeamNames_idx"
  ON analytics.v_report_fact USING gin ("requestedTeamNames");
CREATE INDEX "v_report_fact_requestedOrganizationShortNames_idx"
  ON analytics.v_report_fact USING gin ("requestedOrganizationShortNames");
CREATE INDEX "v_report_fact_areaId_idx"
  ON analytics.v_report_fact USING btree ("areaId");
CREATE INDEX "v_report_fact_authorOrganizationId_idx"
  ON analytics.v_report_fact USING btree ("authorOrganizationId");
CREATE INDEX "v_report_fact_authorTeamId_idx"
  ON analytics.v_report_fact USING btree ("authorTeamId");
CREATE INDEX "v_report_fact_requestedOrganizationIds_idx"
  ON analytics.v_report_fact USING gin ("requestedOrganizationIds");
CREATE INDEX "v_report_fact_requestedTeamIds_idx"
  ON analytics.v_report_fact USING gin ("requestedTeamIds");
