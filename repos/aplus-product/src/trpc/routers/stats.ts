import { Prisma } from "@/generated/prisma/client";
import { ReportStatus } from "@/generated/prisma/enums";
import { publicProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { isValidIsoDate } from "@/utils/iso-date";
import { MAX_ID_LENGTH, MAX_SELECTED_IDS } from "@/utils/stats-filters-limits";
import { z } from "zod";

/**
 * Router statistiques — alimente la page publique /statistiques.
 *
 * Les données sont lues depuis la vue matérialisée `analytics.v_report_fact`
 * (1 ligne = 1 signalement, rafraîchie toutes les 30 min par le cron
 * `api/cron/analytics/refresh`). Cette vue n'est pas mappée dans le schéma
 * Prisma (schéma `analytics`), on l'interroge donc en `$queryRaw`.
 *
 * La vue inclut les signalements DELETED (anonymisés) et les statistiques les
 * comptent : ils apparaissent comme « Supprimé » dans la répartition par état.
 *
 * Les délais (création → prise en charge, création → traitement) lisent des
 * colonnes pré-calculées dans la vue (migrations dédiées) — plus de calcul live
 * sur `ReportStatusHistory`. La prise en charge est le premier geste de
 * l'opérateur : passage en IN_TREATMENT ou directement en COMPLETED. Le
 * traitement est le premier passage en COMPLETED seul : un signalement fermé
 * (CLOSED) sans avoir été traité n'a pas de délai de traitement.
 *
 * ⚠️ PIÈGE — les colonnes `requestedTeamNames` et `requestedOrganizationShortNames`
 * de la vue ne sont PAS appariées aux colonnes d'ids correspondantes. La vue les
 * agrège indépendamment, avec des tris différents (`ORDER BY id` vs `ORDER BY name`)
 * et un `DISTINCT` séparé qui collapse les homonymes — les tableaux n'ont donc même
 * pas la même longueur. Tout `unnest(ids, names)` associe un id au libellé d'un
 * autre : c'est ce qui affichait « CAF » dix fois dans les filtres. Les ids, eux,
 * sont fiables (les filtres `&&` de `buildWhere` restent justes).
 *
 * Ne JAMAIS unnest un tableau d'ids avec son tableau de noms : passer par une
 * jointure `_ReportToRequestedTeams` + `Team` / `Organization` (cf. getFilterOptions
 * et getCareDelaysByTeam). Seul `getDashboard` lit encore un tableau de noms, mais
 * seul et sans appariement, donc correctement.
 *
 * TODO: quand on retouchera la vue, corriger l'agrégation (ou supprimer les
 * colonnes de noms, devenues presque inutilisées). Nécessite une migration
 * recréant la vue en entier + un REFRESH en production — pas urgent tant que
 * personne ne se fie à ces colonnes.
 */

// Procédures publiques (pas d'authentification) : les entrées sont bornées.
//
// - Les dates doivent être des `AAAA-MM-JJ` valides : sans ce garde-fou, une
//   chaîne arbitraire produit un `Invalid Date` qui part tel quel vers Postgres
//   (erreur 500 déclenchable par un simple appel forgé).
// - Les listes d'identifiants sont plafonnées (cf. `stats-filters-limits`) : un
//   tableau de 100 000 entrées se traduirait sinon par cinq requêtes de facettes
//   en parallèle sur un `= ANY` géant.
const isoDate = z.string().refine(isValidIsoDate, "Date invalide");
const idList = z.array(z.string().max(MAX_ID_LENGTH)).max(MAX_SELECTED_IDS);

const statsFiltersSchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  areaIds: idList.optional(),
  authorOrganizationIds: idList.optional(),
  authorTeamIds: idList.optional(),
  requestedOrganizationIds: idList.optional(),
  requestedTeamIds: idList.optional(),
});

export type StatsFilters = z.infer<typeof statsFiltersSchema>;

export interface ChartSeries {
  labels: string[];
  values: number[];
}

/** Ligne du tableau « Délais de prise en charge » (une par équipe sollicitée). */
export interface CareDelayTeamRow {
  teamId: string;
  teamName: string;
  totalReports: number;
  inTreatmentCount: number;
  avgDelayBusinessDays: number | null;
  underOneBusinessDayCount: number;
  underTwoBusinessDaysCount: number;
  underThreeBusinessDaysCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  [ReportStatus.PENDING_ASSIGNMENT]: "En attente de prise en charge",
  [ReportStatus.IN_TREATMENT]: "En cours de traitement",
  [ReportStatus.COMPLETED]: "Traité",
  [ReportStatus.CLOSED]: "Fermé",
  [ReportStatus.DELETED]: "Supprimé",
};

const STATUS_ORDER: string[] = [
  ReportStatus.PENDING_ASSIGNMENT,
  ReportStatus.IN_TREATMENT,
  ReportStatus.COMPLETED,
  ReportStatus.CLOSED,
  ReportStatus.DELETED,
];

// Seuil du graphique 72h en jours OUVRÉS (pas 72h calendaires : la référence
// produit est le jour ouvré), appliqué aux buckets de la requête 2.
const TAKEN_IN_CHARGE_72H_MAX_BUSINESS_DAYS = 3;

// Plafond des buckets du délai de traitement : le dernier regroupe « 10 jours
// ouvrés et + ». Les 11 catégories 0..10 sont toujours présentes dans la série.
const TREATMENT_DELAY_MAX_BUSINESS_DAYS = 10;

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
});

/** Dimensions de filtre « multi-select » (hors période). */
type FacetKey =
  | "areaIds"
  | "authorOrganizationIds"
  | "authorTeamIds"
  | "requestedOrganizationIds"
  | "requestedTeamIds";

/**
 * Construit la clause WHERE (sur les colonnes de `v_report_fact`) à partir des
 * filtres.
 * - `extra` : conditions spécifiques à une requête (ex. `"hasTakenInCharge" = true`,
 *   ou des conditions sur une table jointe).
 * - `omit` : dimension à ignorer. Utilisé pour le filtrage à facettes : les
 *   options d'un multi-select se calculent avec tous les AUTRES filtres actifs,
 *   mais sans son propre filtre (sinon la liste se réduirait à la sélection).
 *
 * Toutes les valeurs passent par des paramètres Prisma (pas d'interpolation
 * brute). Les noms de colonnes référencés (`"areaId"`, `"requestedOrganizationIds"`,
 * …) sont propres à la vue : ils restent non ambigus même dans une requête qui
 * joint d'autres tables.
 */
function buildWhere(
  filters: StatsFilters,
  options: { extra?: Prisma.Sql[]; omit?: FacetKey } = {},
): Prisma.Sql {
  const { extra = [], omit } = options;
  const conditions: Prisma.Sql[] = [...extra];

  if (filters.startDate) {
    conditions.push(
      Prisma.sql`"reportCreatedAt" >= ${new Date(`${filters.startDate}T00:00:00.000Z`)}`,
    );
  }
  if (filters.endDate) {
    conditions.push(
      Prisma.sql`"reportCreatedAt" <= ${new Date(`${filters.endDate}T23:59:59.999Z`)}`,
    );
  }
  if (omit !== "areaIds" && filters.areaIds && filters.areaIds.length > 0) {
    conditions.push(Prisma.sql`"areaId" = ANY(${filters.areaIds}::text[])`);
  }
  if (
    omit !== "authorOrganizationIds" &&
    filters.authorOrganizationIds &&
    filters.authorOrganizationIds.length > 0
  ) {
    conditions.push(
      Prisma.sql`"authorOrganizationId" = ANY(${filters.authorOrganizationIds}::text[])`,
    );
  }
  if (
    omit !== "authorTeamIds" &&
    filters.authorTeamIds &&
    filters.authorTeamIds.length > 0
  ) {
    conditions.push(
      Prisma.sql`"authorTeamId" = ANY(${filters.authorTeamIds}::text[])`,
    );
  }
  if (
    omit !== "requestedOrganizationIds" &&
    filters.requestedOrganizationIds &&
    filters.requestedOrganizationIds.length > 0
  ) {
    // Chevauchement de tableaux : le signalement a sollicité au moins une des
    // organisations destinataires choisies.
    conditions.push(
      Prisma.sql`"requestedOrganizationIds" && ${filters.requestedOrganizationIds}::text[]`,
    );
  }
  if (
    omit !== "requestedTeamIds" &&
    filters.requestedTeamIds &&
    filters.requestedTeamIds.length > 0
  ) {
    conditions.push(
      Prisma.sql`"requestedTeamIds" && ${filters.requestedTeamIds}::text[]`,
    );
  }

  if (conditions.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

export const statsRouter = createTRPCRouter({
  /**
   * Options des listes déroulantes de filtres, dérivées des valeurs distinctes
   * présentes dans la vue (reste public, pas d'accès aux routers protégés).
   *
   * Filtrage à facettes : chaque liste est recalculée en appliquant les AUTRES
   * filtres actifs (mais pas le sien). Ex. en choisissant l'organisation
   * destinataire « CARSAT », la liste des équipes destinataires se réduit aux
   * équipes de la CARSAT, et la liste des équipes auteures à celles ayant
   * sollicité la CARSAT.
   */
  getFilterOptions: publicProcedure
    .input(statsFiltersSchema)
    .query(async ({ input }) => {
      // GROUP BY id (et non DISTINCT id, name) : un id peut apparaître avec
      // plusieurs variantes de libellé dans les données → on garantit une seule
      // ligne par id, sinon clés React dupliquées dans les <option>.

      // Destinataires (équipes et organisations) : on joint la table de liaison
      // `_ReportToRequestedTeams` + `Team` / `Organization` plutôt que d'unnest
      // les tableaux de la vue. Ceux-ci sont agrégés avec des tris indépendants
      // (id vs name) et dédoublonnés séparément, donc l'appariement positionnel
      // id/nom de `unnest(ids, names)` serait faux (cf. getCareDelaysByTeam).
      // Cette jointure porte aussi l'APPARTENANCE exacte quand une organisation
      // destinataire est choisie (les équipes de la CARSAT), là où la vue ne
      // donnerait que la co-occurrence sur un même signalement.
      const hasRequestedOrgFilter =
        !!input.requestedOrganizationIds &&
        input.requestedOrganizationIds.length > 0;

      const [
        areas,
        authorOrganizations,
        authorTeams,
        requestedOrganizations,
        requestedTeams,
      ] = await Promise.all([
        prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
            SELECT "areaId" AS id, MIN("areaName") AS name
            FROM analytics.v_report_fact
            ${buildWhere(input, {
              omit: "areaIds",
              extra: [
                Prisma.sql`"areaId" IS NOT NULL`,
                Prisma.sql`"areaName" IS NOT NULL`,
              ],
            })}
            GROUP BY "areaId"
            ORDER BY name ASC
          `),
        prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
            SELECT "authorOrganizationId" AS id, MIN("authorOrganizationShortName") AS name
            FROM analytics.v_report_fact
            ${buildWhere(input, {
              omit: "authorOrganizationIds",
              extra: [
                Prisma.sql`"authorOrganizationId" IS NOT NULL`,
                Prisma.sql`"authorOrganizationShortName" IS NOT NULL`,
              ],
            })}
            GROUP BY "authorOrganizationId"
            ORDER BY name ASC
          `),
        prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
            SELECT "authorTeamId" AS id, MIN("authorTeamName") AS name
            FROM analytics.v_report_fact
            ${buildWhere(input, {
              omit: "authorTeamIds",
              extra: [
                Prisma.sql`"authorTeamId" IS NOT NULL`,
                Prisma.sql`"authorTeamName" IS NOT NULL`,
              ],
            })}
            GROUP BY "authorTeamId"
            ORDER BY name ASC
          `),
        prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
            SELECT DISTINCT o.id AS id, o."shortName" AS name
            FROM public."_ReportToRequestedTeams" rt
            JOIN public."Team" t ON t.id = rt."B"
            JOIN public."Organization" o ON o.id = t."organizationId"
            JOIN analytics.v_report_fact f ON f."reportId" = rt."A"
            ${buildWhere(input, {
              omit: "requestedOrganizationIds",
              extra: [Prisma.sql`o."shortName" IS NOT NULL`],
            })}
            ORDER BY name ASC
          `),
        prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
            SELECT DISTINCT t.id AS id, t.name AS name
            FROM public."_ReportToRequestedTeams" rt
            JOIN public."Team" t ON t.id = rt."B"
            JOIN analytics.v_report_fact f ON f."reportId" = rt."A"
            ${buildWhere(input, {
              omit: "requestedTeamIds",
              extra: hasRequestedOrgFilter
                ? [
                    Prisma.sql`t.name IS NOT NULL`,
                    Prisma.sql`t."organizationId" = ANY(${input.requestedOrganizationIds}::text[])`,
                  ]
                : [Prisma.sql`t.name IS NOT NULL`],
            })}
            ORDER BY name ASC
          `),
      ]);

      return {
        areas,
        authorOrganizations,
        authorTeams,
        requestedOrganizations,
        requestedTeams,
      };
    }),

  /**
   * Retourne les 7 séries de la page en six requêtes (le bouton
   * « Mettre à jour les statistiques » rafraîchit tout d'un coup).
   */
  getDashboard: publicProcedure
    .input(statsFiltersSchema)
    .query(async ({ input }) => {
      const where = buildWhere(input);
      const whereTakenInCharge = buildWhere(input, {
        extra: [Prisma.sql`"hasTakenInCharge" = true`],
      });
      const whereCompleted = buildWhere(input, {
        extra: [Prisma.sql`"hasCompleted" = true`],
      });

      const [
        byMonth,
        takenInChargeDelay,
        byStatus,
        byOperator,
        treatment,
        relevance,
      ] = await Promise.all([
        // 1. Nombre de signalements par mois
        prisma.$queryRaw<{ month: Date; count: number }[]>(Prisma.sql`
          SELECT "reportCreatedMonth" AS month, COUNT(*)::int AS count
          FROM analytics.v_report_fact ${where}
          GROUP BY "reportCreatedMonth"
          ORDER BY "reportCreatedMonth" ASC
        `),
        // 2. Jours ouvrés entre création et prise en charge (buckets 0..7+), soit
        //    le premier passage en IN_TREATMENT ou COMPLETED. Alimente aussi la
        //    part « 72h ouvrées ou moins ».
        //    `whereTakenInCharge` est indispensable : la colonne vaut 0 (jamais
        //    NULL) pour un signalement jamais pris en charge.
        prisma.$queryRaw<{ bucket: number; count: number }[]>(Prisma.sql`
          SELECT LEAST("takenInChargeDelayBusinessDays"::int, 7) AS bucket, COUNT(*)::int AS count
          FROM analytics.v_report_fact ${whereTakenInCharge}
          GROUP BY bucket
          ORDER BY bucket ASC
        `),
        // 3. Répartition par état
        prisma.$queryRaw<{ status: string; count: number }[]>(Prisma.sql`
          SELECT "reportStatus" AS status, COUNT(*)::int AS count
          FROM analytics.v_report_fact ${where}
          GROUP BY "reportStatus"
        `),
        // 4. Répartition par opérateur sollicité
        prisma.$queryRaw<{ operator: string; count: number }[]>(Prisma.sql`
          SELECT op AS operator, COUNT(*)::int AS count
          FROM analytics.v_report_fact, unnest("requestedOrganizationShortNames") AS op
          ${where}
          GROUP BY op
          ORDER BY count DESC
        `),
        // 5. Jours ouvrés entre création et traitement (buckets 0..10+), soit
        //    le premier passage en COMPLETED seul : un signalement fermé sans
        //    avoir été traité n'y entre pas. `whereCompleted` est indispensable :
        //    la colonne vaut 0 (jamais NULL) pour un signalement jamais traité.
        //    Le plafond 10 est TREATMENT_DELAY_MAX_BUSINESS_DAYS.
        prisma.$queryRaw<{ bucket: number; count: number }[]>(Prisma.sql`
          SELECT LEAST("completedDelayBusinessDays"::int, 10) AS bucket, COUNT(*)::int AS count
          FROM analytics.v_report_fact ${whereCompleted}
          GROUP BY bucket
          ORDER BY bucket ASC
        `),
        // 6. Pertinence des signalements — 3 catégories.
        //    `hasIrrelevantAnswer` = bool_or(isIrrelevant) via LEFT JOIN :
        //      NULL  → aucune réponse → « Pas encore évalué »
        //      false → répondu, aucune réponse jugée non pertinente → « Pertinent »
        //      true  → au moins une réponse non pertinente → « Non pertinent »
        //    Pas de COALESCE (contrairement à avant) : on distingue le NULL
        //    (non évalué) du false (évalué pertinent), au lieu de compter les
        //    non-évalués comme pertinents.
        prisma.$queryRaw<
          { irrelevant: boolean | null; count: number }[]
        >(Prisma.sql`
          SELECT "hasIrrelevantAnswer" AS irrelevant, COUNT(*)::int AS count
          FROM analytics.v_report_fact ${where}
          GROUP BY "hasIrrelevantAnswer"
        `),
      ]);

      // --- Mise en forme des séries ---

      const reportsByMonth: ChartSeries = {
        labels: byMonth.map((r) => monthFormatter.format(new Date(r.month))),
        values: byMonth.map((r) => toNumber(r.count)),
      };

      // Délai de prise en charge en jours ouvrés (cf. requête 2).
      const takenInChargeDelayDays: ChartSeries = {
        labels: takenInChargeDelay.map((r) =>
          r.bucket >= 7
            ? "7 jours ouvrés et +"
            : `${r.bucket} jour${r.bucket > 1 ? "s" : ""} ouvré${r.bucket > 1 ? "s" : ""}`,
        ),
        values: takenInChargeDelay.map((r) => toNumber(r.count)),
      };

      // Part des pris en charge en 3 jours ouvrés ou moins, même population que
      // le graphique des délais (le plafond 7 des buckets est au-delà du seuil).
      let within72h = 0;
      let beyond72h = 0;
      for (const r of takenInChargeDelay) {
        if (r.bucket <= TAKEN_IN_CHARGE_72H_MAX_BUSINESS_DAYS) {
          within72h += toNumber(r.count);
        } else {
          beyond72h += toNumber(r.count);
        }
      }
      const takenInCharge72h: ChartSeries = {
        labels: ["3 jours ouvrés ou moins", "Plus de 3 jours ouvrés"],
        values: [within72h, beyond72h],
      };

      const sortedStatus = [...byStatus].sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
      );
      const reportsByStatus: ChartSeries = {
        labels: sortedStatus.map((r) => STATUS_LABELS[r.status] ?? r.status),
        values: sortedStatus.map((r) => toNumber(r.count)),
      };

      const reportsByOperator: ChartSeries = {
        labels: byOperator.map((r) => r.operator),
        values: byOperator.map((r) => toNumber(r.count)),
      };

      // Les 11 catégories restent présentes même à 0 : le camembert et son
      // export gardent la même forme quels que soient les filtres.
      const treatmentByBucket = new Map<number, number>(
        treatment.map((r) => [r.bucket, toNumber(r.count)]),
      );
      const treatmentBuckets = Array.from(
        { length: TREATMENT_DELAY_MAX_BUSINESS_DAYS + 1 },
        (_, bucket) => bucket,
      );
      const treatmentDelay: ChartSeries = {
        labels: treatmentBuckets.map((bucket) =>
          bucket >= TREATMENT_DELAY_MAX_BUSINESS_DAYS
            ? `${TREATMENT_DELAY_MAX_BUSINESS_DAYS} jours ouvrés et +`
            : `${bucket} jour${bucket > 1 ? "s" : ""} ouvré${bucket > 1 ? "s" : ""}`,
        ),
        values: treatmentBuckets.map(
          (bucket) => treatmentByBucket.get(bucket) ?? 0,
        ),
      };

      const relevanceMap = new Map<string, number>();
      for (const r of relevance) {
        const key =
          r.irrelevant === null
            ? "Pas encore évalué"
            : r.irrelevant
              ? "Non pertinent"
              : "Pertinent";
        relevanceMap.set(key, (relevanceMap.get(key) ?? 0) + toNumber(r.count));
      }
      const reportsRelevance: ChartSeries = {
        labels: ["Pertinent", "Non pertinent", "Pas encore évalué"],
        values: [
          relevanceMap.get("Pertinent") ?? 0,
          relevanceMap.get("Non pertinent") ?? 0,
          relevanceMap.get("Pas encore évalué") ?? 0,
        ],
      };

      return {
        reportsByMonth,
        takenInChargeDelayDays,
        takenInCharge72h,
        reportsByStatus,
        reportsByOperator,
        treatmentDelay,
        reportsRelevance,
      };
    }),

  /**
   * Tableau « Délais de prise en charge » : agrégats par équipe opérateur
   * sollicitée (prise en charge = premier passage au statut IN_TREATMENT,
   * colonnes pré-calculées dans la vue).
   *
   * Jointure sur `_ReportToRequestedTeams` + `Team` et NON
   * `unnest("requestedTeamIds", "requestedTeamNames")` : les deux tableaux de la
   * vue sont agrégés avec des tris indépendants (id vs name), l'appariement
   * positionnel id/nom serait donc faux.
   *
   * ⚠️ `"inTreatmentDelayBusinessDays"` vaut 0 (et non NULL) pour un signalement
   * jamais pris en charge (`generate_series` avec borne NULL → 0 ligne) : toutes
   * les agrégations de délai sont donc conditionnées par `"hasInTreatment"`.
   *
   * Tri et pagination côté client : une ligne par équipe (~2 500 max), une seule
   * requête agrégée suffit.
   */
  getCareDelaysByTeam: publicProcedure
    .input(statsFiltersSchema)
    .query(async ({ input }) => {
      // Quand une organisation destinataire est filtrée, on ne garde que ses
      // équipes. Sans cette restriction, le filtre agit au niveau du signalement
      // (`requestedOrganizationIds && [org]`) mais le GROUP BY par équipe fait
      // remonter TOUTES les équipes des signalements retenus — y compris celles
      // d'autres organisations co-sollicitées, ce qui gonfle artificiellement le
      // tableau. Même appartenance exacte que `getFilterOptions`.
      const hasRequestedOrgFilter =
        !!input.requestedOrganizationIds &&
        input.requestedOrganizationIds.length > 0;

      const rows = await prisma.$queryRaw<
        {
          teamId: string;
          teamName: string;
          totalReports: number;
          inTreatmentCount: number;
          avgDelayBusinessDays: number | null;
          underOneBusinessDayCount: number;
          underTwoBusinessDaysCount: number;
          underThreeBusinessDaysCount: number;
        }[]
      >(Prisma.sql`
        SELECT
          t.id   AS "teamId",
          t.name AS "teamName",
          COUNT(*)::int AS "totalReports",
          COUNT(*) FILTER (WHERE f."hasInTreatment")::int AS "inTreatmentCount",
          ROUND(
            AVG(f."inTreatmentDelayBusinessDays") FILTER (WHERE f."hasInTreatment"),
            1
          )::float8 AS "avgDelayBusinessDays",
          COUNT(*) FILTER (
            WHERE f."hasInTreatment" AND f."inTreatmentDelayBusinessDays" < 1
          )::int AS "underOneBusinessDayCount",
          COUNT(*) FILTER (
            WHERE f."hasInTreatment" AND f."inTreatmentDelayBusinessDays" < 2
          )::int AS "underTwoBusinessDaysCount",
          COUNT(*) FILTER (
            WHERE f."hasInTreatment" AND f."inTreatmentDelayBusinessDays" < 3
          )::int AS "underThreeBusinessDaysCount"
        FROM analytics.v_report_fact f
        JOIN public."_ReportToRequestedTeams" rt ON rt."A" = f."reportId"
        JOIN public."Team" t ON t.id = rt."B"
        ${buildWhere(input, {
          extra: hasRequestedOrgFilter
            ? [
                Prisma.sql`t.name IS NOT NULL`,
                Prisma.sql`t."organizationId" = ANY(${input.requestedOrganizationIds}::text[])`,
              ]
            : [Prisma.sql`t.name IS NOT NULL`],
        })}
        GROUP BY t.id, t.name
        ORDER BY "totalReports" DESC, "teamName" ASC
      `);

      return rows satisfies CareDelayTeamRow[];
    }),
});
