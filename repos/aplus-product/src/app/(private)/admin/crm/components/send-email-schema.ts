import { z } from "zod";

// Mêmes bornes que `crm.sendEmail` : l'erreur se voit à la saisie plutôt qu'au
// retour du serveur.
export const sendEmailSchema = z.object({
  subject: z
    .string()
    .min(1, "L'objet est obligatoire")
    .max(255, "L'objet ne peut pas dépasser 255 caractères"),
  content: z
    .string()
    .min(1, "Le message est obligatoire")
    .max(10000, "Le message ne peut pas dépasser 10000 caractères"),
});

export type SendEmailFormValues = z.infer<typeof sendEmailSchema>;
