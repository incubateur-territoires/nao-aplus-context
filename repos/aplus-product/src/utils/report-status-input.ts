import { z } from "zod";
import { ReportStatus } from "@/generated/prisma/enums";

/**
 * Statuts qu'un client peut poser sur un signalement. DELETED est réservé au
 * service d'anonymisation (`src/app/services/report/report-deletion.ts`) : un
 * signalement DELETED devient introuvable pour tout le monde, administrateurs
 * compris, donc aucune mutation exposée ne doit pouvoir l'atteindre.
 */
export const clientReportStatusSchema = z
  .nativeEnum(ReportStatus)
  .refine((status) => status !== ReportStatus.DELETED, {
    message: "Ce statut ne peut pas être appliqué à un signalement.",
  });
