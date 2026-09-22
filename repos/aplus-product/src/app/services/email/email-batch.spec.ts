const mockSendTemplatedEmail = jest.fn();
jest.mock("./email.service", () => ({
  sendTemplatedEmail: (...args: unknown[]) => mockSendTemplatedEmail(...args),
}));

const mockCaptureMessage = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

const mockLoggerError = jest.fn();
jest.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: jest.fn(), error: mockLoggerError }),
}));

import {
  EMPTY_EMAIL_BATCH,
  mergeEmailBatchOutcomes,
  sendTemplatedEmailBatch,
  verdictOf,
} from "./email-batch";

function overdueJob(ref: string) {
  return {
    ref,
    to: [{ email: `${ref}@exemple.test` }],
    params: {
      userFirstName: "Camille",
      reportSubject: "Dossier RSA",
      reportUrl: `https://exemple.test/signalement/${ref}`,
    },
  };
}

function sendBatch(refs: string[], concurrency?: number) {
  return sendTemplatedEmailBatch({
    template: "REPORT_OVERDUE",
    scope: "Overdue CRON",
    jobs: refs.map(overdueJob),
    concurrency,
  });
}

describe("sendTemplatedEmailBatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendTemplatedEmail.mockResolvedValue({ success: true });
  });

  it("counts a resolved failure as a failure", async () => {
    mockSendTemplatedEmail
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: false,
        error: "Template is not active",
      });

    const outcome = await sendBatch(["r-1", "r-2"]);

    expect(outcome.sent).toEqual(["r-1"]);
    expect(outcome.failures).toEqual([
      { ref: "r-2", error: "Template is not active" },
    ]);
  });

  it("counts a rejected promise as a failure", async () => {
    mockSendTemplatedEmail.mockRejectedValueOnce(new Error("Socket hang up"));

    const outcome = await sendBatch(["r-1"]);

    expect(outcome.failures).toEqual([{ ref: "r-1", error: "Socket hang up" }]);
  });

  it("keeps sent and failures exhaustive over the jobs", async () => {
    mockSendTemplatedEmail
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: "boom" })
      .mockRejectedValueOnce(new Error("boom"));

    const outcome = await sendBatch(["r-1", "r-2", "r-3"]);

    expect(outcome.sent.length + outcome.failures.length).toBe(3);
  });

  it("redacts an address quoted by the transport error", async () => {
    mockSendTemplatedEmail.mockResolvedValueOnce({
      success: false,
      error: "Invalid recipient: agent@exemple.test",
    });

    const outcome = await sendBatch(["r-1"]);

    expect(outcome.failures[0].error).toBe("Invalid recipient: [adresse]");
  });

  it("sends the template key and the job params to the email service", async () => {
    await sendBatch(["r-1"]);

    expect(mockSendTemplatedEmail).toHaveBeenCalledWith("REPORT_OVERDUE", {
      to: [{ email: "r-1@exemple.test" }],
      params: {
        userFirstName: "Camille",
        reportSubject: "Dossier RSA",
        reportUrl: "https://exemple.test/signalement/r-1",
      },
      replyTo: undefined,
    });
  });

  it("respects the concurrency slice size", async () => {
    const inFlight: number[] = [];
    let current = 0;
    mockSendTemplatedEmail.mockImplementation(async () => {
      current += 1;
      inFlight.push(current);
      await Promise.resolve();
      current -= 1;
      return { success: true };
    });

    await sendBatch(["r-1", "r-2", "r-3", "r-4", "r-5"], 2);

    expect(Math.max(...inFlight)).toBe(2);
  });

  describe("escalation", () => {
    it("raises an error-level alert when every send fails", async () => {
      mockSendTemplatedEmail.mockResolvedValue({
        success: false,
        error: "Template is not active",
      });

      await sendBatch(["r-1", "r-2"]);

      expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        "Échecs d'envoi d'e-mail : REPORT_OVERDUE",
        expect.objectContaining({
          level: "error",
          fingerprint: ["email-batch", "REPORT_OVERDUE"],
        }),
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Échecs d'envoi d'e-mail",
        expect.objectContaining({ sent: 0, failed: 2, refs: ["r-1", "r-2"] }),
      );
    });

    it("raises a warning when only part of the batch fails", async () => {
      mockSendTemplatedEmail
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: "boom" });

      await sendBatch(["r-1", "r-2"]);

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ level: "warning" }),
      );
    });

    it("stays silent when every send succeeds", async () => {
      await sendBatch(["r-1", "r-2"]);

      expect(mockCaptureMessage).not.toHaveBeenCalled();
      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it("stays silent and sends nothing when there is no job", async () => {
      const outcome = await sendBatch([]);

      expect(outcome).toEqual(EMPTY_EMAIL_BATCH);
      expect(mockSendTemplatedEmail).not.toHaveBeenCalled();
      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });

    it("never carries a recipient address to Sentry", async () => {
      mockSendTemplatedEmail.mockResolvedValue({
        success: false,
        error: "Invalid recipient: agent@exemple.test",
      });

      await sendBatch(["r-1"]);

      const payload = JSON.stringify(mockCaptureMessage.mock.calls[0]);
      expect(payload).not.toContain("@exemple.test");
    });
  });
});

describe("verdictOf", () => {
  it("names the four cases", () => {
    expect(verdictOf(EMPTY_EMAIL_BATCH)).toBe("nothing-to-send");
    expect(verdictOf({ sent: ["a"], failures: [] })).toBe("all-sent");
    expect(
      verdictOf({ sent: ["a"], failures: [{ ref: "b", error: "x" }] }),
    ).toBe("partial-failure");
    expect(verdictOf({ sent: [], failures: [{ ref: "b", error: "x" }] })).toBe(
      "total-failure",
    );
  });
});

describe("mergeEmailBatchOutcomes", () => {
  it("returns the empty outcome for an empty list", () => {
    expect(mergeEmailBatchOutcomes([])).toEqual(EMPTY_EMAIL_BATCH);
  });

  it("concatenates sent refs and failures", () => {
    expect(
      mergeEmailBatchOutcomes([
        { sent: ["a"], failures: [] },
        { sent: ["b"], failures: [{ ref: "c", error: "x" }] },
      ]),
    ).toEqual({
      sent: ["a", "b"],
      failures: [{ ref: "c", error: "x" }],
    });
  });
});
