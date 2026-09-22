-- Unified analytics source for Metabase dashboards.
-- 1 row = 1 report (signalement).
CREATE SCHEMA IF NOT EXISTS analytics;

DROP VIEW IF EXISTS analytics.v_report_fact;

CREATE VIEW analytics.v_report_fact AS
WITH first_answers AS (
  SELECT DISTINCT ON (a."reportId")
    a."reportId",
    a.id AS "firstAnswerId",
    a."createdAt" AS "firstAnswerAt",
    a."authorId" AS "firstAuthorId"
  FROM public."Answer" a
  WHERE a."isMetadataOnly" = false
    AND a."isOperatorOnly" = false
    AND a."isIrrelevant" = false
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
  (fa."firstAnswerAt" IS NOT NULL) AS "hasFirstAnswer",
  (
    fa."firstAnswerAt" IS NOT NULL
    AND fa."firstAnswerAt" - r."createdAt" <= INTERVAL '72 hours'
  ) AS "isFirstAnswerWithin72h",
  af."hasIrrelevantAnswer" AS "hasIrrelevantAnswer",
  CASE
    WHEN fa."firstAnswerAt" IS NULL THEN 'Non-répondues'
    WHEN fa."firstAnswerAt" - r."createdAt" <= INTERVAL '72 hours' THEN '3 jours ou moins'
    ELSE 'Plus de 3 jours'
  END AS "firstAnswer72hBucket",
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
WHERE r.status <> 'DELETED';
