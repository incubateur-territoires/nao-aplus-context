import { OrganizationRole } from "@/generated/prisma/enums";
import { USER_ROLES } from "@/constants/user-roles";
import { publicProcedure, protectedProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const areaRouter = createTRPCRouter({
  getAreas: publicProcedure.query(async () => {
    return prisma.area.findMany({
      orderBy: { name: "asc" },
    });
  }),
  // Get areas that have at least one team with OPERATOR role and at least one user
  getActiveAreas: publicProcedure.query(async () => {
    return prisma.area.findMany({
      where: {
        teams: {
          some: {
            role: OrganizationRole.OPERATOR,
            users: {
              some: {},
            },
            deletedAt: null,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),
  getMyAreas: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === USER_ROLES.SUPERVISOR) {
      const supervisor = await prisma.supervisor.findUnique({
        where: { userId: ctx.userId },
        include: { areas: true },
      });
      return (supervisor?.areas ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }
    if (ctx.user.role === USER_ROLES.ADMIN) {
      return prisma.area.findMany({ orderBy: { name: "asc" } });
    }
    // Manager : retourne les territoires des équipes managées
    const managedTeams = await prisma.team.findMany({
      where: {
        managers: { some: { id: ctx.userId } },
        deletedAt: null,
      },
      select: { areas: true },
    });
    const areaMap = new Map<string, (typeof managedTeams)[0]["areas"][0]>();
    for (const team of managedTeams) {
      for (const area of team.areas) {
        areaMap.set(area.id, area);
      }
    }
    return [...areaMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }),
  getAreaById: publicProcedure.input(z.string()).query(async ({ input }) => {
    return prisma.area.findUnique({
      where: { id: input },
    });
  }),
});
