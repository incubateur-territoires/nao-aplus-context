import {
  API_FAILURE_THRESHOLD,
  MAX_ERASURES_PER_RUN,
  PSEUDONYMIZATION_GRACE_DAYS,
  isPseudonymizationEnabled,
  shouldEraseContent,
} from "./pseudonymization-policy";

const NOW = new Date("2026-09-22T03:00:00.000Z");

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function decision(overrides = {}) {
  return {
    maskedAt: daysBefore(PSEUDONYMIZATION_GRACE_DAYS + 1),
    now: NOW,
    outage: false,
    erasedThisRun: 0,
    ...overrides,
  };
}

describe("shouldEraseContent", () => {
  it("efface un texte laissé en attente au-delà du délai", () => {
    expect(shouldEraseContent(decision())).toBe(true);
  });

  it("n'efface rien tant que le délai court", () => {
    expect(
      shouldEraseContent(
        decision({ maskedAt: daysBefore(PSEUDONYMIZATION_GRACE_DAYS - 1) }),
      ),
    ).toBe(false);
  });

  it("efface le jour même de l'échéance", () => {
    expect(
      shouldEraseContent(
        decision({ maskedAt: daysBefore(PSEUDONYMIZATION_GRACE_DAYS) }),
      ),
    ).toBe(true);
  });

  it("n'efface rien pendant une panne, même très au-delà du délai", () => {
    expect(
      shouldEraseContent(decision({ maskedAt: daysBefore(365), outage: true })),
    ).toBe(false);
  });

  it("s'arrête au plafond d'effacements de l'exécution", () => {
    expect(
      shouldEraseContent(decision({ erasedThisRun: MAX_ERASURES_PER_RUN })),
    ).toBe(false);
  });

  it("n'efface rien sans date de masquage, faute de pouvoir prouver le délai", () => {
    expect(shouldEraseContent(decision({ maskedAt: null }))).toBe(false);
  });
});

describe("isPseudonymizationEnabled", () => {
  const initial = process.env.REPORT_PSEUDONYMIZATION_ENABLED;

  afterEach(() => {
    process.env.REPORT_PSEUDONYMIZATION_ENABLED = initial;
  });

  it.each([undefined, "", "false", "1", "yes", "TRUE"])(
    "reste désactivé sur %s",
    (value) => {
      if (value === undefined) {
        delete process.env.REPORT_PSEUDONYMIZATION_ENABLED;
      } else {
        process.env.REPORT_PSEUDONYMIZATION_ENABLED = value;
      }
      expect(isPseudonymizationEnabled()).toBe(false);
    },
  );

  it("s'active sur la valeur exacte true", () => {
    process.env.REPORT_PSEUDONYMIZATION_ENABLED = "true";
    expect(isPseudonymizationEnabled()).toBe(true);
  });
});

describe("garde-fous", () => {
  it("expose des seuils non nuls", () => {
    expect(PSEUDONYMIZATION_GRACE_DAYS).toBeGreaterThan(0);
    expect(MAX_ERASURES_PER_RUN).toBeGreaterThan(0);
    expect(API_FAILURE_THRESHOLD).toBeGreaterThan(0);
  });
});
