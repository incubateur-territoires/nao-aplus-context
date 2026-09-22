import { z } from "zod";

export const inviteColleagueSchema = z.object({
  colleagueIds: z
    .array(z.string())
    .min(1, "Veuillez sélectionner au moins un membre de l’équipe"),
  message: z.string().optional(),
});

export type InviteColleagueFormValues = z.infer<typeof inviteColleagueSchema>;
