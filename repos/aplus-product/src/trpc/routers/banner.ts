import { z } from "zod";
import { publicProcedure, adminProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";

const bannerInput = z.object({
  severity: z.enum(["info", "warning", "alert"]),
  content: z.string().min(1, "Le contenu du bandeau est requis"),
  displayOnPublicPages: z.boolean(),
});

export const bannerRouter = createTRPCRouter({
  get: publicProcedure.query(async () => {
    const banner = await prisma.siteBanner.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    return banner;
  }),

  getAdmin: adminProcedure.query(async () => {
    const banner = await prisma.siteBanner.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    return banner;
  }),

  upsert: adminProcedure.input(bannerInput).mutation(async ({ input, ctx }) => {
    const existing = await prisma.siteBanner.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      return prisma.siteBanner.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          content: input.content,
          displayOnPublicPages: input.displayOnPublicPages,
          isActive: true,
          authorId: ctx.user.id,
        },
      });
    }

    return prisma.siteBanner.create({
      data: {
        severity: input.severity,
        content: input.content,
        displayOnPublicPages: input.displayOnPublicPages,
        isActive: true,
        authorId: ctx.user.id,
      },
    });
  }),

  delete: adminProcedure.mutation(async () => {
    const existing = await prisma.siteBanner.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!existing) {
      return null;
    }

    return prisma.siteBanner.delete({
      where: { id: existing.id },
    });
  }),
});
