// Ce module reste importable hors runtime Next : `scripts/check-email-templates.ts`
// l'importe depuis tsx, où `server-only` lèverait. Ses fonctions de comparaison
// restent pures, ce qui permet à jest de les couvrir sans toucher au réseau ;
// `runTemplateAudit` est le seul point qui sort, vers Brevo.

import { fetchBrevoTemplate } from "./brevo.service";
import {
  EMAIL_TEMPLATES,
  TEMPLATE_PLACEHOLDER,
  type TemplateKey,
} from "./email.template";

const ANY_PLACEHOLDER = /\{\{[^}]*\}\}/g;

export interface RemoteTemplate {
  readonly id: number;
  readonly name: string;
  readonly subject: string;
  readonly htmlContent: string;
  readonly isActive: boolean;
}

export type Finding =
  | {
      readonly severity: "error";
      readonly kind: "credentials-rejected";
      readonly detail: string;
    }
  | {
      readonly severity: "error";
      readonly kind: "template-unreachable";
      readonly template: TemplateKey;
      readonly detail: string;
    }
  | {
      readonly severity: "error";
      readonly kind: "template-inactive";
      readonly template: TemplateKey;
    }
  | {
      readonly severity: "error";
      readonly kind: "vars-missing-in-code";
      readonly template: TemplateKey;
      readonly vars: readonly string[];
    }
  | {
      readonly severity: "warning";
      readonly kind: "vars-unused-by-brevo";
      readonly template: TemplateKey;
      readonly vars: readonly string[];
    }
  | {
      readonly severity: "error";
      readonly kind: "subject-placeholder-undeclared";
      readonly template: TemplateKey;
      readonly vars: readonly string[];
    }
  | {
      readonly severity: "error";
      readonly kind: "subject-placeholder-not-canonical";
      readonly template: TemplateKey;
      readonly placeholders: readonly string[];
    }
  | {
      readonly severity: "error";
      readonly kind: "duplicate-template-id";
      readonly template: TemplateKey;
      readonly id: number;
    };

/**
 * Ne capture que l'espace de noms `params.`. Brevo emploie aussi `{{ contact.X }}`
 * et des blocs de contrôle, qui ne sont pas des variables d'envoi : les compter
 * produirait un écart sur chaque template.
 */
export function extractParamPlaceholders(source: string): ReadonlySet<string> {
  return new Set(
    [...source.matchAll(TEMPLATE_PLACEHOLDER)].map((match) => match[1]),
  );
}

export function auditDeclarations(): readonly Finding[] {
  const findings: Finding[] = [];
  const seenIds = new Map<number, TemplateKey>();

  for (const template of templateKeys()) {
    const definition = EMAIL_TEMPLATES[template];

    if (seenIds.has(definition.id)) {
      findings.push({
        severity: "error",
        kind: "duplicate-template-id",
        template,
        id: definition.id,
      });
    }
    seenIds.set(definition.id, template);

    const declared = new Set<string>(definition.vars);
    const canonical = extractParamPlaceholders(definition.subject);

    const undeclared = [...canonical].filter((name) => !declared.has(name));
    if (undeclared.length > 0) {
      findings.push({
        severity: "error",
        kind: "subject-placeholder-undeclared",
        template,
        vars: undeclared,
      });
    }

    const nonCanonical = (
      definition.subject.match(ANY_PLACEHOLDER) ?? []
    ).filter(
      (placeholder) =>
        !/^\{\{\s*params\.[A-Za-z0-9_]+\s*\}\}$/.test(placeholder),
    );
    if (nonCanonical.length > 0) {
      findings.push({
        severity: "error",
        kind: "subject-placeholder-not-canonical",
        template,
        placeholders: nonCanonical,
      });
    }
  }

  return findings;
}

/**
 * Asymétrie voulue. Une variable attendue par Brevo et non déclarée est une erreur,
 * parce que c'est exactement le bug d'avril : Brevo remplace la variable absente par
 * du vide sans rien signaler, et l'e-mail part avec un lien mort. Une variable
 * déclarée et inutilisée par Brevo est inoffensive à l'envoi, donc un avertissement.
 */
export function auditAgainstRemote(
  template: TemplateKey,
  remote: RemoteTemplate,
): readonly Finding[] {
  const findings: Finding[] = [];

  if (!remote.isActive) {
    findings.push({ severity: "error", kind: "template-inactive", template });
  }

  const required = new Set([
    ...extractParamPlaceholders(remote.htmlContent),
    ...extractParamPlaceholders(remote.subject),
  ]);
  const declared = new Set<string>(EMAIL_TEMPLATES[template].vars);

  const missing = [...required].filter((name) => !declared.has(name));
  if (missing.length > 0) {
    findings.push({
      severity: "error",
      kind: "vars-missing-in-code",
      template,
      vars: missing,
    });
  }

  const unused = [...declared].filter((name) => !required.has(name));
  if (unused.length > 0) {
    findings.push({
      severity: "warning",
      kind: "vars-unused-by-brevo",
      template,
      vars: unused,
    });
  }

  return findings;
}

export async function runTemplateAudit(): Promise<readonly Finding[]> {
  const findings: Finding[] = [...auditDeclarations()];

  for (const template of templateKeys()) {
    const fetched = await fetchBrevoTemplate(EMAIL_TEMPLATES[template].id);

    if (fetched.ok) {
      findings.push(...auditAgainstRemote(template, fetched.template));
      continue;
    }

    if (
      fetched.reason === "no-api-key" ||
      fetched.reason === "credentials-rejected"
    ) {
      findings.push({
        severity: "error",
        kind: "credentials-rejected",
        detail: fetched.error,
      });
      break;
    }

    findings.push({
      severity: "error",
      kind: "template-unreachable",
      template,
      detail: `${fetched.reason} (${fetched.error})`,
    });
  }

  return findings;
}

export function hasError(findings: readonly Finding[]): boolean {
  return findings.some((finding) => finding.severity === "error");
}

export function describeFinding(finding: Finding): string {
  switch (finding.kind) {
    case "credentials-rejected":
      return `identifiants Brevo refusés : ${finding.detail}`;
    case "template-unreachable":
      return `template illisible chez Brevo : ${finding.detail}`;
    case "template-inactive":
      return "template désactivé chez Brevo, tout envoi sera rejeté";
    case "vars-missing-in-code":
      return `variables attendues par Brevo et non déclarées : ${finding.vars.join(", ")}`;
    case "vars-unused-by-brevo":
      return `variables déclarées et inutilisées par Brevo : ${finding.vars.join(", ")}`;
    case "subject-placeholder-undeclared":
      return `placeholders du sujet non déclarés : ${finding.vars.join(", ")}`;
    case "subject-placeholder-not-canonical":
      return `placeholders du sujet hors syntaxe {{ params.x }} : ${finding.placeholders.join(", ")}`;
    case "duplicate-template-id":
      return `identifiant Brevo ${finding.id} déjà utilisé par un autre template`;
  }
}

export function formatFindings(findings: readonly Finding[]): string {
  const keys = templateKeys();
  const width = Math.max(...keys.map((key) => key.length));
  const lines: string[] = [];

  const global = findings.filter((finding) => !("template" in finding));
  for (const finding of global) {
    const mark = finding.severity === "error" ? "✗" : "⚠";
    lines.push(`  ${mark} ${describeFinding(finding)}`);
  }

  // Un refus d'identifiants arrête la boucle : lister les templates ici les
  // marquerait « ✓ » sans que personne les ait lus.
  if (findings.some((finding) => finding.kind === "credentials-rejected")) {
    lines.push("", "Aucun template vérifié.");
    return lines.join("\n");
  }

  if (global.length > 0) lines.push("");

  for (const template of keys) {
    const own = findings.filter(
      (finding) => "template" in finding && finding.template === template,
    );
    const label = `  ${template.padEnd(width)} (${EMAIL_TEMPLATES[template].id})`;

    if (own.length === 0) {
      lines.push(`${label}  ✓`);
      continue;
    }
    for (const finding of own) {
      const mark = finding.severity === "error" ? "✗" : "⚠";
      lines.push(`${label}  ${mark} ${describeFinding(finding)}`);
    }
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.length - errors;
  lines.push(
    "",
    `${errors} erreur(s), ${warnings} avertissement(s) sur ${keys.length} templates.`,
  );

  return lines.join("\n");
}

function templateKeys(): TemplateKey[] {
  return Object.keys(EMAIL_TEMPLATES) as TemplateKey[];
}
