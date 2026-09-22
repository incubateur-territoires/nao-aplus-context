const mockFetchBrevoTemplate = jest.fn();
jest.mock("./brevo.service", () => ({
  fetchBrevoTemplate: (...args: unknown[]) => mockFetchBrevoTemplate(...args),
}));

import { EMAIL_TEMPLATES } from "./email.template";
import {
  auditAgainstRemote,
  auditDeclarations,
  extractParamPlaceholders,
  formatFindings,
  hasError,
  runTemplateAudit,
  type RemoteTemplate,
} from "./template-audit";

const TEMPLATE_COUNT = Object.keys(EMAIL_TEMPLATES).length;

beforeEach(() => {
  jest.clearAllMocks();
});

function remote(overrides: Partial<RemoteTemplate> = {}): RemoteTemplate {
  return {
    id: EMAIL_TEMPLATES.REPORT_OVERDUE.id,
    name: "Signalement en souffrance",
    subject: "[A+] Signalement en souffrance : {{ params.reportSubject }}",
    htmlContent:
      '<p>Bonjour {{ params.userFirstName }}</p><a href="{{ params.reportUrl }}">Voir</a>',
    isActive: true,
    ...overrides,
  };
}

describe("extractParamPlaceholders", () => {
  it("keeps only the params namespace", () => {
    const found = extractParamPlaceholders(
      "{{ params.reportUrl }} {{ contact.FIRSTNAME }} {{ unsubscribe }}",
    );

    expect([...found]).toEqual(["reportUrl"]);
  });

  it("deduplicates and tolerates the tight spelling", () => {
    const found = extractParamPlaceholders(
      "{{ params.a }} {{params.a}} {{ params.b }}",
    );

    expect([...found].sort()).toEqual(["a", "b"]);
  });
});

describe("auditDeclarations", () => {
  it("passes on the declarations shipped in the repository", () => {
    expect(auditDeclarations()).toEqual([]);
  });
});

describe("auditAgainstRemote", () => {
  it("accepts a template whose variables match the declaration", () => {
    expect(auditAgainstRemote("REPORT_OVERDUE", remote())).toEqual([]);
  });

  it("fails on a deactivated template", () => {
    const findings = auditAgainstRemote(
      "REPORT_OVERDUE",
      remote({ isActive: false }),
    );

    expect(findings).toContainEqual({
      severity: "error",
      kind: "template-inactive",
      template: "REPORT_OVERDUE",
    });
    expect(hasError(findings)).toBe(true);
  });

  it("fails when Brevo expects a variable the code does not declare", () => {
    const findings = auditAgainstRemote(
      "REPORT_OVERDUE",
      remote({
        htmlContent:
          '<p>{{ params.userFirstName }}</p><a href="{{ params.reportUrl }}">{{ params.ctaLabel }}</a>',
      }),
    );

    expect(findings).toContainEqual({
      severity: "error",
      kind: "vars-missing-in-code",
      template: "REPORT_OVERDUE",
      vars: ["ctaLabel"],
    });
  });

  it("only warns when the code declares a variable Brevo ignores", () => {
    const findings = auditAgainstRemote(
      "REPORT_OVERDUE",
      remote({
        subject: "[A+] Signalement en souffrance",
        htmlContent: "<p>{{ params.userFirstName }} {{ params.reportUrl }}</p>",
      }),
    );

    expect(findings).toEqual([
      {
        severity: "warning",
        kind: "vars-unused-by-brevo",
        template: "REPORT_OVERDUE",
        vars: ["reportSubject"],
      },
    ]);
    expect(hasError(findings)).toBe(false);
  });

  it("catches the April failure: an active template whose link variable is not declared", () => {
    const findings = auditAgainstRemote(
      "ACCOUNT_DELETED",
      remote({
        id: EMAIL_TEMPLATES.ACCOUNT_DELETED.id,
        subject: "[A+] Compte supprimé",
        htmlContent: '<a href="{{ params.reportUrl }}">Voir</a>',
      }),
    );

    expect(findings).toEqual([
      {
        severity: "error",
        kind: "vars-missing-in-code",
        template: "ACCOUNT_DELETED",
        vars: ["reportUrl"],
      },
    ]);
  });
});

describe("formatFindings", () => {
  it("lists every template and ends with the counts", () => {
    const output = formatFindings([
      {
        severity: "error",
        kind: "template-inactive",
        template: "REPORT_OVERDUE",
      },
    ]);

    expect(output).toContain("REPORT_OVERDUE");
    expect(output).toContain("✗ template désactivé chez Brevo");
    expect(output).toContain("DIGEST");
    expect(output).toContain("✓");
    expect(output).toContain(
      "1 erreur(s), 0 avertissement(s) sur 16 templates.",
    );
  });
});

describe("runTemplateAudit", () => {
  it("stops at the first rejected credential instead of blaming every template", async () => {
    mockFetchBrevoTemplate.mockResolvedValue({
      ok: false,
      reason: "credentials-rejected",
      error: "unauthorized: IP address not authorized",
    });

    const findings = await runTemplateAudit();

    expect(mockFetchBrevoTemplate).toHaveBeenCalledTimes(1);
    expect(findings).toEqual([
      {
        severity: "error",
        kind: "credentials-rejected",
        detail: "unauthorized: IP address not authorized",
      },
    ]);
  });

  it("stops the same way when no API key is configured", async () => {
    mockFetchBrevoTemplate.mockResolvedValue({
      ok: false,
      reason: "no-api-key",
      error: "BREVO_API_KEY is not defined",
    });

    const findings = await runTemplateAudit();

    expect(mockFetchBrevoTemplate).toHaveBeenCalledTimes(1);
    expect(findings).toEqual([
      {
        severity: "error",
        kind: "credentials-rejected",
        detail: "BREVO_API_KEY is not defined",
      },
    ]);
  });

  it("keeps going past a deleted template, which says nothing about the others", async () => {
    mockFetchBrevoTemplate.mockResolvedValue({
      ok: false,
      reason: "not-found",
      error: "Template not found",
    });

    const findings = await runTemplateAudit();

    expect(mockFetchBrevoTemplate).toHaveBeenCalledTimes(TEMPLATE_COUNT);
    expect(findings).toHaveLength(TEMPLATE_COUNT);
    expect(findings).toContainEqual({
      severity: "error",
      kind: "template-unreachable",
      template: "REPORT_OVERDUE",
      detail: "not-found (Template not found)",
    });
  });

  it("compares every reachable template against its declaration", async () => {
    mockFetchBrevoTemplate.mockImplementation(async (id: number) => ({
      ok: true,
      template: {
        id,
        name: "",
        subject: "",
        htmlContent: "",
        isActive: false,
      },
    }));

    const findings = await runTemplateAudit();

    expect(mockFetchBrevoTemplate).toHaveBeenCalledTimes(TEMPLATE_COUNT);
    expect(
      findings.filter((finding) => finding.kind === "template-inactive"),
    ).toHaveLength(TEMPLATE_COUNT);
  });
});

describe("formatFindings, findings that belong to no template", () => {
  it("reports rejected credentials alone, without listing unread templates", () => {
    const output = formatFindings([
      {
        severity: "error",
        kind: "credentials-rejected",
        detail: "unauthorized: IP address not authorized",
      },
    ]);
    const lines = output.split("\n");

    expect(lines[0]).toBe(
      "  ✗ identifiants Brevo refusés : unauthorized: IP address not authorized",
    );
    expect(output).toContain("Aucun template vérifié.");
    expect(output).not.toContain("CONFIRM_ACCOUNT");
    expect(output).not.toContain("✓");
  });

  it("keeps listing templates when the failure is not about credentials", () => {
    const output = formatFindings([
      {
        severity: "error",
        kind: "template-unreachable",
        template: "CONFIRM_ACCOUNT",
        detail: "api-error (500)",
      },
    ]);

    expect(output).toContain("CONFIRM_ACCOUNT");
    expect(output).toContain(
      `1 erreur(s), 0 avertissement(s) sur ${TEMPLATE_COUNT} templates.`,
    );
  });
});
