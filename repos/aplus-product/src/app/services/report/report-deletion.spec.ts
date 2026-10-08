import { ReportStatus } from "@/generated/prisma/enums";
import {
  API_FAILURE_THRESHOLD,
  PSEUDONYMIZATION_GRACE_DAYS,
  REDACTION_CONCURRENCY,
} from "@/utils/pseudonymization-policy";
import { processReportDeletion } from "./report-deletion";
import { pseudonymizeReportContent } from "./report-pseudonymization";
import { mapWithConcurrency } from "@/utils/concurrency";

jest.mock("@/utils/concurrency", () => ({
  mapWithConcurrency: jest.fn(
    jest.requireActual("@/utils/concurrency").mapWithConcurrency,
  ),
}));

jest.mock("@/utils/s3", () => ({
  deleteFileFromBucket: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/anonymize-report", () => ({
  ERASED_CONTENT: "Contenu supprimé",
  ANONYMIZED_IDENTITY: jest.requireActual("@/utils/anonymize-report")
    .ANONYMIZED_IDENTITY,
  generateSubject: jest.fn(() => "Sujet anonymisé"),
  generateDescription: jest.fn(() => "Description anonymisée"),
  generateAnswerContent: jest.fn(() => "Contenu anonymisé"),
}));

jest.mock("./report-pseudonymization", () => ({
  ...jest.requireActual("./report-pseudonymization"),
  pseudonymizeReportContent: jest.fn(),
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
      findUnique: jest.fn().mockResolvedValue({
        subject: "Sujet réel",
        description: "Description réelle",
        firstName: "Réel",
        lastName: "Citoyen",
        maritalName: null,
        birthDate: "01/01/1980",
        author: { firstName: "Aidant", lastName: "Référent" },
        answers: [],
      }),
      // count: 1 = le signalement était toujours CLOSED au moment de l'écriture.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
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
    pseudonymizedReport: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    pseudonymizedAnswer: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    reportPseudonymizationRefusal: {
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
            firstName: "Anonymisé",
            lastName: "Anonymisé",
            maritalName: null,
            subject: "Sujet anonymisé",
          }),
        }),
      );
      expect(mockPrisma.reportStatusHistory.create).toHaveBeenCalledWith({
        data: { reportId: "old-report", status: ReportStatus.DELETED },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 30_000 },
      );
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

describe("report-deletion service — pseudonymisation du texte", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  function givenOutcome(outcome: string, content?: unknown) {
    (pseudonymizeReportContent as jest.Mock).mockResolvedValue({
      outcome,
      content,
    });
  }

  function createPendingReport(overrides: {
    id: string;
    answers?: { id: string; isMetadataOnly?: boolean }[];
    maskedAt?: Date;
  }) {
    return {
      id: overrides.id,
      birthDate: "01/01/1980",
      phone: "0600000000",
      nir: "1800112345678",
      caf: "1234567",
      nif: null,
      maritalName: "Dupont",
      answers: overrides.answers ?? [],
      statusHistory: [{ createdAt: overrides.maskedAt ?? daysAgo(2) }],
    };
  }

  /** Une page pour la passe des fermés, puis une page pour la passe de reprise. */
  function mockPasses(closed: unknown[], pending: unknown[]) {
    mockPrisma.report.findMany.mockImplementation(
      async (args: { where?: { status?: string }; cursor?: unknown }) => {
        if (args.cursor) return [];
        return args.where?.status === ReportStatus.DELETED ? pending : closed;
      },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    process.env.REPORT_PSEUDONYMIZATION_ENABLED = "true";
    givenOutcome("DONE", {
      subject: "Sujet [NOM_1]",
      description: "Description [NOM_1]",
      answers: [{ id: "answer-1", content: "Réponse [NOM_1]" }],
    });
  });

  afterEach(() => {
    delete process.env.REPORT_PSEUDONYMIZATION_ENABLED;
  });

  it("stocke la copie pseudonymisée et vide le texte du signalement", async () => {
    mockPasses([createClosedReport({ id: "r-done" })], []);

    const result = await processReportDeletion(mockPrisma as never);

    expect(result.pseudonymized).toContainEqual({ id: "r-done" });
    expect(mockPrisma.pseudonymizedReport.createMany).toHaveBeenCalledWith({
      data: [
        {
          reportId: "r-done",
          subject: "Sujet [NOM_1]",
          description: "Description [NOM_1]",
        },
      ],
      skipDuplicates: true,
    });
    expect(mockPrisma.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: "",
          description: "",
          pseudonymizationStatus: "DONE",
        }),
      }),
    );
  });

  it("masque le signalement mais laisse le texte quand la garde refuse", async () => {
    givenOutcome("REFUSED");
    mockPasses([createClosedReport({ id: "r-refused" })], []);

    const result = await processReportDeletion(mockPrisma as never);

    expect(result.reportsDeleted).toContainEqual({ id: "r-refused" });
    expect(result.awaitingPseudonymization).toContainEqual({ id: "r-refused" });
    expect(result.pseudonymized).toEqual([]);

    const data = mockPrisma.report.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe(ReportStatus.DELETED);
    expect(data.subject).toBeUndefined();
    expect(data.pseudonymizationStatus).toBeUndefined();
    // L'identité part avec le texte : tant qu'il attend, elle reste lisible
    // par la passe de reprise, qui en a besoin pour caviarder.
    expect(data.firstName).toBeUndefined();
    expect(data.lastName).toBeUndefined();
    expect(data.birthDate).toBeUndefined();
    expect(data.maritalName).toBeUndefined();
  });

  it("écrit l'identité anonymisée avec le texte caviardé dès la première passe", async () => {
    mockPasses([createClosedReport({ id: "r-done" })], []);

    await processReportDeletion(mockPrisma as never);

    const data = mockPrisma.report.updateMany.mock.calls[0][0].data;
    expect(data.pseudonymizationStatus).toBe("DONE");
    expect(data.firstName).toBe("Anonymisé");
    expect(data.birthDate).toBe("00/00/0000");
  });

  it("masque quand même le signalement pendant une panne du pipeline", async () => {
    givenOutcome("OUTAGE");
    mockPasses([createClosedReport({ id: "r-outage" })], []);

    const result = await processReportDeletion(mockPrisma as never);

    expect(result.reportsDeleted).toContainEqual({ id: "r-outage" });
    expect(result.awaitingPseudonymization).toContainEqual({ id: "r-outage" });
    expect(mockPrisma.answer.update).not.toHaveBeenCalled();
  });

  it("cesse d'appeler le pipeline après trois pannes consécutives", async () => {
    givenOutcome("OUTAGE");
    mockPasses(
      Array.from({ length: 6 }, (_, index) =>
        createClosedReport({ id: `r-${index}` }),
      ),
      [],
    );

    const result = await processReportDeletion(mockPrisma as never);

    // Le disjoncteur borne le gaspillage sans l'annuler : des appels déjà en
    // vol aboutissent avant que la panne ne soit constatée.
    const calls = (pseudonymizeReportContent as jest.Mock).mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(API_FAILURE_THRESHOLD);
    expect(calls).toBeLessThanOrEqual(
      API_FAILURE_THRESHOLD + REDACTION_CONCURRENCY,
    );
    expect(result.reportsDeleted).toHaveLength(6);
    expect(result.pseudonymizationOutage).toBe(true);
  });

  it("masque quand même le signalement quand le caviardage lève une erreur de code", async () => {
    (pseudonymizeReportContent as jest.Mock).mockRejectedValue(
      new TypeError("x is not a function"),
    );
    mockPasses([createClosedReport({ id: "r-bug" })], []);

    const result = await processReportDeletion(mockPrisma as never);

    // Le masquage ne dépend jamais du pipeline : il a lieu, texte en attente.
    expect(result.reportsDeleted).toContainEqual({ id: "r-bug" });
    expect(result.awaitingPseudonymization).toContainEqual({ id: "r-bug" });
    expect(result.errors).toContainEqual({
      reportId: "r-bug",
      error: "x is not a function",
    });
    const data = mockPrisma.report.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe(ReportStatus.DELETED);
    expect(data.subject).toBeUndefined();
    expect(data.firstName).toBeUndefined();
    // Un bug n'est pas une panne du fournisseur.
    expect(result.pseudonymizationOutage).toBe(false);
  });

  it("consigne une erreur de code en reprise sans rien écrire ni compter une panne", async () => {
    (pseudonymizeReportContent as jest.Mock).mockRejectedValue(
      new TypeError("x is not a function"),
    );
    mockPasses(
      [],
      Array.from({ length: API_FAILURE_THRESHOLD + 1 }, (_, index) =>
        createPendingReport({ id: `r-bug-${index}`, maskedAt: daysAgo(365) }),
      ),
    );

    const result = await processReportDeletion(mockPrisma as never);

    expect(result.errors).toHaveLength(API_FAILURE_THRESHOLD + 1);
    expect(mockPrisma.report.updateMany).not.toHaveBeenCalled();
    expect(result.contentErased).toEqual([]);
    expect(result.pseudonymizationOutage).toBe(false);
    // Chaque dossier est tenté : une erreur de code ne déclenche pas le disjoncteur.
    expect(pseudonymizeReportContent).toHaveBeenCalledTimes(
      API_FAILURE_THRESHOLD + 1,
    );
  });

  it("reprend un signalement masqué resté en attente", async () => {
    mockPasses(
      [],
      [createPendingReport({ id: "r-pending", answers: [{ id: "answer-1" }] })],
    );

    const result = await processReportDeletion(mockPrisma as never);

    expect(result.pseudonymized).toContainEqual({ id: "r-pending" });
    // Le pipeline reçoit l'identité réelle, relue en base : c'est elle qu'il
    // doit retirer du texte.
    expect(pseudonymizeReportContent).toHaveBeenCalledWith(
      "r-pending",
      expect.objectContaining({ firstName: "Réel", lastName: "Citoyen" }),
    );
    // L'identité anonymisée est écrite dans la même transaction que le texte.
    expect(mockPrisma.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r-pending", status: ReportStatus.DELETED },
        data: expect.objectContaining({
          pseudonymizationStatus: "DONE",
          subject: "",
          firstName: "Anonymisé",
          lastName: "Anonymisé",
          maritalName: null,
          birthDate: "00/00/0000",
          phone: null,
          nir: null,
        }),
      }),
    );
  });

  it("laisse en attente un signalement masqué récemment dont le caviardage échoue", async () => {
    givenOutcome("REFUSED");
    mockPasses([], [createPendingReport({ id: "r-young" })]);

    const result = await processReportDeletion(mockPrisma as never);

    expect(result.awaitingPseudonymization).toContainEqual({ id: "r-young" });
    expect(result.contentErased).toEqual([]);
    expect(mockPrisma.report.updateMany).not.toHaveBeenCalled();
  });

  it("remplace le texte par un marqueur passé le délai de grâce", async () => {
    givenOutcome("REFUSED");
    mockPasses(
      [],
      [
        createPendingReport({
          id: "r-old",
          answers: [{ id: "answer-1", isMetadataOnly: false }],
          maskedAt: daysAgo(PSEUDONYMIZATION_GRACE_DAYS + 1),
        }),
      ],
    );

    const result = await processReportDeletion(mockPrisma as never);

    expect(result.contentErased).toContainEqual({ id: "r-old" });
    expect(mockPrisma.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: "Contenu supprimé",
          pseudonymizationStatus: "FAKE",
          firstName: "Anonymisé",
          lastName: "Anonymisé",
          birthDate: "00/00/0000",
        }),
      }),
    );
    expect(mockPrisma.answer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { content: "Contenu supprimé" },
      }),
    );
  });

  it("n'efface aucun texte pendant une panne, même très au-delà du délai", async () => {
    givenOutcome("OUTAGE");
    mockPasses(
      [],
      Array.from({ length: 5 }, (_, index) =>
        createPendingReport({ id: `r-old-${index}`, maskedAt: daysAgo(365) }),
      ),
    );

    const result = await processReportDeletion(mockPrisma as never);

    expect(result.contentErased).toEqual([]);
    expect(mockPrisma.report.updateMany).not.toHaveBeenCalled();
  });

  it("arrête la reprise après une panne sans sous-estimer le stock en attente", async () => {
    givenOutcome("OUTAGE");
    mockPrisma.report.count.mockResolvedValue(5);
    mockPasses(
      [],
      Array.from({ length: 5 }, (_, index) =>
        createPendingReport({ id: `r-old-${index}`, maskedAt: daysAgo(365) }),
      ),
    );

    const result = await processReportDeletion(mockPrisma as never);

    // On cesse d'appeler le pipeline dès la panne constatée…
    expect(result.awaitingPseudonymization.length).toBeLessThan(5);
    // …mais l'alerte porte sur le stock complet, relu en base.
    expect(result.awaitingPseudonymizationCount).toBe(5);
  });

  it("ne remplace jamais le contenu d'une réponse metadata-only", async () => {
    givenOutcome("REFUSED");
    mockPasses(
      [],
      [
        createPendingReport({
          id: "r-old",
          answers: [
            { id: "answer-1", isMetadataOnly: false },
            { id: "answer-meta", isMetadataOnly: true },
          ],
          maskedAt: daysAgo(PSEUDONYMIZATION_GRACE_DAYS + 1),
        }),
      ],
    );

    await processReportDeletion(mockPrisma as never);

    const updated = mockPrisma.answer.update.mock.calls.map(
      (call: [{ where: { id: string } }]) => call[0].where.id,
    );
    expect(updated).toEqual(["answer-1"]);
  });

  it("ne lance pas la reprise quand le pipeline est désactivé", async () => {
    delete process.env.REPORT_PSEUDONYMIZATION_ENABLED;
    mockPasses([], [createPendingReport({ id: "r-pending" })]);

    const result = await processReportDeletion(mockPrisma as never);

    expect(pseudonymizeReportContent).not.toHaveBeenCalled();
    expect(result.pseudonymized).toEqual([]);
  });

  it("dit au rapport si le pipeline était activé", async () => {
    mockPasses([], []);
    expect(
      (await processReportDeletion(mockPrisma as never))
        .pseudonymizationEnabled,
    ).toBe(true);

    delete process.env.REPORT_PSEUDONYMIZATION_ENABLED;
    expect(
      (await processReportDeletion(mockPrisma as never))
        .pseudonymizationEnabled,
    ).toBe(false);
  });

  it("ne relit pas le stock en attente quand le pipeline est désactivé", async () => {
    delete process.env.REPORT_PSEUDONYMIZATION_ENABLED;
    mockPrisma.report.count.mockResolvedValue(7);
    mockPasses([createClosedReport({ id: "r-off" })], []);

    const result = await processReportDeletion(mockPrisma as never);

    expect(mockPrisma.report.count).not.toHaveBeenCalled();
    expect(result.awaitingPseudonymizationCount).toBe(0);
  });

  it("traite les dossiers un par un quand le pipeline est désactivé, de front sinon", async () => {
    mockPasses([createClosedReport({ id: "r-on" })], []);
    await processReportDeletion(mockPrisma as never);
    expect(mapWithConcurrency).toHaveBeenLastCalledWith(
      expect.anything(),
      REDACTION_CONCURRENCY,
      expect.any(Function),
    );

    delete process.env.REPORT_PSEUDONYMIZATION_ENABLED;
    mockPasses([createClosedReport({ id: "r-off" })], []);
    await processReportDeletion(mockPrisma as never);
    expect(mapWithConcurrency).toHaveBeenLastCalledWith(
      expect.anything(),
      1,
      expect.any(Function),
    );
  });

  describe("texte déjà pseudonymisé par le cron de pseudonymisation", () => {
    const STORED = {
      subject: "Sujet réel",
      description: "Description réelle",
      firstName: "Réel",
      lastName: "Citoyen",
      maritalName: null,
      birthDate: "01/01/1980",
      author: null,
      pseudonymized: { subject: "Sujet [NOM_1]", description: "Desc [NOM_1]" },
      answers: [
        {
          id: "answer-1",
          content: "Réponse réelle",
          author: null,
          pseudonymized: { content: "Réponse [NOM_2]" },
        },
      ],
    };

    it("reprend le texte stocké sans appeler le pipeline", async () => {
      mockPrisma.report.findUnique.mockResolvedValue(STORED);
      mockPasses([createClosedReport({ id: "r-stored" })], []);

      const result = await processReportDeletion(mockPrisma as never);

      expect(pseudonymizeReportContent).not.toHaveBeenCalled();
      expect(result.pseudonymized).toContainEqual({ id: "r-stored" });
      expect(mockPrisma.report.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject: "",
            description: "",
            pseudonymizationStatus: "DONE",
            firstName: "Anonymisé",
          }),
        }),
      );
      expect(mockPrisma.answer.update).toHaveBeenCalledWith({
        where: { id: "answer-1" },
        data: { content: "" },
      });
      expect(mockPrisma.pseudonymizedReport.deleteMany).not.toHaveBeenCalled();
    });

    it("reprend le texte stocké même pendant une panne du pipeline", async () => {
      givenOutcome("OUTAGE");
      mockPrisma.report.findUnique.mockImplementation(
        async (args: { where: { id: string } }) =>
          args.where.id === "r-stored"
            ? STORED
            : { ...STORED, pseudonymized: null },
      );
      mockPasses(
        [
          ...Array.from({ length: API_FAILURE_THRESHOLD }, (_, index) =>
            createClosedReport({ id: `r-outage-${index}` }),
          ),
          createClosedReport({ id: "r-stored" }),
        ],
        [],
      );
      (mapWithConcurrency as jest.Mock).mockImplementationOnce(
        async (
          items: unknown[],
          _concurrency: number,
          run: (item: unknown) => Promise<void>,
        ) => {
          for (const item of items) await run(item);
        },
      );

      const result = await processReportDeletion(mockPrisma as never);

      expect(result.pseudonymizationOutage).toBe(true);
      expect(pseudonymizeReportContent).toHaveBeenCalledTimes(
        API_FAILURE_THRESHOLD,
      );
      expect(result.pseudonymized).toEqual([{ id: "r-stored" }]);
    });

    it("ne caviarde que les réponses arrivées après le texte stocké", async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        ...STORED,
        answers: [
          ...STORED.answers,
          {
            id: "answer-2",
            content: "Nouvelle",
            author: null,
            pseudonymized: null,
          },
        ],
      });
      givenOutcome("DONE", {
        subject: "",
        description: "",
        answers: [{ id: "answer-2", content: "Nouvelle [NOM_3]" }],
      });
      mockPasses([createClosedReport({ id: "r-partial" })], []);

      const result = await processReportDeletion(mockPrisma as never);

      const scope = (pseudonymizeReportContent as jest.Mock).mock.calls[0][2];
      expect(scope.includeReport).toBe(false);
      expect([...scope.answerIds]).toEqual(["answer-2"]);
      expect(mockPrisma.pseudonymizedAnswer.createMany).toHaveBeenCalledWith({
        data: [{ answerId: "answer-2", content: "Nouvelle [NOM_3]" }],
        skipDuplicates: true,
      });
      expect(result.pseudonymized).toContainEqual({ id: "r-partial" });
      expect(mockPrisma.answer.update).toHaveBeenCalledWith({
        where: { id: "answer-2" },
        data: { content: "" },
      });
      expect(mockPrisma.report.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subject: "" }),
        }),
      );
    });

    it("n'utilise pas le texte stocké quand le pipeline est désactivé, et le supprime", async () => {
      delete process.env.REPORT_PSEUDONYMIZATION_ENABLED;
      mockPrisma.report.findUnique.mockResolvedValue(STORED);
      mockPasses([createClosedReport({ id: "r-off" })], []);

      await processReportDeletion(mockPrisma as never);

      const data = mockPrisma.report.updateMany.mock.calls[0][0].data;
      expect(data.pseudonymizationStatus).toBe("FAKE");
      expect(mockPrisma.pseudonymizedReport.deleteMany).toHaveBeenCalledWith({
        where: { reportId: "r-off" },
      });
      expect(mockPrisma.pseudonymizedAnswer.deleteMany).toHaveBeenCalledWith({
        where: { answer: { reportId: "r-off" } },
      });
    });

    it("supprime le texte stocké quand on renonce passé le délai de grâce", async () => {
      givenOutcome("REFUSED");
      mockPasses(
        [],
        [
          createPendingReport({
            id: "r-old",
            maskedAt: daysAgo(PSEUDONYMIZATION_GRACE_DAYS + 1),
          }),
        ],
      );

      await processReportDeletion(mockPrisma as never);

      expect(mockPrisma.pseudonymizedReport.deleteMany).toHaveBeenCalledWith({
        where: { reportId: "r-old" },
      });
    });
  });
});
