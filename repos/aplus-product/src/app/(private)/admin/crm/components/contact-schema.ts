import { z } from "zod";

export const contactSchema = z.object({
  firstName: z.string().min(1, "Le prénom est obligatoire"),
  lastName: z.string().min(1, "Le nom est obligatoire"),
  email: z.string().email("Adresse e-mail invalide"),
  address: z.string(),
  areaId: z.string(),
  organizationId: z.string(),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
