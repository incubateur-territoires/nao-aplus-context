import { TeamType } from "@/generated/prisma/enums";
import { z } from "zod";

export const teamSettingsSchema = z.object({
  name: z.string().min(1, {
    message: "Le nom de l'équipe est obligatoire.",
  }),
  email: z
    .string()
    .email({
      message:
        "Veuillez saisir une adresse e-mail au format attendu, exemple : nom@domaine.fr",
    })
    .optional()
    .nullable(),
  description: z.string().optional().nullable(),
});

export type TeamSettingsFormValues = z.infer<typeof teamSettingsSchema>;

export const teamAcceptTypesSchema = z.object({
  acceptTypes: z
    .array(z.nativeEnum(TeamType))
    .min(
      1,
      "Il est obligatoire de répondre aux signalements d’au moins un type d’équipe. Veuillez cocher au moins une case.",
    ),
});

export type TeamAcceptTypesFormValues = z.infer<typeof teamAcceptTypesSchema>;
