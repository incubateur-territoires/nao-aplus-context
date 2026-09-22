import { createCallerFactory } from "../init";
import { goldenDatasetRouter } from "./golden-dataset";
import prisma from "@/lib/prisma";
import { createMockUser, MOCK_IDS, USER_ROLES } from "@/test/mocks";

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => {
  const mock = {
    goldenDatasetItem: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    goldenDatasetAnnotation: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    goldenDatasetRun: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return { __esModule: true, default: mock, prisma: mock };
});

const createCaller = createCallerFactory(goldenDatasetRouter);

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

describe("goldenDatasetRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      (operations: Promise<unknown>[]) => Promise.all(operations),
    );
    (prisma.goldenDatasetItem.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.goldenDatasetRun.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe("getItem", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      await expect(userCaller().getItem({ position: 1 })).rejects.toMatchObject(
        { code: "FORBIDDEN" },
      );

      expect(prisma.goldenDatasetItem.count).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when the corpus is empty", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.goldenDatasetAnnotation.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      await expect(
        adminCaller().getItem({ position: 1 }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Le corpus n'a pas encore été constitué.",
      });
    });

    it("throws NOT_FOUND when the position is beyond the corpus size", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(30);
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.goldenDatasetAnnotation.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      await expect(
        adminCaller().getItem({ position: 31 }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Le corpus ne compte que 30 signalements.",
      });
    });

    it("returns the item, the caller annotation and the annotated positions", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(30);
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        subject: "Sujet du signalement",
        description: "Description caviardée",
        organization: "CAF",
        annotations: [{ blockageTag: "delai trop long", procedureTag: null }],
      });
      (prisma.goldenDatasetAnnotation.findMany as jest.Mock).mockResolvedValue([
        { item: { position: 2 } },
        { item: { position: 5 } },
      ]);

      const result = await adminCaller().getItem({ position: 2 });

      expect(result).toEqual({
        total: 30,
        position: 2,
        item: {
          subject: "Sujet du signalement",
          description: "Description caviardée",
          organization: "CAF",
        },
        annotation: { blockageTag: "delai trop long", procedureTag: null },
        annotatedPositions: [2, 5],
        currentAnnotatorId: MOCK_IDS.USER_1,
        progress: [],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.goldenDatasetAnnotation.findMany).toHaveBeenCalledWith({
        where: {
          annotatorId: MOCK_IDS.USER_1,
          OR: [{ blockageTag: { not: null } }, { procedureTag: { not: null } }],
        },
        select: { item: { select: { position: true } } },
        orderBy: { item: { position: "asc" } },
      });
    });

    it("returns a null annotation when the caller has not annotated the item", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(30);
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        subject: "Sujet",
        description: "Description",
        organization: "CPAM",
        annotations: [],
      });
      (prisma.goldenDatasetAnnotation.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await adminCaller().getItem({ position: 1 });

      expect(result.annotation).toBeNull();
      expect(result.annotatedPositions).toEqual([]);
    });

    it("ranks the annotators by count then first name", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(30);
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        subject: "Sujet",
        description: "Description",
        organization: "CPAM",
        annotations: [],
      });
      (prisma.goldenDatasetAnnotation.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: MOCK_IDS.USER_1,
          firstName: "Zoé",
          lastName: "Martin",
          _count: { goldenDatasetAnnotations: 0 },
        },
        {
          id: MOCK_IDS.USER_2,
          firstName: "Bruno",
          lastName: "Leroy",
          _count: { goldenDatasetAnnotations: 12 },
        },
        {
          id: MOCK_IDS.USER_3,
          firstName: "Alice",
          lastName: "Durand",
          _count: { goldenDatasetAnnotations: 12 },
        },
      ]);

      const result = await adminCaller().getItem({ position: 1 });

      expect(result.progress).toEqual([
        {
          annotatorId: MOCK_IDS.USER_3,
          firstName: "Alice",
          lastName: "Durand",
          annotated: 12,
        },
        {
          annotatorId: MOCK_IDS.USER_2,
          firstName: "Bruno",
          lastName: "Leroy",
          annotated: 12,
        },
        {
          annotatorId: MOCK_IDS.USER_1,
          firstName: "Zoé",
          lastName: "Martin",
          annotated: 0,
        },
      ]);
      expect(result.currentAnnotatorId).toBe(MOCK_IDS.USER_1);
    });

    it("counts the annotators who posted a tag, plus the caller at zero", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(30);
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        subject: "Sujet",
        description: "Description",
        organization: "CPAM",
        annotations: [],
      });
      (prisma.goldenDatasetAnnotation.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      await adminCaller().getItem({ position: 1 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: MOCK_IDS.USER_1 },
            {
              goldenDatasetAnnotations: {
                some: {
                  OR: [
                    { blockageTag: { not: null } },
                    { procedureTag: { not: null } },
                  ],
                },
              },
            },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          _count: {
            select: {
              goldenDatasetAnnotations: {
                where: {
                  OR: [
                    { blockageTag: { not: null } },
                    { procedureTag: { not: null } },
                  ],
                },
              },
            },
          },
        },
      });
    });
  });

  describe("saveAnnotation", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      await expect(
        userCaller().saveAnnotation({
          position: 1,
          blockageTag: "delai",
          procedureTag: "rsa",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(prisma.goldenDatasetAnnotation.upsert).not.toHaveBeenCalled();
    });

    it("rejects a tag of more than five words", async () => {
      await expect(
        adminCaller().saveAnnotation({
          position: 1,
          blockageTag: "un tag vraiment beaucoup beaucoup trop long",
          procedureTag: null,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining(
          "Le tag doit rester court : 5 mots au maximum.",
        ),
      });

      expect(prisma.goldenDatasetAnnotation.upsert).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when no item sits at this position", async () => {
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        adminCaller().saveAnnotation({
          position: 99,
          blockageTag: "delai",
          procedureTag: null,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(prisma.goldenDatasetAnnotation.upsert).not.toHaveBeenCalled();
    });

    it("upserts on the composite key with the caller as annotator", async () => {
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        id: "item-3",
      });
      (prisma.goldenDatasetAnnotation.upsert as jest.Mock).mockResolvedValue(
        {},
      );

      const result = await adminCaller().saveAnnotation({
        position: 3,
        blockageTag: "  Délai  trop long ",
        procedureTag: "RSA",
      });

      expect(result).toEqual({ success: true });
      expect(prisma.goldenDatasetItem.findUnique).toHaveBeenCalledWith({
        where: { position: 3 },
        select: { id: true },
      });
      expect(prisma.goldenDatasetAnnotation.upsert).toHaveBeenCalledWith({
        where: {
          itemId_annotatorId: {
            itemId: "item-3",
            annotatorId: MOCK_IDS.USER_1,
          },
        },
        create: {
          itemId: "item-3",
          annotatorId: MOCK_IDS.USER_1,
          blockageTag: "Délai trop long",
          procedureTag: "RSA",
        },
        update: {
          blockageTag: "Délai trop long",
          procedureTag: "RSA",
        },
      });
    });

    it("normalizes an empty tag to null and writes it as is", async () => {
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        id: "item-4",
      });
      (prisma.goldenDatasetAnnotation.upsert as jest.Mock).mockResolvedValue(
        {},
      );

      await adminCaller().saveAnnotation({
        position: 4,
        blockageTag: "   ",
        procedureTag: "",
      });

      expect(prisma.goldenDatasetAnnotation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: {
            itemId: "item-4",
            annotatorId: MOCK_IDS.USER_1,
            blockageTag: null,
            procedureTag: null,
          },
          update: { blockageTag: null, procedureTag: null },
        }),
      );
    });

    it("writes the same payload twice when called twice", async () => {
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        id: "item-5",
      });
      (prisma.goldenDatasetAnnotation.upsert as jest.Mock).mockResolvedValue(
        {},
      );

      const input = {
        position: 5,
        blockageTag: "delai",
        procedureTag: "rsa",
      };
      await adminCaller().saveAnnotation(input);
      await adminCaller().saveAnnotation(input);

      const calls = (prisma.goldenDatasetAnnotation.upsert as jest.Mock).mock
        .calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual(calls[1]);
    });
  });

  describe("chooseGoldenTags", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      await expect(
        userCaller().chooseGoldenTags({
          position: 1,
          blockageTag: "delai",
          procedureTag: "rsa",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(prisma.goldenDatasetItem.update).not.toHaveBeenCalled();
    });

    it("écrit les deux labels retenus sur l'item de cette position", async () => {
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        id: "item-3",
      });

      const result = await adminCaller().chooseGoldenTags({
        position: 3,
        blockageTag: "  Dossier  bloqué ",
        procedureTag: "RSA",
      });

      expect(result).toEqual({ success: true });
      expect(prisma.goldenDatasetItem.update).toHaveBeenCalledWith({
        where: { position: 3 },
        data: {
          goldenBlockageTag: "Dossier bloqué",
          goldenProcedureTag: "RSA",
        },
      });
    });

    it("remplace le label retenu par celui du dernier appel", async () => {
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        id: "item-3",
      });

      await adminCaller().chooseGoldenTags({
        position: 3,
        blockageTag: "dossier bloqué",
        procedureTag: "rsa",
      });
      await adminCaller().chooseGoldenTags({
        position: 3,
        blockageTag: "pièce manquante",
        procedureTag: "rsa",
      });

      const calls = (prisma.goldenDatasetItem.update as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[1][0].data).toEqual({
        goldenBlockageTag: "pièce manquante",
        goldenProcedureTag: "rsa",
      });
    });

    it("remet un axe à null sans toucher l'autre", async () => {
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue({
        id: "item-3",
      });

      await adminCaller().chooseGoldenTags({
        position: 3,
        blockageTag: null,
        procedureTag: "rsa",
      });

      expect(prisma.goldenDatasetItem.update).toHaveBeenCalledWith({
        where: { position: 3 },
        data: { goldenBlockageTag: null, goldenProcedureTag: "rsa" },
      });
    });

    it("throws NOT_FOUND when no item sits at this position", async () => {
      (prisma.goldenDatasetItem.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        adminCaller().chooseGoldenTags({
          position: 99,
          blockageTag: "delai",
          procedureTag: null,
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Ce signalement du corpus est introuvable.",
      });

      expect(prisma.goldenDatasetItem.update).not.toHaveBeenCalled();
    });

    it("rejects a tag of more than five words", async () => {
      await expect(
        adminCaller().chooseGoldenTags({
          position: 1,
          blockageTag: "un tag vraiment beaucoup beaucoup trop long",
          procedureTag: null,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining(
          "Le tag doit rester court : 5 mots au maximum.",
        ),
      });

      expect(prisma.goldenDatasetItem.update).not.toHaveBeenCalled();
    });
  });

  describe("adjudicateUnanimous", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      await expect(userCaller().adjudicateUnanimous()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(prisma.goldenDatasetItem.updateMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("retient les axes unanimes encore vides", async () => {
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: "item-1",
          goldenBlockageTag: null,
          goldenProcedureTag: null,
          annotations: [
            { blockageTag: "dossier bloqué", procedureTag: "rsa" },
            { blockageTag: "dossier bloqué", procedureTag: "rsa" },
          ],
        },
      ]);

      const result = await adminCaller().adjudicateUnanimous();

      expect(result).toEqual({ filled: 2 });
      expect(prisma.goldenDatasetItem.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.goldenDatasetItem.updateMany).toHaveBeenCalledWith({
        where: { id: "item-1", goldenBlockageTag: null },
        data: { goldenBlockageTag: "dossier bloqué" },
      });
      expect(prisma.goldenDatasetItem.updateMany).toHaveBeenCalledWith({
        where: { id: "item-1", goldenProcedureTag: null },
        data: { goldenProcedureTag: "rsa" },
      });
    });

    it("juge l'unanimité à la casse et aux accents près", async () => {
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: "item-1",
          goldenBlockageTag: null,
          goldenProcedureTag: null,
          annotations: [
            { blockageTag: "Délai anormal", procedureTag: null },
            { blockageTag: "delai anormal", procedureTag: null },
          ],
        },
      ]);

      const result = await adminCaller().adjudicateUnanimous();

      expect(result).toEqual({ filled: 1 });
      expect(prisma.goldenDatasetItem.updateMany).toHaveBeenCalledWith({
        where: { id: "item-1", goldenBlockageTag: null },
        data: { goldenBlockageTag: "Délai anormal" },
      });
    });

    it("n'écrase pas un axe déjà retenu", async () => {
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: "item-1",
          goldenBlockageTag: "pièce manquante",
          goldenProcedureTag: null,
          annotations: [
            { blockageTag: "dossier bloqué", procedureTag: "rsa" },
            { blockageTag: "dossier bloqué", procedureTag: "rsa" },
          ],
        },
      ]);

      const result = await adminCaller().adjudicateUnanimous();

      expect(result).toEqual({ filled: 1 });
      expect(prisma.goldenDatasetItem.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.goldenDatasetItem.updateMany).toHaveBeenCalledWith({
        where: { id: "item-1", goldenProcedureTag: null },
        data: { goldenProcedureTag: "rsa" },
      });
    });

    it("ne compte pas un axe retenu à la main entre la lecture et l'écriture", async () => {
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: "item-1",
          goldenBlockageTag: null,
          goldenProcedureTag: null,
          annotations: [
            { blockageTag: "dossier bloqué", procedureTag: "rsa" },
            { blockageTag: "dossier bloqué", procedureTag: "rsa" },
          ],
        },
      ]);
      // Un chooseGoldenTags concurrent a retenu l'axe procédure entre le
      // findMany et la transaction : sa colonne n'est plus nulle, l'updateMany
      // gardé ne touche aucune ligne.
      (prisma.goldenDatasetItem.updateMany as jest.Mock)
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const result = await adminCaller().adjudicateUnanimous();

      expect(result).toEqual({ filled: 1 });
    });

    it("écrit la forme exacte majoritaire", async () => {
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: "item-1",
          goldenBlockageTag: null,
          goldenProcedureTag: null,
          annotations: [
            { blockageTag: "delai anormal", procedureTag: null },
            { blockageTag: "Délai anormal", procedureTag: null },
            { blockageTag: "delai anormal", procedureTag: null },
          ],
        },
      ]);

      await adminCaller().adjudicateUnanimous();

      expect(prisma.goldenDatasetItem.updateMany).toHaveBeenCalledWith({
        where: { id: "item-1", goldenBlockageTag: null },
        data: { goldenBlockageTag: "delai anormal" },
      });
    });

    it("ne charge que les annotations portant au moins un tag", async () => {
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().adjudicateUnanimous();

      expect(prisma.goldenDatasetItem.findMany).toHaveBeenCalledWith({
        orderBy: { position: "asc" },
        select: {
          id: true,
          goldenBlockageTag: true,
          goldenProcedureTag: true,
          annotations: {
            where: {
              OR: [
                { blockageTag: { not: null } },
                { procedureTag: { not: null } },
              ],
            },
            select: { blockageTag: true, procedureTag: true },
          },
        },
      });
    });

    it("n'émet aucune écriture au rejeu", async () => {
      const annotations = [
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
      ];
      (prisma.goldenDatasetItem.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: "item-1",
            goldenBlockageTag: null,
            goldenProcedureTag: null,
            annotations,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "item-1",
            goldenBlockageTag: "dossier bloqué",
            goldenProcedureTag: "rsa",
            annotations,
          },
        ]);

      await adminCaller().adjudicateUnanimous();
      (prisma.goldenDatasetItem.updateMany as jest.Mock).mockClear();
      (prisma.$transaction as jest.Mock).mockClear();

      const replay = await adminCaller().adjudicateUnanimous();

      expect(replay).toEqual({ filled: 0 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.goldenDatasetItem.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("overview", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      await expect(userCaller().overview()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(prisma.goldenDatasetItem.findMany).not.toHaveBeenCalled();
    });

    it("orders items by position and keys annotations by annotator id", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(2);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: "charles-1",
          firstName: "Charles",
          lastName: "d'Oiron",
          _count: { goldenDatasetAnnotations: 1 },
        },
        {
          id: "charles-2",
          firstName: "Charles",
          lastName: "Le Prévost",
          _count: { goldenDatasetAnnotations: 1 },
        },
      ]);
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([
        {
          position: 1,
          organization: "CAF",
          subject: "Sujet 1",
          description: "Description 1",
          goldenBlockageTag: "delai",
          goldenProcedureTag: null,
          annotations: [
            {
              annotatorId: "charles-1",
              blockageTag: "delai",
              procedureTag: "rsa",
            },
            {
              annotatorId: "charles-2",
              blockageTag: null,
              procedureTag: "rsa",
            },
          ],
          predictions: [
            {
              runId: "run-1",
              blockageTag: "delai",
              procedureTag: "prime activite",
            },
          ],
        },
        {
          position: 2,
          organization: "CPAM",
          subject: "Sujet 2",
          description: "Description 2",
          goldenBlockageTag: null,
          goldenProcedureTag: null,
          annotations: [],
          predictions: [],
        },
      ]);

      const result = await adminCaller().overview();

      expect(result).toEqual({
        total: 2,
        annotators: [
          {
            annotatorId: "charles-1",
            firstName: "Charles",
            lastName: "d'Oiron",
            annotated: 1,
          },
          {
            annotatorId: "charles-2",
            firstName: "Charles",
            lastName: "Le Prévost",
            annotated: 1,
          },
        ],
        runs: [],
        items: [
          {
            position: 1,
            organization: "CAF",
            subject: "Sujet 1",
            description: "Description 1",
            goldenBlockageTag: "delai",
            goldenProcedureTag: null,
            annotations: [
              {
                annotatorId: "charles-1",
                blockageTag: "delai",
                procedureTag: "rsa",
              },
              {
                annotatorId: "charles-2",
                blockageTag: null,
                procedureTag: "rsa",
              },
            ],
            predictions: [
              {
                runId: "run-1",
                blockageTag: "delai",
                procedureTag: "prime activite",
              },
            ],
          },
          {
            position: 2,
            organization: "CPAM",
            subject: "Sujet 2",
            description: "Description 2",
            goldenBlockageTag: null,
            goldenProcedureTag: null,
            annotations: [],
            predictions: [],
          },
        ],
      });
    });

    it("classe les annotateurs par volume annoté, puis par nom", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(10);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: "manon",
          firstName: "Manon",
          lastName: "Duval",
          _count: { goldenDatasetAnnotations: 0 },
        },
        {
          id: "charles-2",
          firstName: "Charles",
          lastName: "Le Prévost",
          _count: { goldenDatasetAnnotations: 4 },
        },
        {
          id: "charles-1",
          firstName: "Charles",
          lastName: "d'Oiron",
          _count: { goldenDatasetAnnotations: 4 },
        },
      ]);
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([]);

      const result = await adminCaller().overview();

      expect(
        result.annotators.map((annotator) => annotator.annotatorId),
      ).toEqual(["charles-1", "charles-2", "manon"]);
    });

    it("liste les admins en activité et ceux qui ont déjà annoté", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().overview();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { role: "admin", isInactive: null, deletedAt: null },
            {
              goldenDatasetAnnotations: {
                some: {
                  OR: [
                    { blockageTag: { not: null } },
                    { procedureTag: { not: null } },
                  ],
                },
              },
            },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          _count: {
            select: {
              goldenDatasetAnnotations: {
                where: {
                  OR: [
                    { blockageTag: { not: null } },
                    { procedureTag: { not: null } },
                  ],
                },
              },
            },
          },
        },
      });
    });

    it("asks Prisma for annotations with at least one tag", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().overview();

      expect(prisma.goldenDatasetItem.findMany).toHaveBeenCalledWith({
        orderBy: { position: "asc" },
        select: {
          position: true,
          organization: true,
          subject: true,
          description: true,
          goldenBlockageTag: true,
          goldenProcedureTag: true,
          annotations: {
            where: {
              OR: [
                { blockageTag: { not: null } },
                { procedureTag: { not: null } },
              ],
            },
            select: {
              annotatorId: true,
              blockageTag: true,
              procedureTag: true,
            },
          },
          predictions: {
            select: { runId: true, blockageTag: true, procedureTag: true },
          },
        },
      });
    });

    it("écarte les séries encore vides, qui n'ajouteraient qu'une colonne sans tag", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([]);

      await adminCaller().overview();

      expect(prisma.goldenDatasetRun.findMany).toHaveBeenCalledWith({
        where: { predictions: { some: {} } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          model: true,
          temperature: true,
          _count: { select: { predictions: true } },
        },
      });
    });

    it("rend les séries avec leur nombre de prédictions, dans l'ordre reçu", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(2);
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.goldenDatasetRun.findMany as jest.Mock).mockResolvedValue([
        {
          id: "run-1",
          model: "editeur/modele-a",
          temperature: 0.2,
          _count: { predictions: 2 },
        },
        {
          id: "run-2",
          model: "editeur/modele-a",
          temperature: 1,
          _count: { predictions: 1 },
        },
      ]);

      const result = await adminCaller().overview();

      expect(result.runs).toEqual([
        {
          runId: "run-1",
          model: "editeur/modele-a",
          temperature: 0.2,
          predicted: 2,
        },
        {
          runId: "run-2",
          model: "editeur/modele-a",
          temperature: 1,
          predicted: 1,
        },
      ]);
    });

    it("renvoie les labels retenus de chaque item", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(2);
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([
        {
          position: 1,
          organization: "CAF",
          subject: "Sujet 1",
          description: "Description 1",
          goldenBlockageTag: "dossier bloqué",
          goldenProcedureTag: null,
          annotations: [],
          predictions: [],
        },
        {
          position: 2,
          organization: "CPAM",
          subject: "Sujet 2",
          description: "Description 2",
          goldenBlockageTag: null,
          goldenProcedureTag: "carte vitale",
          annotations: [],
          predictions: [],
        },
      ]);

      const result = await adminCaller().overview();

      expect(
        result.items.map((item) => [
          item.goldenBlockageTag,
          item.goldenProcedureTag,
        ]),
      ).toEqual([
        ["dossier bloqué", null],
        [null, "carte vitale"],
      ]);
    });

    it("rattache chaque prédiction à sa série sur l'item", async () => {
      (prisma.goldenDatasetItem.count as jest.Mock).mockResolvedValue(1);
      (prisma.goldenDatasetItem.findMany as jest.Mock).mockResolvedValue([
        {
          position: 1,
          organization: "CAF",
          subject: "Sujet 1",
          description: "Description 1",
          annotations: [],
          predictions: [
            { runId: "run-1", blockageTag: "delai", procedureTag: null },
            { runId: "run-2", blockageTag: null, procedureTag: "rsa" },
          ],
        },
      ]);

      const result = await adminCaller().overview();

      expect(result.items[0].predictions).toEqual([
        { runId: "run-1", blockageTag: "delai", procedureTag: null },
        { runId: "run-2", blockageTag: null, procedureTag: "rsa" },
      ]);
    });
  });
});
