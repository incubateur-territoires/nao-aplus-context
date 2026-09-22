import { ReportStatus } from "@/generated/prisma/enums";
import { processReportDeletion } from "./report-deletion";

jest.mock("@/utils/s3", () => ({
  deleteFileFromBucket: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/anonymize-report", () => ({
  buildAnonymizedReportData: jest.fn(() => ({
    firstName: "Anon",
    lastName: "Ymized",
    birthDate: "02/02/1975",
    phone: "0611111111",
    nir: "2750112345678",
    caf: "7654321",
    nif: null,
    subject: "Sujet anonymisé",
    description: "Description anonymisée",
    maritalName: "Anonyme",
  })),
  generateAnswerContent: jest.fn(() => "Contenu anonymisé"),
}));

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// `$transaction` est interactif : le service lui passe un callback qui reçoit le
// client transactionnel. On lui redonne le même mock, pour que les assertions
// portent directement sur `mockPrisma.report.updateMany`, etc.
function createMockPrisma() {
  const client = {
    report: {
      findMany: jest.fn().mockResolvedValue([]),
      // count: 1 = le signalement était toujours CLOSED au moment de l'écriture.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    answer: {
      update: jest.fn().mockResolvedValue({}),
    },
    reportStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
      // Par défaut, la dernière fermeture est toujours ancienne → éligible.
      findFirst: jest.fn().mockResolvedValue({ createdAt: daysAgo(200) }),
    },
    file: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    notificationView: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
  };

  client.$transaction.mockImplementation(
    async (fn: (tx: typeof client) => Promise<unknown>) => fn(client),
  );

  return client;
}

// La pagination par curseur rappelle findMany jusqu'à une page vide : on renvoie
// la page demandée une fois, puis [] pour arrêter la boucle.
function mockOnePage(
  mockPrisma: ReturnType<typeof createMockPrisma>,
  reports: unknown[],
) {
  mockPrisma.report.findMany
    .mockResolvedValueOnce(reports)
    .mockResolvedValue([]);
}

function createClosedReport(
  overrides: {
    id?: string;
    closedAt?: Date;
    files?: { id: string }[];
    answers?: { id: string; isMetadataOnly: boolean }[];
  } = {},
) {
  return {
    id: overrides.id ?? "report-1",
    birthDate: "01/01/1980",
    phone: "0600000000",
    nir: "1800112345678",
    caf: "1234567",
    nif: null,
    maritalName: "Dupont",
    files: overrides.files ?? [{ id: "uuid-file-doc.pdf" }],
    answers: overrides.answers ?? [
      { id: "answer-1", isMetadataOnly: false },
      { id: "answer-meta", isMetadataOnly: true },
    ],
    statusHistory: [{ createdAt: overrides.closedAt ?? daysAgo(200) }],
  };
}

describe("report-deletion service", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  describe("processReportDeletion", () => {
    it("returns empty results when no reports are eligible", async () => {
      mockPrisma.report.findMany.mockResolvedValue([]);

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.reportsDeleted).toEqual([]);
      expect(result.fileErrors).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("anonymizes and marks a report CLOSED for more than 6 months as DELETED", async () => {
      mockOnePage(mockPrisma, [
        createClosedReport({ id: "old-report", closedAt: daysAgo(200) }),
      ]);

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.reportsDeleted).toContainEqual({ id: "old-report" });
      // L'écriture est gardée : le statut CLOSED fait partie du `where`, sinon un
      // signalement rouvert pendant le run serait écrasé.
      expect(mockPrisma.report.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "old-report", status: ReportStatus.CLOSED },
          data: expect.objectContaining({
            status: ReportStatus.DELETED,
            firstName: "Anon",
            lastName: "Ymized",
            maritalName: "Anonyme",
            subject: "Sujet anonymisé",
          }),
        }),
      );
      expect(mockPrisma.reportStatusHistory.create).toHaveBeenCalledWith({
        data: { reportId: "old-report", status: ReportStatus.DELETED },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("deletes S3 objects and File rows for the report", async () => {
      const { deleteFileFromBucket } = jest.requireMock("@/utils/s3");
      mockOnePage(mockPrisma, [
        createClosedReport({
          id: "r-files",
          files: [{ id: "uuid-a.pdf" }, { id: "uuid-b.png" }],
        }),
      ]);

      await processReportDeletion(mockPrisma as never);

      expect(deleteFileFromBucket).toHaveBeenCalledWith("uuid-a.pdf");
      expect(deleteFileFromBucket).toHaveBeenCalledWith("uuid-b.png");
      expect(mockPrisma.file.deleteMany).toHaveBeenCalledWith({
        where: { reportId: "r-files" },
      });
    });

    it("anonymizes only non-metadata answers", async () => {
      mockOnePage(mockPrisma, [
        createClosedReport({
          id: "r-answers",
          answers: [
            { id: "a-real-1", isMetadataOnly: false },
            { id: "a-real-2", isMetadataOnly: false },
            { id: "a-meta", isMetadataOnly: true },
          ],
        }),
      ]);

      await processReportDeletion(mockPrisma as never);

      expect(mockPrisma.answer.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.answer.update).toHaveBeenCalledWith({
        where: { id: "a-real-1" },
        data: { content: "Contenu anonymisé" },
      });
      expect(mockPrisma.answer.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "a-meta" } }),
      );
    });

    it("cleans up notification views for the report and its answers", async () => {
      mockOnePage(mockPrisma, [
        createClosedReport({
          id: "r-notif",
          answers: [
            { id: "a-1", isMetadataOnly: false },
            { id: "a-2", isMetadataOnly: true },
          ],
        }),
      ]);

      await processReportDeletion(mockPrisma as never);

      expect(mockPrisma.notificationView.deleteMany).toHaveBeenCalledWith({
        where: { targetId: { in: ["r-notif", "a-1", "a-2"] } },
      });
    });

    it("excludes a report whose last CLOSED entry is more recent than 6 months", async () => {
      mockOnePage(mockPrisma, [
        createClosedReport({ id: "reopened", closedAt: daysAgo(30) }),
      ]);
      const { deleteFileFromBucket } = jest.requireMock("@/utils/s3");

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.reportsDeleted).toEqual([]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(deleteFileFromBucket).not.toHaveBeenCalled();
    });

    it("épargne un signalement rouvert entre la lecture et l'écriture", async () => {
      const { deleteFileFromBucket } = jest.requireMock("@/utils/s3");
      mockOnePage(mockPrisma, [createClosedReport({ id: "r-reopened" })]);
      // Le signalement n'est plus CLOSED au moment de l'UPDATE : la garde du
      // `where` ne matche plus aucune ligne.
      mockPrisma.report.updateMany.mockResolvedValueOnce({ count: 0 });

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.skipped).toContainEqual({ id: "r-reopened" });
      expect(result.reportsDeleted).toEqual([]);
      expect(result.errors).toEqual([]);
      // Rien d'irréversible : ni fichiers détruits, ni historique réécrit.
      expect(deleteFileFromBucket).not.toHaveBeenCalled();
      expect(mockPrisma.reportStatusHistory.create).not.toHaveBeenCalled();
      expect(mockPrisma.file.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.answer.update).not.toHaveBeenCalled();
    });

    it("épargne un signalement rouvert puis refermé récemment pendant le run", async () => {
      const { deleteFileFromBucket } = jest.requireMock("@/utils/s3");
      mockOnePage(mockPrisma, [createClosedReport({ id: "r-reclosed" })]);
      // Toujours CLOSED (l'updateMany passe), mais refermé il y a 2 jours.
      mockPrisma.reportStatusHistory.findFirst.mockResolvedValueOnce({
        createdAt: daysAgo(2),
      });

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.skipped).toContainEqual({ id: "r-reclosed" });
      expect(result.reportsDeleted).toEqual([]);
      expect(result.errors).toEqual([]);
      // L'anonymisation est annulée par le rollback de la transaction, et les
      // fichiers ne sont jamais supprimés du bucket.
      expect(deleteFileFromBucket).not.toHaveBeenCalled();
    });

    it("ne supprime les objets S3 qu'après le commit de la transaction", async () => {
      const { deleteFileFromBucket } = jest.requireMock("@/utils/s3");
      mockOnePage(mockPrisma, [
        createClosedReport({ id: "r-order", files: [{ id: "uuid-a.pdf" }] }),
      ]);

      await processReportDeletion(mockPrisma as never);

      // Si S3 passait en premier, un signalement rouvert perdrait ses pièces
      // jointes alors que la base n'a rien anonymisé.
      const fileRowsDeletedAt =
        mockPrisma.file.deleteMany.mock.invocationCallOrder[0];
      const s3DeletedAt = deleteFileFromBucket.mock.invocationCallOrder[0];
      expect(s3DeletedAt).toBeGreaterThan(fileRowsDeletedAt);
    });

    it("records a file error but still anonymizes the report when S3 delete fails", async () => {
      const { deleteFileFromBucket } = jest.requireMock("@/utils/s3");
      deleteFileFromBucket.mockRejectedValueOnce(new Error("S3 down"));
      mockOnePage(mockPrisma, [
        createClosedReport({ id: "r-s3fail", files: [{ id: "uuid-x.pdf" }] }),
      ]);

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.fileErrors).toContainEqual({
        reportId: "r-s3fail",
        fileId: "uuid-x.pdf",
        error: "S3 down",
      });
      expect(result.reportsDeleted).toContainEqual({ id: "r-s3fail" });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("records an error and does not mark the report deleted when the transaction fails", async () => {
      mockOnePage(mockPrisma, [createClosedReport({ id: "r-dbfail" })]);
      mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB error"));

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.reportsDeleted).toEqual([]);
      expect(result.errors).toContainEqual({
        reportId: "r-dbfail",
        error: "DB error",
      });
    });

    it("queries only CLOSED reports closed at least 6 months ago, paginated by id", async () => {
      mockPrisma.report.findMany.mockResolvedValue([]);

      await processReportDeletion(mockPrisma as never);

      const args = mockPrisma.report.findMany.mock.calls[0][0];
      expect(args.where.status).toBe(ReportStatus.CLOSED);
      expect(args.where.statusHistory.some.status).toBe(ReportStatus.CLOSED);
      expect(args.where.statusHistory.some.createdAt.lte).toBeInstanceOf(Date);
      expect(args.select.statusHistory.orderBy.createdAt).toBe("desc");
      expect(args.select.statusHistory.take).toBe(1);
      expect(args.orderBy).toEqual({ id: "asc" });
      expect(typeof args.take).toBe("number");

      const threshold = args.where.statusHistory.some.createdAt.lte as Date;
      const diffMs = Math.abs(threshold.getTime() - daysAgo(180).getTime());
      expect(diffMs).toBeLessThan(5000);
    });

    it("paginates across multiple pages and stops on an empty page", async () => {
      mockPrisma.report.findMany
        .mockResolvedValueOnce([createClosedReport({ id: "page1" })])
        .mockResolvedValueOnce([createClosedReport({ id: "page2" })])
        .mockResolvedValue([]);

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.reportsDeleted).toEqual([{ id: "page1" }, { id: "page2" }]);
      // 2 pages non vides + 1 page vide qui arrête la boucle
      expect(mockPrisma.report.findMany).toHaveBeenCalledTimes(3);

      // La 2e page utilise le curseur de la dernière ligne de la 1re page.
      const secondCall = mockPrisma.report.findMany.mock.calls[1][0];
      expect(secondCall.cursor).toEqual({ id: "page1" });
      expect(secondCall.skip).toBe(1);
    });
  });
});
