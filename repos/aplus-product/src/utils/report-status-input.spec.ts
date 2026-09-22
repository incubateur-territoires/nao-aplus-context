import { clientReportStatusSchema } from "./report-status-input";
import { ReportStatus } from "@/generated/prisma/enums";

describe("clientReportStatusSchema", () => {
  it.each([
    ReportStatus.PENDING_ASSIGNMENT,
    ReportStatus.IN_TREATMENT,
    ReportStatus.COMPLETED,
    ReportStatus.CLOSED,
  ])("accepts %s", (status) => {
    expect(clientReportStatusSchema.parse(status)).toBe(status);
  });

  it("rejects DELETED, reserved to the anonymization service", () => {
    expect(() => clientReportStatusSchema.parse(ReportStatus.DELETED)).toThrow(
      "Ce statut ne peut pas être appliqué à un signalement.",
    );
  });

  it("rejects values outside the enum", () => {
    expect(() => clientReportStatusSchema.parse("NOT_A_STATUS")).toThrow();
  });
});
