import { USER_ROLES } from "@/constants/user-roles";
import { protectedProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const organizationRouter = createTRPCRouter({
  getOrganizations: protectedProcedure.query(async () => {
    return prisma.organization.findMany();
  }),

  getMyOrganizations: protectedProcedure.query(async ({ ctx }) => {
    // ctx.userId is guaranteed by protectedProcedure
    if (ctx.user.role === USER_ROLES.ADMIN) {
      return prisma.organization.findMany();
    }

    if (ctx.user.role === USER_ROLES.SUPERVISOR) {
      const supervisor = await prisma.supervisor.findUnique({
        where: { userId: ctx.userId },
        include: { organizations: true },
      });
      return (supervisor?.organizations ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    // Get unique organizations from user's teams
    const teams = await prisma.team.findMany({
      where: { users: { some: { id: ctx.userId } }, deletedAt: null },
      include: { organization: true },
    });

    const uniqueOrgs = new Map<string, (typeof teams)[0]["organization"]>();
    teams.forEach((t) => uniqueOrgs.set(t.organization.id, t.organization));
    return Array.from(uniqueOrgs.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }),

  // Organisations dans lesquelles l'utilisateur peut créer une équipe. Même
  // critère que la garde serveur (checkManagerCreatesInOwnOrganization) et
  // même logique que area.getMyAreas : on ne propose que ce que l'on gère,
  // pour ne jamais offrir un choix qui serait ensuite refusé.
  getMyManagedOrganizations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === USER_ROLES.ADMIN) {
      return prisma.organization.findMany();
    }

    if (ctx.user.role === USER_ROLES.SUPERVISOR) {
      const supervisor = await prisma.supervisor.findUnique({
        where: { userId: ctx.userId },
        include: { organizations: true },
      });
      return (supervisor?.organizations ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    const managedTeams = await prisma.team.findMany({
      where: { managers: { some: { id: ctx.userId } }, deletedAt: null },
      include: { organization: true },
    });

    const uniqueOrgs = new Map<
      string,
      (typeof managedTeams)[0]["organization"]
    >();
    managedTeams.forEach((t) =>
      uniqueOrgs.set(t.organization.id, t.organization),
    );
    return Array.from(uniqueOrgs.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }),

  getOrganizationById: protectedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return prisma.organization.findUnique({
        where: { id: input },
      });
    }),
});
