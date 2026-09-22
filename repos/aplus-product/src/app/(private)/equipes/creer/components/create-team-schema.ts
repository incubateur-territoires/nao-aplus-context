import { z } from "zod";
import { TeamType } from "@/generated/prisma/enums";

interface OrganizationOption {
  id: string;
  type: TeamType;
}

export function createTeamSchema(organizations?: OrganizationOption[]) {
  return z
    .object({
      name: z.string().min(1, {
        message: "Veuillez saisir le nom de l'équipe.",
      }),
      organizationId: z.string().min(1, {
        message: "L'organisation est obligatoire.",
      }),
      areaIds: z.array(z.string()).min(1, {
        message: "Veuillez choisir au moins un département.",
      }),
      email: z
        .string()
        .email({
          message:
            "Veuillez saisir une adresse e-mail valide. Exemple : m.dupont@gmail.com",
        })
        .optional()
        .nullable()
        .or(z.literal("")),
      description: z.string().optional().nullable(),
      registrationNumber: z.string().optional().nullable(),
      type: z.nativeEnum(TeamType).optional(),
    })
    .refine(
      (data) => {
        if (!organizations || !data.organizationId) {
          return true;
        }
        const selectedOrg = organizations.find(
          (org) => org.id === data.organizationId,
        );
        // If France Services, registrationNumber is required
        if (selectedOrg?.type === TeamType.FRANCE_SERVICE) {
          return (
            data.registrationNumber !== null &&
            data.registrationNumber !== undefined &&
            data.registrationNumber.trim() !== ""
          );
        }
        return true;
      },
      {
        message: "Le matricule est obligatoire pour France Services.",
        path: ["registrationNumber"],
      },
    );
}

export type CreateTeamFormValues = z.infer<ReturnType<typeof createTeamSchema>>;
