import { ReportStatus } from "@/generated/prisma/enums";

export class ReportService {
  static getLabelReport(status: ReportStatus | undefined): string {
    if (!status) return "En attente de réponse";
    switch (status) {
      case ReportStatus.PENDING_ASSIGNMENT:
        return "En attente de prise en charge";
      case ReportStatus.IN_TREATMENT:
        return "En cours de traitement";
      case ReportStatus.COMPLETED:
        return "Traité";
      case ReportStatus.CLOSED:
        return "Fermé";
      case ReportStatus.DELETED:
        return "Supprimé";
    }
  }
}
