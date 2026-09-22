import { z } from "zod";

export const IDENTITY_FIELDS = {
  CAF: "caf",
  NIR: "nir",
  NIF: "nif",
} as const;

export type SpecificFieldKey =
  (typeof IDENTITY_FIELDS)[keyof typeof IDENTITY_FIELDS];

// Types for better type safety
interface RequestedTeams {
  label: string;
  value: string;
  specificFields: {
    name: SpecificFieldKey;
    label: string;
    errorMessage: string;
    hintText?: string;
  }[];
}

// Helper function to get required specific fields from requestedGroups
export function getRequiredSpecificFieldsFromTeams(
  requestedTeams: RequestedTeams[],
): SpecificFieldKey[] {
  return requestedTeams
    .flatMap((team) => team.specificFields?.map((field) => field.name) || [])
    .filter(Boolean) as SpecificFieldKey[];
}
export const reportFormSchema = z.object({
  area: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .min(1, { message: "Veuillez choisir un territoire." }),

  applicantTeam: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .min(1, { message: "Veuillez choisir une structure." }),
  requestedTeams: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        specificFields: z.array(
          z.object({
            name: z.enum([
              IDENTITY_FIELDS.CAF,
              IDENTITY_FIELDS.NIR,
              IDENTITY_FIELDS.NIF,
            ] as const),
            label: z.string(),
            errorMessage: z.string(),
            hintText: z.string().optional(),
          }),
        ),
      }),
    )
    .min(1, { message: "Veuillez choisir au moins une équipe opérateur." }),
  subject: z.string().min(1, {
    message:
      "Veuillez saisir le sujet du signalement du citoyen. Attention : le sujet ne doit pas contenir de données personnelles (nom ou numéro de sécurité sociale par exemple)",
  }),
  description: z.string().min(1, {
    message:
      "Veuillez saisir une description précise du blocage du citoyen. Vous pouvez fournir autant de détails que nécessaire.",
  }),
  files: z.array(z.instanceof(File)),
  caf: z
    .string()
    .regex(/^\d{7}$/, {
      message:
        "Veuillez saisir l'identifiant CAF du citoyen (7 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son identifiant ».",
    })

    .nullable()
    .optional(),
  nif: z
    .string()
    .regex(/^\d{13}$/, {
      message:
        "Veuillez saisir le numéro de sécurité sociale NIF du citoyen (13 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son numéro ».",
    })

    .nullable()
    .optional(),
  nir: z
    .string()
    .regex(/^[A-Za-z0-9]{13}$|^[A-Za-z0-9]{15}$/, {
      message:
        "Veuillez saisir le numéro de sécurité sociale NIR du citoyen (13 ou 15 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son numéro ».",
    })
    .nullable()
    .optional(),
  phone: z
    .string()
    .min(1, {
      message:
        "Veuillez saisir le numéro de téléphone du citoyen ou cocher la case « Le citoyen ne peut pas fournir son numéro de téléphone ».",
    })
    .nullable()
    .optional(),
  maritalName: z.string().nullable().optional(),
  firstName: z
    .string()
    .min(1, { message: "Veuillez saisir le prénom du citoyen." }),
  lastName: z
    .string()
    .min(1, { message: "Veuillez saisir le nom du citoyen." }),
  birthDate: z
    .string({
      required_error:
        "Veuillez saisir la date de naissance du citoyen au format jour / mois / année, par exemple : 31/12/1980.",
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message:
        "Veuillez saisir la date de naissance du citoyen au format jour / mois / année, par exemple : 31/12/1980.",
    }),

  citizenPermissionConfirmed: z.boolean().refine(
    (value) => {
      if (value) {
        return true;
      }
      return false;
    },
    {
      message:
        "Vous devez recueillir l'autorisation du citoyen pour envoyer le signalement.",
    },
  ),
  colleagues: z.array(
    z
      .object({
        label: z.string(),
        value: z.string(),
      })
      .optional(),
  ),
});

export const reportFormSchemaWithFileObjects = reportFormSchema.extend({
  files: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      size: z.number(),
      type: z.string(),
      lastModified: z.date(),
      // add more fields as needed
    }),
  ),
});
