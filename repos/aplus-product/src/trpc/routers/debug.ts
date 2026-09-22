import { protectedProcedure, createTRPCRouter } from "../init";
import {
  getDebugEmails,
  clearDebugEmails,
  addMockDebugEmail,
} from "@/app/services/email/email.service";
import { z } from "zod";
import { isDebugModeEnabled } from "@/utils/debug-mode";

export const debugRouter = createTRPCRouter({
  getEmails: protectedProcedure.query(() => {
    if (!isDebugModeEnabled()) {
      return [];
    }
    return getDebugEmails();
  }),

  clearEmails: protectedProcedure.mutation(() => {
    if (!isDebugModeEnabled()) {
      return { success: false };
    }
    clearDebugEmails();
    return { success: true };
  }),

  // For testing: add a mock email
  addMockEmail: protectedProcedure
    .input(
      z.object({
        subject: z.string(),
        recipientEmail: z.string(),
        recipientName: z.string().optional(),
        htmlContent: z.string().optional(),
        templateName: z.string().optional(),
        variables: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(({ input }) => {
      if (!isDebugModeEnabled()) {
        return { success: false };
      }

      addMockDebugEmail({
        subject: input.subject,
        recipients: [
          { email: input.recipientEmail, name: input.recipientName },
        ],
        htmlContent: input.htmlContent ?? `<p>Email: ${input.subject}</p>`,
        templateName: input.templateName,
        variables: input.variables,
      });

      return { success: true };
    }),
});
