import { z } from "zod";

export const finishRegistrationSchema = z
  .object({
    firstName: z.string().min(1, {
      message: "Veuillez saisir votre prénom.",
    }),
    lastName: z.string().min(1, {
      message: "Veuillez saisir votre nom.",
    }),
    password: z.string().superRefine((val, ctx) => {
      if (val.length < 12 || !/\d/.test(val) || !/[^a-zA-Z0-9]/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Le mot de passe doit contenir au moins 12 caractères, 1 chiffre et 1 caractère spécial.",
        });
      }
    }),
    passwordConfirmation: z.string(),
    profession: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    cguAccepted: z.boolean().refine((val) => val === true, {
      message: "Vous devez accepter les conditions générales d'utilisation.",
    }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["passwordConfirmation"],
  });

export type FinishRegistrationFormValues = z.infer<
  typeof finishRegistrationSchema
>;
