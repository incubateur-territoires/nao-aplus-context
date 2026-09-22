import { createCallerFactory } from "../init";
import { contactRouter } from "./contact";
import { sendEmail } from "@/app/services/email/email.service";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("@/app/services/email/email.service", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

const createCaller = createCallerFactory(contactRouter);

const validInput = {
  email: "jean@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  subject: "Demande d'aide",
  message: "Bonjour, j'ai besoin d'aide.",
};

describe("contactRouter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      CONTACT_RECIPIENT_EMAIL: "support@example.com",
    };
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("send", () => {
    it("sends an email to the support recipient with replyTo set to the contact", async () => {
      (sendEmail as jest.Mock).mockResolvedValue({ success: true });

      const caller = createCaller({ userId: null, user: null });
      const result = await caller.send(validInput);

      expect(result).toEqual({ success: true });
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [{ email: "support@example.com" }],
          replyTo: { email: "jean@example.com", name: "Jean Dupont" },
          subject: "[Contact A+] Demande d'aide — Jean Dupont",
        }),
      );
    });

    it("includes the subject in the email body", async () => {
      (sendEmail as jest.Mock).mockResolvedValue({ success: true });

      const caller = createCaller({ userId: null, user: null });
      await caller.send(validInput);

      const call = (sendEmail as jest.Mock).mock.calls[0][0];
      expect(call.htmlContent).toContain("<strong>Sujet :</strong>");
      expect(call.textContent).toContain("Sujet : Demande d'aide");
    });

    it("rejects a missing subject", async () => {
      const caller = createCaller({ userId: null, user: null });

      await expect(
        caller.send({ ...validInput, subject: "" }),
      ).rejects.toBeDefined();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("includes the optional team when provided", async () => {
      (sendEmail as jest.Mock).mockResolvedValue({ success: true });

      const caller = createCaller({ userId: null, user: null });
      await caller.send({ ...validInput, team: "France services Lyon" });

      const call = (sendEmail as jest.Mock).mock.calls[0][0];
      expect(call.htmlContent).toContain("France services Lyon");
      expect(call.textContent).toContain("France services Lyon");
    });

    it("throws INTERNAL_SERVER_ERROR when no recipient is configured", async () => {
      delete process.env.CONTACT_RECIPIENT_EMAIL;
      delete process.env.BREVO_SENDER_EMAIL;

      const caller = createCaller({ userId: null, user: null });

      await expect(caller.send(validInput)).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("throws INTERNAL_SERVER_ERROR when the email fails to send", async () => {
      (sendEmail as jest.Mock).mockResolvedValue({
        success: false,
        error: "Brevo error",
      });

      const caller = createCaller({ userId: null, user: null });

      await expect(caller.send(validInput)).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
      });
    });

    it("rejects an invalid email", async () => {
      const caller = createCaller({ userId: null, user: null });

      await expect(
        caller.send({ ...validInput, email: "not-an-email" }),
      ).rejects.toBeDefined();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("checks a dedicated rate limit keyed by IP address", async () => {
      (sendEmail as jest.Mock).mockResolvedValue({ success: true });

      const caller = createCaller({
        userId: null,
        user: null,
        requestContext: {
          ipAddress: "1.2.3.4",
          userAgent: null,
          referrer: null,
          pagePath: null,
        },
      });
      await caller.send(validInput);

      expect(checkRateLimit).toHaveBeenCalledWith(
        "contact:send",
        "1.2.3.4",
        expect.objectContaining({ max: 5 }),
      );
    });

    it("throws TOO_MANY_REQUESTS when the rate limit is exceeded", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 120,
      });

      const caller = createCaller({
        userId: null,
        user: null,
        requestContext: {
          ipAddress: "1.2.3.4",
          userAgent: null,
          referrer: null,
          pagePath: null,
        },
      });

      await expect(caller.send(validInput)).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    describe("attachments", () => {
      it("forwards the attachments to the email", async () => {
        (sendEmail as jest.Mock).mockResolvedValue({ success: true });

        const caller = createCaller({ userId: null, user: null });
        await caller.send({
          ...validInput,
          attachments: [
            { name: "facture.pdf", content: "ZmFrZS1jb250ZW50" },
            { name: "justificatif.png", content: "ZmFrZS1pbWFnZQ==" },
          ],
        });

        const call = (sendEmail as jest.Mock).mock.calls[0][0];
        expect(call.attachment).toEqual([
          { name: "facture.pdf", content: "ZmFrZS1jb250ZW50" },
          { name: "justificatif.png", content: "ZmFrZS1pbWFnZQ==" },
        ]);
      });

      it("mentions the attachments in the email body", async () => {
        (sendEmail as jest.Mock).mockResolvedValue({ success: true });

        const caller = createCaller({ userId: null, user: null });
        await caller.send({
          ...validInput,
          attachments: [
            { name: "facture.pdf", content: "ZmFrZS1jb250ZW50" },
            { name: "justificatif.png", content: "ZmFrZS1pbWFnZQ==" },
          ],
        });

        const call = (sendEmail as jest.Mock).mock.calls[0][0];
        expect(call.htmlContent).toContain(
          "2 pièces jointes : facture.pdf, justificatif.png",
        );
        expect(call.textContent).toContain(
          "2 pièces jointes : facture.pdf, justificatif.png",
        );
      });

      it("uses the singular wording for a single attachment", async () => {
        (sendEmail as jest.Mock).mockResolvedValue({ success: true });

        const caller = createCaller({ userId: null, user: null });
        await caller.send({
          ...validInput,
          attachments: [{ name: "facture.pdf", content: "ZmFrZS1jb250ZW50" }],
        });

        const call = (sendEmail as jest.Mock).mock.calls[0][0];
        expect(call.textContent).toContain("1 pièce jointe : facture.pdf");
      });

      it("does not mention attachments when there are none", async () => {
        (sendEmail as jest.Mock).mockResolvedValue({ success: true });

        const caller = createCaller({ userId: null, user: null });
        await caller.send(validInput);

        const call = (sendEmail as jest.Mock).mock.calls[0][0];
        expect(call.attachment).toBeUndefined();
        expect(call.textContent).not.toContain("pièce jointe");
      });

      it("rejects an attachment with an unsupported extension", async () => {
        const caller = createCaller({ userId: null, user: null });

        await expect(
          caller.send({
            ...validInput,
            attachments: [{ name: "malware.exe", content: "ZmFrZQ==" }],
          }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(sendEmail).not.toHaveBeenCalled();
      });

      it("rejects attachments whose total size exceeds 5 MB", async () => {
        const caller = createCaller({ userId: null, user: null });

        await expect(
          caller.send({
            ...validInput,
            attachments: [{ name: "gros.pdf", content: "A".repeat(7_000_000) }],
          }),
        ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
        expect(sendEmail).not.toHaveBeenCalled();
      });
    });
  });
});
