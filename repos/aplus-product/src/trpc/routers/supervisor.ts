import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { TRPCError } from "@trpc/server";
import { USER_ROLES } from "@/constants/user-roles";
import { createVerificationToken } from "@/utils/verification-token";
import { normalizeEmail } from "@/utils/normalize";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { ROUTE } from "@/app/constant/route";

export const supervisorRouter = createTRPCRouter({
  createSupervisor: adminProcedure
    .input(
      z.object({
        email: z.string().email("Adresse e-mail invalide"),
        areaIds: z.array(z.string()).default([]),
        organizationIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const { email, areaIds, organizationIds } = input;
      const normalizedEmail = normalizeEmail(email);

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (user) {
        // Check if user is already a supervisor
        const existingSupervisor = await prisma.supervisor.findUnique({
          where: { userId: user.id },
        });

        if (existingSupervisor) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Cet utilisateur est déjà superviseur.",
          });
        }

        // Create supervisor and update user role in a transaction
        const supervisor = await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { role: USER_ROLES.SUPERVISOR },
          });

          return tx.supervisor.create({
            data: {
              userId: user.id,
              areas: {
                connect: areaIds.map((id) => ({ id })),
              },
              organizations: {
                connect: organizationIds.map((id) => ({ id })),
              },
            },
            include: {
              user: true,
              areas: true,
              organizations: true,
            },
          });
        });

        return supervisor;
      }

      // User does not exist: create PendingUser + PendingSupervisor + send invitation email
      const existingPendingSupervisor =
        await prisma.pendingSupervisor.findUnique({
          where: { email: normalizedEmail },
        });

      if (existingPendingSupervisor) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Une invitation superviseur est déjà en cours pour cette adresse e-mail.",
        });
      }

      const verificationToken = await createVerificationToken({
        email: normalizedEmail,
        firstName: null,
        lastName: null,
      });

      const pendingUser = await prisma.pendingUser.upsert({
        where: { email: normalizedEmail },
        create: {
          email: normalizedEmail,
          verificationToken,
          tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        },
        update: {},
      });

      await prisma.pendingSupervisor.create({
        data: {
          email: normalizedEmail,
          areas: {
            connect: areaIds.map((id) => ({ id })),
          },
          organizations: {
            connect: organizationIds.map((id) => ({ id })),
          },
        },
      });

      const linkUrl = `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.FINISH_REGISTRATION}?token=${pendingUser.verificationToken}`;

      await sendTemplatedEmail("INVITE_SUPERVISOR", {
        to: [{ email: normalizedEmail, name: normalizedEmail }],
        params: { linkUrl },
      });

      return { pending: true, email: normalizedEmail };
    }),

  updateSupervisor: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        areaIds: z.array(z.string()).default([]),
        organizationIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const { userId, areaIds, organizationIds } = input;

      const supervisor = await prisma.supervisor.findUnique({
        where: { userId },
      });

      if (!supervisor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce superviseur n'existe pas.",
        });
      }

      await prisma.supervisor.update({
        where: { userId },
        data: {
          areas: { set: areaIds.map((id) => ({ id })) },
          organizations: { set: organizationIds.map((id) => ({ id })) },
        },
      });

      return { success: true };
    }),
});
