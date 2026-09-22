import { z } from "zod";

export function createInviteGroupsSchema() {
  return z.object({
    areaId: z.string().optional(),
    teamIds: z
      .array(z.string())
      .min(1, "Veuillez sélectionner au moins une équipe opérateur à inviter"),
    message: z.string().min(1, "Veuillez saisir un message"),
  });
}

export type InviteGroupsFormValues = z.infer<
  ReturnType<typeof createInviteGroupsSchema>
>;
