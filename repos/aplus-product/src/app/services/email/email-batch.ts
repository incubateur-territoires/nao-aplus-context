import * as Sentry from "@sentry/nextjs";
import type { EmailRecipient } from "@/types/email-debug";
import { createLogger } from "@/utils/logger";
import { redactEmails } from "@/utils/redact";
import { sendTemplatedEmail } from "./email.service";
import {
  EMAIL_TEMPLATES,
  type TemplateKey,
  type TemplateVars,
} from "./email.template";

const DEFAULT_CONCURRENCY = 10;

export interface EmailJob<K extends TemplateKey> {
  /**
   * Identifiant métier de ce que l'envoi concerne, jamais une adresse : c'est lui
   * qui désigne un échec dans les logs, Mattermost et Sentry.
   */
  readonly ref: string;
  readonly to: EmailRecipient[];
  readonly params: TemplateVars<K>;
  readonly replyTo?: EmailRecipient;
}

export interface EmailFailure {
  readonly ref: string;
  readonly error: string;
}

export interface EmailBatchOutcome {
  readonly sent: readonly string[];
  readonly failures: readonly EmailFailure[];
}

/**
 * `total-failure` mérite un nom parce que c'est la signature d'une panne de
 * template ou de clé, et non d'un destinataire fautif. C'est ce cas qui est resté
 * muet pendant cinq mois.
 */
export type BatchVerdict =
  | "nothing-to-send"
  | "all-sent"
  | "partial-failure"
  | "total-failure";

export const EMPTY_EMAIL_BATCH: EmailBatchOutcome = { sent: [], failures: [] };

export function verdictOf(outcome: EmailBatchOutcome): BatchVerdict {
  if (outcome.sent.length === 0 && outcome.failures.length === 0) {
    return "nothing-to-send";
  }
  if (outcome.failures.length === 0) return "all-sent";
  if (outcome.sent.length === 0) return "total-failure";
  return "partial-failure";
}

export function mergeEmailBatchOutcomes(
  outcomes: readonly EmailBatchOutcome[],
): EmailBatchOutcome {
  return {
    sent: outcomes.flatMap((outcome) => [...outcome.sent]),
    failures: outcomes.flatMap((outcome) => [...outcome.failures]),
  };
}

interface EmailBatchInput<K extends TemplateKey> {
  readonly template: K;
  /** Étiquette du contexte appelant : scope du logger, tag Sentry. */
  readonly scope: string;
  readonly jobs: readonly EmailJob<K>[];
  readonly concurrency?: number;
}

/**
 * Envoie, compte et alerte. Ne lève jamais.
 *
 * L'escalade est faite ici et non par l'appelant : le défaut d'origine n'est pas
 * qu'un compteur était faux, c'est qu'un humain devait penser à regarder. Deux
 * crons ont écrit indépendamment le même filtre `status === "rejected"`, toujours
 * à zéro puisque l'envoi ne rejette jamais.
 */
export async function sendTemplatedEmailBatch<K extends TemplateKey>(
  input: EmailBatchInput<K>,
): Promise<EmailBatchOutcome> {
  const concurrency = input.concurrency ?? DEFAULT_CONCURRENCY;
  const sent: string[] = [];
  const failures: EmailFailure[] = [];

  for (let i = 0; i < input.jobs.length; i += concurrency) {
    const slice = input.jobs.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      slice.map((job) =>
        sendTemplatedEmail(input.template, {
          to: job.to,
          params: job.params,
          replyTo: job.replyTo,
        }),
      ),
    );

    results.forEach((result, index) => {
      const ref = slice[index].ref;
      if (result.status === "rejected") {
        failures.push({ ref, error: describe(result.reason) });
        return;
      }
      if (result.value.success) {
        sent.push(ref);
        return;
      }
      failures.push({ ref, error: describe(result.value.error) });
    });
  }

  const outcome: EmailBatchOutcome = { sent, failures };
  report(input.template, input.scope, outcome);
  return outcome;
}

function describe(error: unknown): string {
  if (error instanceof Error) return redactEmails(error.message);
  if (typeof error === "string") return redactEmails(error);
  return "Unknown error";
}

function report<K extends TemplateKey>(
  template: K,
  scope: string,
  outcome: EmailBatchOutcome,
): void {
  const verdict = verdictOf(outcome);
  if (verdict === "nothing-to-send" || verdict === "all-sent") return;

  const meta = {
    template,
    templateId: EMAIL_TEMPLATES[template].id,
    sent: outcome.sent.length,
    failed: outcome.failures.length,
    refs: outcome.failures.map((failure) => failure.ref),
  };

  createLogger(scope).error("Échecs d'envoi d'e-mail", meta);

  Sentry.captureMessage(`Échecs d'envoi d'e-mail : ${template}`, {
    level: verdict === "total-failure" ? "error" : "warning",
    // Empreinte stable par template : une panne qui dure reste un ticket qui
    // grossit, au lieu d'un ticket par exécution que personne ne relit.
    fingerprint: ["email-batch", template],
    tags: { scope, template, verdict },
    extra: { ...meta, failures: outcome.failures },
  });
}
