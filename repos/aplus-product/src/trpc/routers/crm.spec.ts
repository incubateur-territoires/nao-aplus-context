import { createCallerFactory } from "../init";
import { crmRouter } from "./crm";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/app/services/email/email.service";
import { checkRateLimit } from "@/lib/rate-limit";
import { createMockUser, USER_ROLES } from "@/test/mocks";

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    contact: { findFirst: jest.fn() },
    contactMessage: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@/app/services/email/email.service", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

const createCaller = createCallerFactory(crmRouter);

const input = { contactId: "contact-1", subject: "Objet", content: "Bonjour" };

function createAdminCaller() {
  return createCaller({
    userId: "admin-1",
    user: createMockUser({ id: "admin-1", role: USER_ROLES.ADMIN }),
  });
}

describe("crmRouter.sendEmail", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 29,
      retryAfterSeconds: 0,
    });
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue({
      id: "contact-1",
      email: "contact@example.com",
      firstName: "Jean",
      lastName: "Dupont",
    });
    (prisma.contactMessage.create as jest.Mock).mockResolvedValue({
      id: "message-1",
    });
  });

  it("records the message, sends it, then stores the Brevo id", async () => {
    (sendEmail as jest.Mock).mockResolvedValue({
      success: true,
      messageId: "<brevo-1>",
    });

    await expect(createAdminCaller().sendEmail(input)).resolves.toEqual({
      success: true,
    });

    expect(prisma.contactMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "contact-1",
        direction: "OUTBOUND",
        subject: "Objet",
        sentById: "admin-1",
      }),
    });
    expect(prisma.contactMessage.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: { brevoMessageId: "<brevo-1>" },
    });
  });

  it("does not send the email when the message cannot be recorded", async () => {
    (prisma.contactMessage.create as jest.Mock).mockRejectedValue(
      new Error("database down"),
    );

    await expect(createAdminCaller().sendEmail(input)).rejects.toThrow();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("removes the recorded message when Brevo refuses the email", async () => {
    (sendEmail as jest.Mock).mockResolvedValue({ success: false });

    await expect(createAdminCaller().sendEmail(input)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(prisma.contactMessage.delete).toHaveBeenCalledWith({
      where: { id: "message-1" },
    });
  });

  it("reports success when the email left but its Brevo id could not be stored", async () => {
    (sendEmail as jest.Mock).mockResolvedValue({
      success: true,
      messageId: "<brevo-1>",
    });
    (prisma.contactMessage.update as jest.Mock).mockRejectedValue(
      new Error("database down"),
    );

    await expect(createAdminCaller().sendEmail(input)).resolves.toEqual({
      success: true,
    });
  });
});
