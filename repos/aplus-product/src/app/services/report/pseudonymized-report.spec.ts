import {
  discardPseudonymizedPieces,
  pseudonymizeMissingPieces,
  type ReportContentWithPseudonymized,
} from "./pseudonymized-report";
import { pseudonymizeReportContent } from "./report-pseudonymization";

jest.mock("./report-pseudonymization", () => ({
  ...jest.requireActual("./report-pseudonymization"),
  pseudonymizeReportContent: jest.fn(),
}));

const pseudonymize = pseudonymizeReportContent as jest.Mock;

function createMockPrisma() {
  const client = {
    pseudonymizedReport: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    pseudonymizedAnswer: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
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

function report(
  overrides: Partial<ReportContentWithPseudonymized> = {},
): ReportContentWithPseudonymized {
  return {
    subject: "Sujet réel",
    description: "Description réelle",
    firstName: "Réel",
    lastName: "Citoyen",
    maritalName: null,
    birthDate: "01/01/1980",
    author: null,
    pseudonymized: null,
    answers: [
      { id: "a1", content: "Réponse 1", author: null, pseudonymized: null },
    ],
    ...overrides,
  };
}

describe("pseudonymizeMissingPieces", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrisma();
  });

  it("caviarde tout le dossier quand rien n'est stocké, puis stocke chaque morceau", async () => {
    pseudonymize.mockResolvedValue({
      outcome: "DONE",
      content: {
        subject: "S",
        description: "D",
        answers: [{ id: "a1", content: "R1" }],
      },
    });

    const attempt = await pseudonymizeMissingPieces(
      prisma as never,
      "r",
      report(),
    );

    expect(pseudonymize).toHaveBeenCalledWith("r", expect.anything());
    expect(prisma.pseudonymizedReport.createMany).toHaveBeenCalledWith({
      data: [{ reportId: "r", subject: "S", description: "D" }],
      skipDuplicates: true,
    });
    expect(prisma.pseudonymizedAnswer.createMany).toHaveBeenCalledWith({
      data: [{ answerId: "a1", content: "R1" }],
      skipDuplicates: true,
    });
    expect(
      prisma.reportPseudonymizationRefusal.deleteMany,
    ).toHaveBeenCalledWith({ where: { reportId: "r" } });
    expect(attempt).toEqual({
      outcome: "DONE",
      content: {
        subject: "S",
        description: "D",
        answers: [{ id: "a1", content: "R1" }],
      },
    });
  });

  it("ne caviarde que les réponses en attente, numérotées après les jetons posés", async () => {
    pseudonymize.mockResolvedValue({
      outcome: "DONE",
      content: {
        subject: "",
        description: "",
        answers: [{ id: "a2", content: "R2 [NOM_3]" }],
      },
    });

    const attempt = await pseudonymizeMissingPieces(
      prisma as never,
      "r",
      report({
        pseudonymized: { subject: "S [NOM_1]", description: "D" },
        answers: [
          {
            id: "a1",
            content: "Réponse 1",
            author: null,
            pseudonymized: { content: "R1 [NOM_2]" },
          },
          { id: "a2", content: "Réponse 2", author: null, pseudonymized: null },
        ],
      }),
    );

    const scope = pseudonymize.mock.calls[0][2];
    expect(scope.includeReport).toBe(false);
    expect([...scope.answerIds]).toEqual(["a2"]);
    expect(scope.tokenOffsets.NAME).toBe(2);
    // Le sujet déjà stocké n'est jamais réécrit.
    expect(prisma.pseudonymizedReport.createMany).not.toHaveBeenCalled();
    expect(prisma.pseudonymizedAnswer.createMany).toHaveBeenCalledWith({
      data: [{ answerId: "a2", content: "R2 [NOM_3]" }],
      skipDuplicates: true,
    });
    expect(attempt.content).toEqual({
      subject: "S [NOM_1]",
      description: "D",
      answers: [
        { id: "a1", content: "R1 [NOM_2]" },
        { id: "a2", content: "R2 [NOM_3]" },
      ],
    });
  });

  it("ne stocke rien sur un refus ou une panne", async () => {
    for (const outcome of ["REFUSED", "OUTAGE"]) {
      pseudonymize.mockResolvedValueOnce({ outcome });

      const attempt = await pseudonymizeMissingPieces(
        prisma as never,
        "r",
        report(),
      );

      expect(attempt.outcome).toBe(outcome);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("discardPseudonymizedPieces", () => {
  it("supprime le sujet et toutes les réponses pseudonymisés du dossier", async () => {
    const prisma = createMockPrisma();

    await discardPseudonymizedPieces(prisma as never, "r");

    expect(prisma.pseudonymizedReport.deleteMany).toHaveBeenCalledWith({
      where: { reportId: "r" },
    });
    expect(prisma.pseudonymizedAnswer.deleteMany).toHaveBeenCalledWith({
      where: { answer: { reportId: "r" } },
    });
  });
});
