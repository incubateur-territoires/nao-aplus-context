import { ReportStatus } from "@/generated/prisma/enums";
import { ReportService } from "./request.service";

describe("ReportService", () => {
  describe("getLabelReport", () => {
    it("returns 'En attente de réponse' when status is undefined", () => {
      expect(ReportService.getLabelReport(undefined)).toBe(
        "En attente de réponse",
      );
    });

    it("returns 'En attente de prise en charge' for PENDING_ASSIGNMENT status", () => {
      expect(
        ReportService.getLabelReport(ReportStatus.PENDING_ASSIGNMENT),
      ).toBe("En attente de prise en charge");
    });

    it("returns 'En cours de traitement' for IN_TREATMENT status", () => {
      expect(ReportService.getLabelReport(ReportStatus.IN_TREATMENT)).toBe(
        "En cours de traitement",
      );
    });

    it("returns 'Traité' for COMPLETED status", () => {
      expect(ReportService.getLabelReport(ReportStatus.COMPLETED)).toBe(
        "Traité",
      );
    });

    it("returns 'Fermé' for CLOSED status", () => {
      expect(ReportService.getLabelReport(ReportStatus.CLOSED)).toBe("Fermé");
    });

    it("returns 'Supprimé' for DELETED status", () => {
      expect(ReportService.getLabelReport(ReportStatus.DELETED)).toBe(
        "Supprimé",
      );
    });
  });
});
