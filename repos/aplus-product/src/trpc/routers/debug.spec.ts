import { createCallerFactory } from "../init";
import { debugRouter } from "./debug";
import { createMockUser } from "@/test/mocks";
import {
  getDebugEmails,
  clearDebugEmails,
  addMockDebugEmail,
} from "@/app/services/email/email.service";

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
  getDebugEmails: jest.fn(),
  clearDebugEmails: jest.fn(),
  addMockDebugEmail: jest.fn(),
}));

const createCaller = createCallerFactory(debugRouter);

const mockEmails = [
  {
    id: "email-1",
    subject: "Test Email",
    sender: { email: "test@example.com", name: "Test" },
    recipients: [{ email: "recipient@example.com" }],
    htmlContent: "<p>Test</p>",
    status: "sent" as const,
    timestamp: new Date(),
  },
];

describe("debugRouter", () => {
  const originalAppEnv = process.env.APP_ENVIRONMENT;

  function setAppEnv(value: string | undefined) {
    if (value === undefined) {
      delete process.env.APP_ENVIRONMENT;
    } else {
      process.env.APP_ENVIRONMENT = value;
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setAppEnv(undefined);
  });

  afterEach(() => {
    setAppEnv(originalAppEnv);
  });

  describe("getEmails", () => {
    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.getEmails()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("returns emails in development mode", async () => {
      setAppEnv("local");
      (getDebugEmails as jest.Mock).mockReturnValue(mockEmails);

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      const result = await caller.getEmails();

      expect(result).toEqual(mockEmails);
      expect(getDebugEmails).toHaveBeenCalled();
    });

    it("returns empty array in production mode", async () => {
      setAppEnv("production");

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      const result = await caller.getEmails();

      expect(result).toEqual([]);
      expect(getDebugEmails).not.toHaveBeenCalled();
    });

    it("returns emails when APP_ENVIRONMENT is staging", async () => {
      setAppEnv("staging");
      (getDebugEmails as jest.Mock).mockReturnValue(mockEmails);

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      const result = await caller.getEmails();

      expect(result).toEqual(mockEmails);
      expect(getDebugEmails).toHaveBeenCalled();
    });
  });

  describe("clearEmails", () => {
    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.clearEmails()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("clears emails in development mode", async () => {
      setAppEnv("local");

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      const result = await caller.clearEmails();

      expect(result).toEqual({ success: true });
      expect(clearDebugEmails).toHaveBeenCalled();
    });

    it("returns failure in production mode", async () => {
      setAppEnv("production");

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      const result = await caller.clearEmails();

      expect(result).toEqual({ success: false });
      expect(clearDebugEmails).not.toHaveBeenCalled();
    });
  });

  describe("addMockEmail", () => {
    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(
        caller.addMockEmail({
          subject: "Test",
          recipientEmail: "test@example.com",
        }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("adds mock email in development mode", async () => {
      setAppEnv("local");

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      const result = await caller.addMockEmail({
        subject: "Test Subject",
        recipientEmail: "recipient@example.com",
        recipientName: "John Doe",
        templateName: "test-template",
        variables: { key: "value" },
      });

      expect(result).toEqual({ success: true });
      expect(addMockDebugEmail).toHaveBeenCalledWith({
        subject: "Test Subject",
        recipients: [{ email: "recipient@example.com", name: "John Doe" }],
        htmlContent: expect.any(String),
        templateName: "test-template",
        variables: { key: "value" },
      });
    });

    it("uses default HTML content when not provided", async () => {
      setAppEnv("local");

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      await caller.addMockEmail({
        subject: "My Subject",
        recipientEmail: "test@example.com",
      });

      expect(addMockDebugEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          htmlContent: "<p>Email: My Subject</p>",
        }),
      );
    });

    it("uses custom HTML content when provided", async () => {
      setAppEnv("local");

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      await caller.addMockEmail({
        subject: "Test",
        recipientEmail: "test@example.com",
        htmlContent: "<div>Custom HTML</div>",
      });

      expect(addMockDebugEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          htmlContent: "<div>Custom HTML</div>",
        }),
      );
    });

    it("returns failure in production mode", async () => {
      setAppEnv("production");

      const caller = createCaller({
        userId: "user-1",
        user: createMockUser(),
      });

      const result = await caller.addMockEmail({
        subject: "Test",
        recipientEmail: "test@example.com",
      });

      expect(result).toEqual({ success: false });
      expect(addMockDebugEmail).not.toHaveBeenCalled();
    });
  });
});
