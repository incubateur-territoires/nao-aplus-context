import { z } from "zod";

export const createSupervisorSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  areaIds: z
    .array(z.string())
    .min(1, "Veuillez sélectionner au moins un département"),
  organizationIds: z
    .array(z.string())
    .min(1, "Veuillez sélectionner au moins une organisation"),
});

export type CreateSupervisorFormValues = z.infer<typeof createSupervisorSchema>;
