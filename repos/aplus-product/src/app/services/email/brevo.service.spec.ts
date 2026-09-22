import { sendBrevoEmail, fetchBrevoTemplate } from "./brevo.service";
import * as Brevo from "@getbrevo/brevo";

// Mock the Brevo library
jest.mock("@getbrevo/brevo", () => {
  const mockSendTransacEmail = jest.fn();
  const mockGetSmtpTemplate = jest.fn();
  const mockSetApiKey = jest.fn();

  return {
    TransactionalEmailsApi: jest.fn().mockImplementation(() => ({
      setApiKey: mockSetApiKey,
      sendTransacEmail: mockSendTransacEmail,
      getSmtpTemplate: mockGetSmtpTemplate,
    })),
    TransactionalEmailsApiApiKeys: {
      apiKey: 0,
    },
    SendSmtpEmail: jest.fn().mockImplementation(() => ({})),
  };
});

function axiosError(status: number, data?: unknown): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    status,
    response: data === undefined ? { status } : { status, data },
  });
}

describe("brevo.service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("sendBrevoEmail", () => {
    it("returns error when BREVO_API_KEY is not defined", async () => {
      delete process.env.BREVO_API_KEY;

      const result = await sendBrevoEmail({
        to: [{ email: "test@example.com" }],
        subject: "Test",
      });

      expect(result).toEqual({
        success: false,
        error: "BREVO_API_KEY is not defined",
      });
    });

    it("sends email successfully with template", async () => {
      process.env.BREVO_API_KEY = "test-api-key";
      process.env.BREVO_SENDER_EMAIL = "sender@test.com";
      process.env.BREVO_SENDER_NAME = "Test Sender";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.sendTransacEmail as jest.Mock).mockResolvedValue({
        body: { messageId: "msg-123" },
      });

      const result = await sendBrevoEmail({
        to: [{ email: "recipient@test.com", name: "Recipient" }],
        subject: "Test Subject",
        templateId: 1,
        params: { key: "value" },
      });

      expect(result).toEqual({
        success: true,
        messageId: "msg-123",
      });
    });

    it("sends email successfully with html content", async () => {
      process.env.BREVO_API_KEY = "test-api-key";
      process.env.BREVO_SENDER_EMAIL = "sender@test.com";
      process.env.BREVO_SENDER_NAME = "Test Sender";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.sendTransacEmail as jest.Mock).mockResolvedValue({
        body: { messageId: "msg-456" },
      });

      const result = await sendBrevoEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test Subject",
        htmlContent: "<p>Hello</p>",
        textContent: "Hello",
      });

      expect(result).toEqual({
        success: true,
        messageId: "msg-456",
      });
    });

    it("uses custom sender when provided", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.sendTransacEmail as jest.Mock).mockResolvedValue({
        body: { messageId: "msg-789" },
      });

      const result = await sendBrevoEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
        sender: { email: "custom@test.com", name: "Custom Sender" },
      });

      expect(result.success).toBe(true);
    });

    it("handles cc, bcc, and replyTo options", async () => {
      process.env.BREVO_API_KEY = "test-api-key";
      process.env.BREVO_SENDER_EMAIL = "sender@test.com";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.sendTransacEmail as jest.Mock).mockResolvedValue({
        body: { messageId: "msg-abc" },
      });

      const result = await sendBrevoEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
        cc: [{ email: "cc@test.com" }],
        bcc: [{ email: "bcc@test.com" }],
        replyTo: { email: "reply@test.com" },
      });

      expect(result.success).toBe(true);
    });

    it("returns error on API failure", async () => {
      process.env.BREVO_API_KEY = "test-api-key";
      process.env.BREVO_SENDER_EMAIL = "sender@test.com";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.sendTransacEmail as jest.Mock).mockRejectedValue(
        new Error("API failure"),
      );

      const result = await sendBrevoEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
      });

      expect(result).toEqual({
        success: false,
        error: "API failure",
      });
    });

    it("handles non-Error exceptions", async () => {
      process.env.BREVO_API_KEY = "test-api-key";
      process.env.BREVO_SENDER_EMAIL = "sender@test.com";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.sendTransacEmail as jest.Mock).mockRejectedValue(
        "Unknown error",
      );

      const result = await sendBrevoEmail({
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
      });

      expect(result).toEqual({
        success: false,
        error: "Unknown error",
      });
    });
  });

  describe("fetchBrevoTemplate", () => {
    it("reports a missing API key rather than an absent template", async () => {
      delete process.env.BREVO_API_KEY;

      const result = await fetchBrevoTemplate(1);

      expect(result).toEqual({
        ok: false,
        reason: "no-api-key",
        error: "BREVO_API_KEY is not defined",
      });
    });

    it("fetches template successfully", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.getSmtpTemplate as jest.Mock).mockResolvedValue({
        body: {
          id: 1,
          name: "Welcome Template",
          subject: "Welcome",
          htmlContent: "<p>Welcome!</p>",
          isActive: true,
        },
      });

      const result = await fetchBrevoTemplate(1);

      expect(result).toEqual({
        ok: true,
        template: {
          id: 1,
          name: "Welcome Template",
          subject: "Welcome",
          htmlContent: "<p>Welcome!</p>",
          isActive: true,
        },
      });
    });

    it("returns template with default values for missing fields", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.getSmtpTemplate as jest.Mock).mockResolvedValue({
        body: {},
      });

      const result = await fetchBrevoTemplate(42);

      expect(result).toEqual({
        ok: true,
        template: {
          id: 42,
          name: "",
          subject: "",
          htmlContent: "",
          isActive: false,
        },
      });
    });

    it("distinguishes a deleted template from a broken API", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      const notFound = Object.assign(new Error("Template not found"), {
        statusCode: 404,
      });
      (mockApi.getSmtpTemplate as jest.Mock).mockRejectedValue(notFound);

      expect(await fetchBrevoTemplate(999)).toEqual({
        ok: false,
        reason: "not-found",
        error: "Template not found",
      });

      (mockApi.getSmtpTemplate as jest.Mock).mockRejectedValue(
        new Error("Gateway timeout"),
      );

      expect(await fetchBrevoTemplate(999)).toEqual({
        ok: false,
        reason: "api-error",
        error: "Gateway timeout",
      });
    });

    it("reads the status of an axios rejection, which carries no statusCode", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.getSmtpTemplate as jest.Mock).mockRejectedValue(
        axiosError(404, { code: "document_not_found" }),
      );

      const result = await fetchBrevoTemplate(999);

      expect(result).toMatchObject({ ok: false, reason: "not-found" });
    });

    it("names a rejected credential rather than a generic API failure", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.getSmtpTemplate as jest.Mock).mockRejectedValue(
        axiosError(401, {
          code: "unauthorized",
          message: "IP address not authorized",
        }),
      );

      expect(await fetchBrevoTemplate(1)).toEqual({
        ok: false,
        reason: "credentials-rejected",
        error: "unauthorized: IP address not authorized",
      });
    });

    it("treats a forbidden response as a rejected credential too", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.getSmtpTemplate as jest.Mock).mockRejectedValue(
        axiosError(403, { message: "Account is on hold" }),
      );

      expect(await fetchBrevoTemplate(1)).toEqual({
        ok: false,
        reason: "credentials-rejected",
        error: "Account is on hold",
      });
    });

    it("parses a response body served as a JSON string", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.getSmtpTemplate as jest.Mock).mockRejectedValue(
        axiosError(
          401,
          JSON.stringify({ code: "unauthorized", message: "Key revoked" }),
        ),
      );

      expect(await fetchBrevoTemplate(1)).toEqual({
        ok: false,
        reason: "credentials-rejected",
        error: "unauthorized: Key revoked",
      });
    });

    it("falls back on the error message when the body is unreadable", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.getSmtpTemplate as jest.Mock).mockRejectedValue(
        axiosError(401, "<html>Gateway</html>"),
      );

      expect(await fetchBrevoTemplate(1)).toEqual({
        ok: false,
        reason: "credentials-rejected",
        error: "Request failed with status code 401",
      });
    });

    it("falls back on the error message when there is no body at all", async () => {
      process.env.BREVO_API_KEY = "test-api-key";

      const mockApi = new Brevo.TransactionalEmailsApi();
      (mockApi.getSmtpTemplate as jest.Mock).mockRejectedValue(axiosError(401));

      expect(await fetchBrevoTemplate(1)).toEqual({
        ok: false,
        reason: "credentials-rejected",
        error: "Request failed with status code 401",
      });
    });
  });
});
