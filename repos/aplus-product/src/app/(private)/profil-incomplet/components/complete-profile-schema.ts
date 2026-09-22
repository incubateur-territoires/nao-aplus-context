import { z } from "zod";

export const completeProfileSchema = z.object({
  firstName: z.string().min(1, {
    message: "Veuillez saisir votre prénom.",
  }),
  lastName: z.string().min(1, {
    message: "Veuillez saisir votre nom.",
  }),
  phone: z.string().optional().nullable(),
  profession: z.string().optional().nullable(),
});

export type CompleteProfileFormValues = z.infer<typeof completeProfileSchema>;
