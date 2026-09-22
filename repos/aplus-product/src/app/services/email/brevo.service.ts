// Pas d'`import "server-only"` ici : `scripts/check-email-templates.ts` importe ce
// module depuis tsx, hors runtime Next.

import * as Brevo from "@getbrevo/brevo";
import type { RemoteTemplate } from "./template-audit";

export type TemplateFetchFailure =
  | "no-api-key"
  | "credentials-rejected"
  | "not-found"
  | "api-error";

/**
 * Remplace le `null` de l'ancien `getBrevoTemplate`, qui confondait « pas de clé »
 * et « template supprimé ». La distinction n'intéressait pas l'aperçu de debug ;
 * elle est le résultat pour un outil de vérification.
 */
export type TemplateFetch =
  | { readonly ok: true; readonly template: RemoteTemplate }
  | {
      readonly ok: false;
      readonly reason: TemplateFetchFailure;
      readonly error: string;
    };

interface BrevoEmailOptions {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, unknown>;
  sender?: { email: string; name?: string };
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  replyTo?: { email: string; name?: string };
  attachment?: { name: string; content: string }[];
}

interface BrevoResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendBrevoEmail(
  options: BrevoEmailOptions,
): Promise<BrevoResponse> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.error("BREVO_API_KEY is not defined");
    return { success: false, error: "BREVO_API_KEY is not defined" };
  }

  try {
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.to = options.to;
    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.sender = options.sender ?? {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME,
    };

    if (options.templateId) {
      sendSmtpEmail.templateId = options.templateId;
      sendSmtpEmail.params = options.params;
    } else {
      sendSmtpEmail.htmlContent = options.htmlContent;
      sendSmtpEmail.textContent = options.textContent;
    }

    if (options.cc) sendSmtpEmail.cc = options.cc;
    if (options.bcc) sendSmtpEmail.bcc = options.bcc;
    if (options.replyTo) sendSmtpEmail.replyTo = options.replyTo;
    if (options.attachment) sendSmtpEmail.attachment = options.attachment;

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true, messageId: response.body.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const responseData = (error as { response?: { data?: unknown } })?.response
      ?.data;
    console.error("Failed to send Brevo email:", errorMessage, error);
    if (responseData) {
      console.error(
        "[Brevo] Error response body:",
        JSON.stringify(responseData),
      );
    }
    return { success: false, error: errorMessage };
  }
}

export async function fetchBrevoTemplate(
  templateId: number,
): Promise<TemplateFetch> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      reason: "no-api-key",
      error: "BREVO_API_KEY is not defined",
    };
  }

  try {
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

    const response = await apiInstance.getSmtpTemplate(templateId);
    const template = response.body;
    return {
      ok: true,
      template: {
        id: template.id ?? templateId,
        name: template.name ?? "",
        subject: template.subject ?? "",
        htmlContent: template.htmlContent ?? "",
        isActive: template.isActive ?? false,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: failureReasonFor(statusCodeOf(error)),
      error:
        brevoErrorDetail(error) ??
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

function failureReasonFor(status: number | undefined): TemplateFetchFailure {
  if (status === 401 || status === 403) return "credentials-rejected";
  if (status === 404) return "not-found";
  return "api-error";
}

/**
 * Quatre clés parce que le SDK Brevo passe par axios : sur un statut non-2xx il
 * relaie le rejet d'axios, qui porte `status`, et n'atteint jamais son propre
 * `HttpError`, qui porte `statusCode`. Ne lire que `statusCode` rendait toute
 * distinction de statut inatteignable en production.
 */
function statusCodeOf(error: unknown): number | undefined {
  const candidate = error as {
    statusCode?: number;
    status?: number;
    response?: { statusCode?: number; status?: number };
  };
  return (
    candidate?.statusCode ??
    candidate?.status ??
    candidate?.response?.statusCode ??
    candidate?.response?.status
  );
}

function brevoErrorDetail(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  const response = error.response;
  if (
    typeof response !== "object" ||
    response === null ||
    !("data" in response)
  ) {
    return undefined;
  }

  let body: unknown = response.data;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  if (typeof body !== "object" || body === null) return undefined;

  const code =
    "code" in body && typeof body.code === "string" ? body.code : undefined;
  const message =
    "message" in body && typeof body.message === "string"
      ? body.message
      : undefined;

  if (code && message) return `${code}: ${message}`;
  return code ?? message;
}
