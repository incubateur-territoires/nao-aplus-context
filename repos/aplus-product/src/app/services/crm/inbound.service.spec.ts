import { ContactMessageDirection } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import type { InboundMessage } from "@/utils/brevo-inbound";
import { persistInboundMessages } from "./inbound.service";

// Jest résout `@/generated/prisma/client` vers le build navigateur, qui n'expose
// pas `PrismaClientKnownRequestError` : on en fournit un équivalent minimal.
jest.mock("@/generated/prisma/client", () => {
  class MockKnownRequestError extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }

  return { Prisma: { PrismaClientKnownRequestError: MockKnownRequestError } };
});

const { Prisma } = jest.requireMock("@/generated/prisma/client") as {
  Prisma: { PrismaClientKnownRequestError: new (code: string) => Error };
};

jest.mock("@/lib/prisma", () => {
  const mock = {
    contact: {
      findFirst: jest.fn(),
    },
    contactMessage: {
      create: jest.fn(),
    },
  };
  return { __esModule: true, default: mock, prisma: mock };
});

const prismaMock = prisma as unknown as {
  contact: { findFirst: jest.Mock };
  contactMessage: { create: jest.Mock };
};

function buildMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    senderEmail: "expediteur@example.com",
    subject: "Demande de pièce",
    textContent: "Bonjour",
    brevoMessageId: "brevo-1",
    ...overrides,
  };
}

describe("persistInboundMessages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("crée un message entrant rattaché au contact trouvé", async () => {
    prismaMock.contact.findFirst.mockResolvedValue({ id: "contact-1" });
    prismaMock.contactMessage.create.mockResolvedValue({ id: "message-1" });

    const result = await persistInboundMessages([buildMessage()]);

    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { email: "expediteur@example.com", deletedAt: null },
      select: { id: true },
    });
    expect(prismaMock.contactMessage.create).toHaveBeenCalledWith({
      data: {
        contactId: "contact-1",
        direction: ContactMessageDirection.INBOUND,
        subject: "Demande de pièce",
        textContent: "Bonjour",
        brevoMessageId: "brevo-1",
      },
    });
    expect(result).toEqual({ created: 1, skipped: 0 });
  });

  it("ignore un expéditeur sans contact actif", async () => {
    prismaMock.contact.findFirst.mockResolvedValue(null);

    const result = await persistInboundMessages([buildMessage()]);

    expect(prismaMock.contactMessage.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: 1 });
  });

  it("ignore un rejeu du même message Brevo", async () => {
    prismaMock.contact.findFirst.mockResolvedValue({ id: "contact-1" });
    prismaMock.contactMessage.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("P2002"),
    );

    const result = await persistInboundMessages([buildMessage()]);

    expect(result).toEqual({ created: 0, skipped: 1 });
  });

  it("propage une erreur de base inattendue", async () => {
    prismaMock.contact.findFirst.mockResolvedValue({ id: "contact-1" });
    prismaMock.contactMessage.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("P1001"),
    );

    await expect(persistInboundMessages([buildMessage()])).rejects.toThrow(
      "P1001",
    );
  });

  it("traite chaque message d'un lot indépendamment", async () => {
    prismaMock.contact.findFirst
      .mockResolvedValueOnce({ id: "contact-1" })
      .mockResolvedValueOnce(null);
    prismaMock.contactMessage.create.mockResolvedValue({ id: "message-1" });

    const result = await persistInboundMessages([
      buildMessage(),
      buildMessage({
        senderEmail: "inconnu@example.com",
        brevoMessageId: "brevo-2",
      }),
    ]);

    expect(result).toEqual({ created: 1, skipped: 1 });
  });
});
