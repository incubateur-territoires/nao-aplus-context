import { z } from "zod";
import { NotificationFrequency } from "@/generated/prisma/enums";

interface NotificationFrequencyOption {
  value: NotificationFrequency;
  label: string;
  hint?: string;
}

export const NOTIFICATION_FREQUENCY_OPTIONS: NotificationFrequencyOption[] = [
  {
    value: NotificationFrequency.EACH_SOLICITATION,
    label:
      "recevoir un e-mail à chaque sollicitation (nouveau signalement, changement de statut, nouveau message...)",
    hint: "Choix par défaut",
  },
  {
    value: NotificationFrequency.TWICE_DAILY,
    label: "recevoir 2 récapitulatifs par jour, à 11h et à 15h",
  },
  {
    value: NotificationFrequency.ONCE_DAILY,
    label: "recevoir 1 récapitulatif par jour à 15h",
  },
  {
    value: NotificationFrequency.NONE,
    label: "ne recevoir aucune notification par e-mail",
  },
];

export const profileSchema = z.object({
  firstName: z.string().min(1, {
    message: "Veuillez saisir votre prénom.",
  }),
  lastName: z.string().min(1, {
    message: "Veuillez saisir votre nom.",
  }),
  phone: z.string().optional().nullable(),
  profession: z.string().optional().nullable(),
  notificationFrequency: z.enum([
    NotificationFrequency.EACH_SOLICITATION,
    NotificationFrequency.TWICE_DAILY,
    NotificationFrequency.ONCE_DAILY,
    NotificationFrequency.NONE,
  ]),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
