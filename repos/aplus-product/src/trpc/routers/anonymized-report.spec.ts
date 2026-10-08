import { createCallerFactory } from "../init";
import { anonymizedReportRouter } from "./anonymized-report";
import prisma from "@/lib/prisma";
import { createMockUser, MOCK_IDS, USER_ROLES } from "@/test/mocks";
import { ANONYMIZED_REPORTS_PAGE_SIZE } from "@/utils/anonymized-report";
import { OTHER_GOLDEN_TAG } from "@/utils/golden-dataset-tag";

jest.mock("@/lib/auth", () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock("@/lib/prisma", () => {
  const mock = {
    report: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    reportTagging: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
    },
  };
  return { __esModule: true, default: mock, prisma: mock };
});

const createCaller = createCallerFactory(anonymizedReportRouter);

function adminCaller() {
  return createCaller({
    userId: MOCK_IDS.USER_1,
    user: createMockUser({ id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN }),
  });
}

function userCaller() {
  return createCaller({
    userId: MOCK_IDS.USER_2,
    user: createMockUser({ id: MOCK_IDS.USER_2, role: USER_ROLES.USER }),
  });
}

const PROCEDURE = "demande rsa";
const BLOCKAGE = "détresse numérique";
const CREATED_AT = new Date("2026-01-15T10:00:00.000Z");

const CITIZEN_AND_CLEAR_TEXT_FIELDS = [
  "subject",
  "description",
  "content",
  "firstName",
  "lastName",
  "maritalName",
  "birthDate",
  "phone",
  "caf",
  "nir",
  "nif",
  "files",
  "user",
];

/** Chemins pointés d'un `select` Prisma, ex. `pseudonymized.subject`. */
function selectedPaths(select: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(select).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === true) return [path];
    if (value && typeof value === "object" && "select" in value) {
      return selectedPaths(value.select as Record<string, unknown>, path);
    }
    return [];
  });
}

function expectOnlyPseudonymizedText(paths: string[]) {
  const leaks = paths.filter((path) => {
    const segments = path.split(".");
    const field = segments[segments.length - 1];
    return (
      !segments.includes("pseudonymized") &&
      CITIZEN_AND_CLEAR_TEXT_FIELDS.includes(field)
    );
  });
  expect(leaks).toEqual([]);
}

describe("anonymizedReportRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe("list", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      await expect(userCaller().list({ page: 1 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.report.findMany).not.toHaveBeenCalled();
    });

    it("selects only pseudonymized text", async () => {
      (prisma.report.count as jest.Mock).mockResolvedValue(0);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().list({ page: 1 });

      const { select } = (prisma.report.findMany as jest.Mock).mock.calls[0][0];
      const paths = selectedPaths(select);
      expect(paths).toEqual(["id", "createdAt", "pseudonymized.subject"]);
      expectOnlyPseudonymizedText(paths);
    });

    it("pages pseudonymized reports newest first with their tags", async () => {
      (prisma.report.count as jest.Mock).mockResolvedValue(45);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([
        {
          id: "report-1",
          createdAt: CREATED_AT,
          pseudonymized: { subject: "Dossier de [NOM_1] bloqué" },
        },
        {
          id: "report-2",
          createdAt: CREATED_AT,
          pseudonymized: { subject: "Sans étiquette" },
        },
      ]);
      (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
        {
          reportId: "report-1",
          procedureLabel: "Demande RSA",
          blockageLabel: "déménagement",
        },
      ]);

      const result = await adminCaller().list({ page: 3 });

      expect(result).toEqual({
        total: 45,
        pageSize: ANONYMIZED_REPORTS_PAGE_SIZE,
        items: [
          {
            id: "report-1",
            createdAt: CREATED_AT,
            subject: "Dossier de [NOM_1] bloqué",
            procedureLabel: "demande rsa",
            blockageLabel: "déménagement",
          },
          {
            id: "report-2",
            createdAt: CREATED_AT,
            subject: "Sans étiquette",
            procedureLabel: null,
            blockageLabel: null,
          },
        ],
      });
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pseudonymized: { isNot: null }, taggings: { some: {} } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: 2 * ANONYMIZED_REPORTS_PAGE_SIZE,
          take: ANONYMIZED_REPORTS_PAGE_SIZE,
        }),
      );
      expect(prisma.reportTagging.findMany).toHaveBeenCalledWith({
        where: { reportId: { in: ["report-1", "report-2"] } },
        orderBy: { createdAt: "asc" },
        select: {
          reportId: true,
          procedureLabel: true,
          blockageLabel: true,
        },
      });
    });

    it("filters on every stored spelling of the labels, across recipes", async () => {
      (prisma.reportTagging.findMany as jest.Mock).mockImplementation(
        ({ distinct }: { distinct: string[] }) =>
          Promise.resolve(
            distinct[0] === "procedureLabel"
              ? [
                  { procedureLabel: "demande rsa", blockageLabel: null },
                  { procedureLabel: "Demande RSA", blockageLabel: null },
                  { procedureLabel: "demande apl", blockageLabel: null },
                  { procedureLabel: null, blockageLabel: null },
                ]
              : [
                  { procedureLabel: null, blockageLabel: "Detresse numerique" },
                  { procedureLabel: null, blockageLabel: "dette" },
                ],
          ),
      );
      (prisma.report.count as jest.Mock).mockResolvedValue(0);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().list({
        page: 1,
        procedureLabel: PROCEDURE,
        blockageLabel: BLOCKAGE,
      });

      for (const column of ["procedureLabel", "blockageLabel"]) {
        expect(prisma.reportTagging.findMany).toHaveBeenCalledWith({
          distinct: [column],
          select: { procedureLabel: true, blockageLabel: true },
        });
      }
      const expectedWhere = {
        pseudonymized: { isNot: null },
        taggings: {
          some: {
            procedureLabel: { in: ["demande rsa", "Demande RSA"] },
            blockageLabel: { in: ["Detresse numerique"] },
          },
        },
      };
      expect(prisma.report.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("restricts to reports sent to a team of the operator", async () => {
      (prisma.report.count as jest.Mock).mockResolvedValue(0);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().list({ page: 1, operator: "CAF" });

      const expectedWhere = {
        pseudonymized: { isNot: null },
        taggings: { some: {} },
        requestedTeams: {
          some: { organization: { shortName: "CAF" } },
        },
      };
      expect(prisma.report.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("includes the untagged reports on request", async () => {
      (prisma.report.count as jest.Mock).mockResolvedValue(0);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().list({ page: 1, includeUntagged: true });

      const expectedWhere = { pseudonymized: { isNot: null } };
      expect(prisma.report.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("keeps the tag condition when untagged reports are included", async () => {
      (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
        { procedureLabel: PROCEDURE, blockageLabel: null },
      ]);
      (prisma.report.count as jest.Mock).mockResolvedValue(0);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().list({
        page: 1,
        includeUntagged: true,
        procedureLabel: PROCEDURE,
      });

      const { where } = (prisma.report.count as jest.Mock).mock.calls[0][0];
      expect(where.taggings.some).toEqual({
        procedureLabel: { in: [PROCEDURE] },
      });
    });

    it("combines the operator with the tag filters", async () => {
      (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
        { procedureLabel: PROCEDURE, blockageLabel: null },
      ]);
      (prisma.report.count as jest.Mock).mockResolvedValue(0);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().list({
        page: 1,
        operator: "CAF",
        procedureLabel: PROCEDURE,
      });

      const { where } = (prisma.report.count as jest.Mock).mock.calls[0][0];
      expect(where.requestedTeams).toEqual({
        some: { organization: { shortName: "CAF" } },
      });
      expect(where.taggings.some).toEqual({
        procedureLabel: { in: [PROCEDURE] },
      });
    });

    it("leaves an unfiltered axis out of the condition", async () => {
      (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
        { procedureLabel: PROCEDURE, blockageLabel: null },
      ]);
      (prisma.report.count as jest.Mock).mockResolvedValue(0);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().list({
        page: 1,
        procedureLabel: PROCEDURE,
      });

      expect(prisma.reportTagging.findMany).toHaveBeenCalledTimes(1);
      const { where } = (prisma.report.count as jest.Mock).mock.calls[0][0];
      expect(where.taggings.some).toEqual({
        procedureLabel: { in: [PROCEDURE] },
      });
    });

    it("matches nothing without querying reports when no stored label matches", async () => {
      (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
        { procedureLabel: "demande apl", blockageLabel: null },
      ]);

      const result = await adminCaller().list({
        page: 1,
        procedureLabel: PROCEDURE,
      });

      expect(result).toEqual({
        total: 0,
        pageSize: ANONYMIZED_REPORTS_PAGE_SIZE,
        items: [],
      });
      expect(prisma.report.count).not.toHaveBeenCalled();
      expect(prisma.report.findMany).not.toHaveBeenCalled();
    });

    it("lists untagged reports when no tagging exists", async () => {
      (prisma.report.count as jest.Mock).mockResolvedValue(1);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([
        {
          id: "report-1",
          createdAt: CREATED_AT,
          pseudonymized: { subject: "Sujet" },
        },
      ]);

      const result = await adminCaller().list({ page: 1 });

      expect(result.items).toEqual([
        {
          id: "report-1",
          createdAt: CREATED_AT,
          subject: "Sujet",
          procedureLabel: null,
          blockageLabel: null,
        },
      ]);
    });

    it("keeps the tags of a previous model and shows the most recent", async () => {
      (prisma.report.count as jest.Mock).mockResolvedValue(1);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([
        {
          id: "report-1",
          createdAt: CREATED_AT,
          pseudonymized: { subject: "Sujet" },
        },
      ]);
      (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
        {
          reportId: "report-1",
          procedureLabel: "demande apl",
          blockageLabel: "dette",
        },
        {
          reportId: "report-1",
          procedureLabel: "demande rsa",
          blockageLabel: "déménagement",
        },
      ]);

      const result = await adminCaller().list({ page: 1 });

      expect(result.items[0]).toMatchObject({
        procedureLabel: "demande rsa",
        blockageLabel: "déménagement",
      });
    });

    it("matches nothing when filtering without any tagging", async () => {
      const result = await adminCaller().list({
        page: 1,
        procedureLabel: PROCEDURE,
      });

      expect(result).toEqual({
        total: 0,
        pageSize: ANONYMIZED_REPORTS_PAGE_SIZE,
        items: [],
      });
      expect(prisma.report.findMany).not.toHaveBeenCalled();
    });

    it("rejects a label outside the team labels of its axis", async () => {
      for (const input of [
        { procedureLabel: "pas un libellé" },
        { procedureLabel: BLOCKAGE },
        { procedureLabel: "RSA" },
        { blockageLabel: "inconnu" },
        { blockageLabel: OTHER_GOLDEN_TAG },
      ]) {
        await expect(
          adminCaller().list({ page: 1, ...input }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
    });

    it("accepts a team label filed under « autre »", async () => {
      (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
        { procedureLabel: null, blockageLabel: "Déménagement" },
      ]);
      (prisma.report.count as jest.Mock).mockResolvedValue(0);
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().list({ page: 1, blockageLabel: "déménagement" });

      const { where } = (prisma.report.count as jest.Mock).mock.calls[0][0];
      expect(where.taggings.some).toEqual({
        blockageLabel: { in: ["Déménagement"] },
      });
    });
  });

  describe("operators", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      await expect(userCaller().operators()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it("lists the organizations that received a pseudonymized report", async () => {
      const operators = [{ shortName: "CAF", name: "Caisse" }];
      (prisma.organization.findMany as jest.Mock).mockResolvedValue(operators);

      await expect(adminCaller().operators()).resolves.toEqual(operators);
      expect(prisma.organization.findMany).toHaveBeenCalledWith({
        where: {
          teams: {
            some: { reports: { some: { pseudonymized: { isNot: null } } } },
          },
        },
        orderBy: { shortName: "asc" },
        select: { shortName: true, name: true },
      });
    });
  });

  describe("getById", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      await expect(
        userCaller().getById({ id: "report-1" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prisma.report.findFirst).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when the report is not pseudonymized", async () => {
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        adminCaller().getById({ id: "report-1" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(prisma.report.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "report-1", pseudonymized: { isNot: null } },
        }),
      );
    });

    it("selects only pseudonymized text", async () => {
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        adminCaller().getById({ id: "report-1" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      const { select } = (prisma.report.findFirst as jest.Mock).mock
        .calls[0][0];
      const paths = selectedPaths(select);
      expect(paths).toEqual([
        "id",
        "createdAt",
        "authorId",
        "coAuthors.id",
        "requestedTeams.id",
        "requestedTeams.name",
        "pseudonymized.subject",
        "pseudonymized.description",
        "answers.id",
        "answers.createdAt",
        "answers.authorId",
        "answers.author.teams.id",
        "answers.author.teams.organization.name",
        "answers.author.teams.organization.shortName",
        "answers.author.deactivatedTeamSnapshot.teams.id",
        "answers.author.deactivatedTeamSnapshot.teams.organization.name",
        "answers.author.deactivatedTeamSnapshot.teams.organization.shortName",
        "answers.pseudonymized.content",
      ]);
      expectOnlyPseudonymizedText(paths);
    });

    it("returns sided answers with their operator, deactivated authors included", async () => {
      (prisma.report.findFirst as jest.Mock).mockResolvedValue({
        id: "report-1",
        createdAt: CREATED_AT,
        authorId: "author",
        coAuthors: [{ id: "co-author" }],
        requestedTeams: [
          { id: "caf-team", name: "CAF Essonne" },
          { id: "cpam-team", name: "CPAM Essonne" },
        ],
        pseudonymized: {
          subject: "Dossier de [NOM_1] bloqué",
          description: "Bonjour,\nje suis [NOM_1].",
        },
        answers: [
          {
            id: "answer-1",
            createdAt: CREATED_AT,
            authorId: "operator",
            author: {
              teams: [
                {
                  id: "other-team",
                  organization: { name: "Autre", shortName: "AUTRE" },
                },
                {
                  id: "caf-team",
                  organization: { name: "Caisse", shortName: "CAF" },
                },
              ],
            },
            pseudonymized: { content: "Pièce manquante." },
          },
          {
            id: "answer-2",
            createdAt: CREATED_AT,
            authorId: "co-author",
            author: {
              teams: [
                {
                  id: "helper-team",
                  organization: { name: "France Services", shortName: "FS" },
                },
              ],
            },
            pseudonymized: { content: "Envoyée." },
          },
          {
            id: "answer-3",
            createdAt: CREATED_AT,
            authorId: "deactivated-operator",
            author: {
              teams: [],
              deactivatedTeamSnapshot: {
                teams: [
                  {
                    id: "cpam-team",
                    organization: { name: "CPAM", shortName: "" },
                  },
                ],
              },
            },
            pseudonymized: { content: "Dossier débloqué." },
          },
        ],
      });
      (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
        {
          reportId: "report-1",
          procedureLabel: PROCEDURE,
          blockageLabel: "DÉTRESSE NUMÉRIQUE",
        },
      ]);

      const result = await adminCaller().getById({ id: "report-1" });

      expect(result).toEqual({
        id: "report-1",
        createdAt: CREATED_AT,
        subject: "Dossier de [NOM_1] bloqué",
        description: "Bonjour,\nje suis [NOM_1].",
        requestedTeams: ["CAF Essonne", "CPAM Essonne"],
        procedureLabel: "demande rsa",
        blockageLabel: "détresse numérique",
        answers: [
          {
            id: "answer-1",
            createdAt: CREATED_AT,
            content: "Pièce manquante.",
            side: "operator",
            operator: "CAF",
          },
          {
            id: "answer-2",
            createdAt: CREATED_AT,
            content: "Envoyée.",
            side: "applicant",
            operator: null,
          },
          {
            id: "answer-3",
            createdAt: CREATED_AT,
            content: "Dossier débloqué.",
            side: "operator",
            operator: "CPAM",
          },
        ],
      });
      expect(prisma.report.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            answers: expect.objectContaining({
              where: { isMetadataOnly: false, pseudonymized: { isNot: null } },
              orderBy: { createdAt: "asc" },
            }),
            requestedTeams: expect.objectContaining({
              orderBy: { name: "asc" },
            }),
          }),
        }),
      );
    });
  });
});
