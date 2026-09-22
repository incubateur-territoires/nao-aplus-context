import { z } from "zod";

// Doivent rester alignés avec les contraintes du composant DSFR `InputFile`.
const MAX_ATTACHMENTS_TOTAL_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export const contactFormSchema = z.object({
  email: z
    .string()
    .min(1, "Veuillez saisir une adresse e-mail.")
    .email(
      "Veuillez saisir une adresse e-mail valide. Exemple : prenom.nom@exemple.fr",
    ),
  firstName: z.string().min(1, "Veuillez saisir votre prénom."),
  lastName: z.string().min(1, "Veuillez saisir votre nom."),
  team: z.string().optional(),
  subject: z.string().min(1, "Veuillez saisir le sujet de votre message."),
  message: z.string().min(1, "Veuillez saisir votre message."),
  files: z
    .array(z.instanceof(File))
    .refine(
      (files) => files.every((f) => ACCEPTED_FILE_TYPES.includes(f.type)),
      {
        message: "Formats supportés : jpg, png, pdf.",
      },
    )
    .refine(
      (files) =>
        files.reduce((total, f) => total + f.size, 0) <=
        MAX_ATTACHMENTS_TOTAL_BYTES,
      { message: "La taille totale des fichiers ne doit pas dépasser 5 Mo." },
    ),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
