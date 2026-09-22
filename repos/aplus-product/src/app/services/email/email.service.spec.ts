import {
  sendEmail,
  sendTemplatedEmail,
  getDebugEmails,
  clearDebugEmails,
  addMockDebugEmail,
} from "./email.service";
import { EMAIL_TEMPLATES } from "./email.template";

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: jest.fn(() => "mock-uuid-123"),
  },
});

// Mock brevo.service
jest.mock("./brevo.service", () => ({
  sendBrevoEmail: jest.fn(),
  fetchBrevoTemplate: jest.fn(),
}));

import { sendBrevoEmail, fetchBrevoTemplate } from "./brevo.service";

const mockSendBrevoEmail = sendBrevoEmail as jest.MockedFunction<
  typeof sendBrevoEmail
>;
const mockFetchBrevoTemplate = fetchBrevoTemplate as jest.MockedFunction<
  typeof fetchBrevoTemplate
>;

describe("email.service", () => {
  const originalAppEnv = process.env.APP_ENVIRONMENT;

  beforeEach(() => {
    jest.clearAllMocks();
    clearDebugEmails();
  });

  afterEach(() => {
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENVIRONMENT;
    } else {
      process.env.APP_ENVIRONMENT = originalAppEnv;
    }
  });

  describe("sendEmail", () => {
    beforeEach(() => {
      process.env.BREVO_SENDER_EMAIL = "sender@test.com";
      process.env.BREVO_SENDER_NAME = "Test Sender";
    });

    it("sends email through Brevo and returns success", async () => {
      mockSendBrevoEmail.mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      const result = await sendEmail({
        to: [{ email: "recipient@test.com", name: "Recipient" }],
        subject: "Test Subject",
        htmlContent: "<p>Test content</p>",
      });

      expect(result).toEqual({
        success: true,
        messageId: "msg-123",
      });
      expect(mockSendBrevoEmail).toHaveBeenCalledWith({
        to: [{ email: "recipient@test.com", name: "Recipient" }],
        subject: "Test Subject",
        templateId: undefined,
        params: undefined,
        htmlContent: "<p>Test content</p>",
        textContent: undefined,
        sender: { email: "sender@test.com", name: "Test Sender" },
        cc: undefined,
        bcc: undefined,
      });
    });

    it("uses custom sender when provided", async () => {
      mockSendBrevoEmail.mockResolvedValue({ success: true });

      await sendEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
        sender: { email: "custom@test.com", name: "Custom Sender" },
      });

      expect(mockSendBrevoEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: { email: "custom@test.com", name: "Custom Sender" },
        }),
      );
    });

    it("returns error when Brevo fails", async () => {
      mockSendBrevoEmail.mockResolvedValue({
        success: false,
        error: "API error",
      });

      const result = await sendEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
      });

      expect(result).toEqual({
        success: false,
        error: "API error",
      });
    });

    it("handles exceptions and returns error", async () => {
      mockSendBrevoEmail.mockRejectedValue(new Error("Network error"));

      const result = await sendEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
      });

      expect(result).toEqual({
        success: false,
        error: "Network error",
      });
    });

    it("handles non-Error exceptions", async () => {
      mockSendBrevoEmail.mockRejectedValue("Unknown failure");

      const result = await sendEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
      });

      expect(result).toEqual({
        success: false,
        error: "Unknown error",
      });
    });

    describe("in development mode", () => {
      beforeEach(() => {
        process.env.APP_ENVIRONMENT = "local";
      });

      it("stores debug emails on success", async () => {
        mockSendBrevoEmail.mockResolvedValue({
          success: true,
          messageId: "msg-456",
        });

        await sendEmail({
          to: [{ email: "recipient@test.com" }],
          subject: "Debug Test",
        });

        const debugEmails = getDebugEmails();
        expect(debugEmails).toHaveLength(1);
        expect(debugEmails[0]).toMatchObject({
          subject: "Debug Test",
          status: "sent",
          messageId: "msg-456",
        });
      });

      it("stores debug emails on failure", async () => {
        mockSendBrevoEmail.mockResolvedValue({
          success: false,
          error: "Failed",
        });

        await sendEmail({
          to: [{ email: "recipient@test.com" }],
          subject: "Failed Email",
        });

        const debugEmails = getDebugEmails();
        expect(debugEmails).toHaveLength(1);
        expect(debugEmails[0]).toMatchObject({
          subject: "Failed Email",
          status: "failed",
          error: "Failed",
        });
      });

      it("fetches template content when a template is sent", async () => {
        mockFetchBrevoTemplate.mockResolvedValue({
          ok: true,
          template: {
            id: EMAIL_TEMPLATES.INVITE_SUPERVISOR.id,
            name: "Invite Template",
            subject: "Invitation",
            htmlContent: "<p>Rejoignez : {{ params.linkUrl }}</p>",
            isActive: true,
          },
        });
        mockSendBrevoEmail.mockResolvedValue({ success: true });

        await sendTemplatedEmail("INVITE_SUPERVISOR", {
          to: [{ email: "recipient@test.com" }],
          params: { linkUrl: "https://exemple.test/lien" },
        });

        const debugEmails = getDebugEmails();
        expect(debugEmails[0].templateName).toBe("Invite Template");
        expect(debugEmails[0].htmlContent).toBe(
          "<p>Rejoignez : https://exemple.test/lien</p>",
        );
      });
    });
  });

  describe("sendTemplatedEmail", () => {
    beforeEach(() => {
      process.env.BREVO_SENDER_EMAIL = "sender@test.com";
      process.env.BREVO_SENDER_NAME = "Test Sender";
    });

    it("sends the declared template id and renders its subject from the params", async () => {
      mockSendBrevoEmail.mockResolvedValue({ success: true });

      await sendTemplatedEmail("REPORT_OVERDUE", {
        to: [{ email: "recipient@test.com" }],
        params: {
          userFirstName: "Camille",
          reportSubject: "Dossier RSA",
          reportUrl: "https://exemple.test/signalement/abc",
        },
      });

      expect(mockSendBrevoEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: EMAIL_TEMPLATES.REPORT_OVERDUE.id,
          subject: "[A+] Signalement en souffrance : Dossier RSA",
          params: {
            userFirstName: "Camille",
            reportSubject: "Dossier RSA",
            reportUrl: "https://exemple.test/signalement/abc",
          },
        }),
      );
    });

    it("substitutes in a single pass so a param value cannot inject a placeholder", async () => {
      mockSendBrevoEmail.mockResolvedValue({ success: true });

      await sendTemplatedEmail("REPORT_OVERDUE", {
        to: [{ email: "recipient@test.com" }],
        params: {
          userFirstName: "Camille",
          reportSubject: "{{ params.reportUrl }}",
          reportUrl: "https://exemple.test/signalement/abc",
        },
      });

      expect(mockSendBrevoEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "[A+] Signalement en souffrance : {{ params.reportUrl }}",
        }),
      );
    });

    it("returns the transport failure without throwing", async () => {
      mockSendBrevoEmail.mockResolvedValue({
        success: false,
        error: "Template is not active",
      });

      const result = await sendTemplatedEmail("ACCOUNT_DELETED", {
        to: [{ email: "recipient@test.com" }],
        params: {},
      });

      expect(result).toEqual({
        success: false,
        messageId: undefined,
        error: "Template is not active",
      });
    });
  });

  describe("getDebugEmails", () => {
    it("returns empty array in non-development mode", () => {
      process.env.APP_ENVIRONMENT = "production";
      expect(getDebugEmails()).toEqual([]);
    });

    it("returns debug emails in development mode", () => {
      process.env.APP_ENVIRONMENT = "local";
      addMockDebugEmail({ subject: "Test 1" });
      addMockDebugEmail({ subject: "Test 2" });

      const emails = getDebugEmails();
      expect(emails).toHaveLength(2);
      expect(emails[0].subject).toBe("Test 2"); // Newest first
      expect(emails[1].subject).toBe("Test 1");
    });
  });

  describe("clearDebugEmails", () => {
    it("clears all debug emails", () => {
      process.env.APP_ENVIRONMENT = "local";
      addMockDebugEmail({ subject: "Test" });
      expect(getDebugEmails()).toHaveLength(1);

      clearDebugEmails();
      expect(getDebugEmails()).toEqual([]);
    });
  });

  describe("addMockDebugEmail", () => {
    it("does nothing in non-development mode", () => {
      process.env.APP_ENVIRONMENT = "production";
      addMockDebugEmail({ subject: "Test" });

      process.env.APP_ENVIRONMENT = "local";
      expect(getDebugEmails()).toEqual([]);
    });

    it("adds email with default values", () => {
      process.env.APP_ENVIRONMENT = "local";
      addMockDebugEmail({});

      const emails = getDebugEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0]).toMatchObject({
        subject: "Test Email",
        sender: { email: "test@example.com", name: "Test Sender" },
        recipients: [{ email: "recipient@example.com" }],
        htmlContent: "<p>Test email content</p>",
        status: "sent",
      });
    });

    it("respects max debug emails limit", () => {
      process.env.APP_ENVIRONMENT = "local";

      // Add 105 emails (limit is 100)
      for (let i = 0; i < 105; i++) {
        addMockDebugEmail({ subject: `Email ${i}` });
      }

      const emails = getDebugEmails();
      expect(emails).toHaveLength(100);
      // Most recent should be first
      expect(emails[0].subject).toBe("Email 104");
    });
  });
});
