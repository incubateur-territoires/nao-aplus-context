import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { ReportStatus } from "@/generated/prisma/enums";
import { searchTeamsWithUnaccent, searchWithUnaccent } from "@/utils/search";
import { extractUuid } from "@/utils/quick-search";

const RESULTS_PER_GROUP = 5;

const reportSelect = {
  id: true,
  subject: true,
  status: true,
  createdAt: true,
  author: { select: { firstName: true, lastName: true } },
} as const;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} as const;

const teamSelect = {
  id: true,
  name: true,
  organization: { select: { shortName: true } },
} as const;

async function findById(id: string) {
  const [report, user, team] = await Promise.all([
    prisma.report.findFirst({
      where: { id, status: { not: ReportStatus.DELETED } },
      select: reportSelect,
    }),
    prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect,
    }),
    prisma.team.findFirst({
      where: { id, deletedAt: null },
      select: teamSelect,
    }),
  ]);

  return {
    reports: report ? [report] : [],
    users: user ? [user] : [],
    teams: team ? [team] : [],
  };
}

// Les signalements se cherchent par objet ou par auteur, jamais par le nom
// du citoyen : la palette ne doit pas devenir un annuaire des usagers.
async function findByText(query: string) {
  const [subjectReportIds, matchingUserIds, teamSearch] = await Promise.all([
    searchWithUnaccent("Report", ["subject"], query),
    searchWithUnaccent("User", ["firstName", "lastName", "email"], query),
    searchTeamsWithUnaccent(query, 1, RESULTS_PER_GROUP),
  ]);

  const [reports, users, teams] = await Promise.all([
    prisma.report.findMany({
      where: {
        status: { not: ReportStatus.DELETED },
        OR: [
          { id: { in: subjectReportIds } },
          { authorId: { in: matchingUserIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: RESULTS_PER_GROUP,
      select: reportSelect,
    }),
    prisma.user.findMany({
      where: { id: { in: matchingUserIds }, deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: RESULTS_PER_GROUP,
      select: userSelect,
    }),
    prisma.team.findMany({
      where: { id: { in: teamSearch.ids } },
      orderBy: { name: "asc" },
      select: teamSelect,
    }),
  ]);

  return { reports, users, teams };
}

export const quickSearchRouter = createTRPCRouter({
  search: adminProcedure
    .input(z.object({ query: z.string().trim().min(2).max(200) }))
    .query(async ({ input }) => {
      const id = extractUuid(input.query);
      return id ? findById(id) : findByText(input.query);
    }),
});
