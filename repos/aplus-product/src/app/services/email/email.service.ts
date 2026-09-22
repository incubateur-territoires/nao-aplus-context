import "server-only";

import { sendBrevoEmail, fetchBrevoTemplate } from "./brevo.service";
import type { DebugEmail, EmailRecipient } from "@/types/email-debug";
import { isDebugModeEnabled } from "@/utils/debug-mode";
import { createLogger } from "@/utils/logger";
import { redactEmails } from "@/utils/redact";
import {
  EMAIL_TEMPLATES,
  TEMPLATE_PLACEHOLDER,
  renderSubject,
  type TemplateKey,
  type TemplateVars,
} from "./email.template";

const logger = createLogger("Email");

// Server memory storage for debug emails
// Always access globalThis directly to survive HMR module re-evaluation
const DEBUG_STORE_KEY = "__adminplus_debug_emails__";
const MAX_DEBUG_EMAILS = 100;

function getDebugEmailStore(): DebugEmail[] {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!Array.isArray(g[DEBUG_STORE_KEY])) {
    g[DEBUG_STORE_KEY] = [];
  }
  return g[DEBUG_STORE_KEY] as DebugEmail[];
}

export interface EmailOptions {
  to: EmailRecipient[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  sender?: EmailRecipient;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  replyTo?: EmailRecipient;
  attachment?: { name: string; content: string }[];
}

export interface TemplateEmailOptions<K extends TemplateKey> {
  to: EmailRecipient[];
  params: TemplateVars<K>;
  sender?: EmailRecipient;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  replyTo?: EmailRecipient;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function renderTemplateWithParams(
  htmlContent: string,
  params: Record<string, string>,
): string {
  return htmlContent.replace(
    TEMPLATE_PLACEHOLDER,
    (placeholder, name: string) => params[name] ?? placeholder,
  );
}

/**
 * Envoi à contenu libre. Ne connaît plus les templates : un envoi templaté ne peut
 * plus contourner le contrat typé de `sendTemplatedEmail`.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  return dispatch(options);
}

export async function sendTemplatedEmail<K extends TemplateKey>(
  template: K,
  options: TemplateEmailOptions<K>,
): Promise<EmailResult> {
  const definition = EMAIL_TEMPLATES[template];

  return dispatch({
    to: options.to,
    subject: renderSubject(template, options.params),
    sender: options.sender,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo,
    templateId: definition.id,
    params: options.params as Record<string, string>,
  });
}

interface DispatchOptions extends EmailOptions {
  templateId?: number;
  params?: Record<string, string>;
}

async function dispatch(options: DispatchOptions): Promise<EmailResult> {
  const sender = options.sender ?? {
    email: process.env.BREVO_SENDER_EMAIL!,
    name: process.env.BREVO_SENDER_NAME!,
  };

  let templateHtmlContent = options.htmlContent;
  let templateName: string | undefined;

  // In debug mode, fetch the template HTML if using a templateId
  if (isDebugModeEnabled() && options.templateId && !options.htmlContent) {
    const fetched = await fetchBrevoTemplate(options.templateId);
    if (fetched.ok) {
      templateName = fetched.template.name;
      templateHtmlContent = options.params
        ? renderTemplateWithParams(fetched.template.htmlContent, options.params)
        : fetched.template.htmlContent;
    }
  }

  const debugEmail: DebugEmail = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    templateName,
    templateId: options.templateId,
    subject: options.subject,
    sender,
    recipients: options.to,
    cc: options.cc,
    bcc: options.bcc,
    htmlContent: templateHtmlContent,
    textContent: options.textContent,
    variables: options.params,
    status: "sent",
  };

  try {
    const result = await sendBrevoEmail({
      to: options.to,
      subject: options.subject,
      templateId: options.templateId,
      params: options.params,
      htmlContent: options.htmlContent,
      textContent: options.textContent,
      sender,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      attachment: options.attachment,
    });
    if (result.success) {
      debugEmail.messageId = result.messageId;
      debugEmail.status = "sent";
    } else {
      debugEmail.status = "failed";
      debugEmail.error = result.error;
    }

    // Store for debug in dev mode
    if (isDebugModeEnabled()) {
      const store = getDebugEmailStore();
      store.unshift(debugEmail); // Newest first
      if (store.length > MAX_DEBUG_EMAILS) {
        store.splice(MAX_DEBUG_EMAILS);
      }
    }

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (error) {
    logger.error("Échec d'envoi", {
      templateId: options.templateId,
      error: error instanceof Error ? redactEmails(error.message) : error,
    });
    debugEmail.status = "failed";
    debugEmail.error = error instanceof Error ? error.message : "Unknown error";

    if (isDebugModeEnabled()) {
      const store = getDebugEmailStore();
      store.unshift(debugEmail);
      if (store.length > MAX_DEBUG_EMAILS) {
        store.splice(MAX_DEBUG_EMAILS);
      }
    }

    return {
      success: false,
      error: debugEmail.error,
    };
  }
}

// Functions for tRPC router to access debug emails
export function getDebugEmails(): DebugEmail[] {
  if (!isDebugModeEnabled()) return [];
  return getDebugEmailStore();
}

export function clearDebugEmails(): void {
  getDebugEmailStore().length = 0;
}

// For testing: add a mock email to the store
export function addMockDebugEmail(email: Partial<DebugEmail>): void {
  if (!isDebugModeEnabled()) return;

  const mockEmail: DebugEmail = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    subject: email.subject ?? "Test Email",
    sender: email.sender ?? { email: "test@example.com", name: "Test Sender" },
    recipients: email.recipients ?? [{ email: "recipient@example.com" }],
    htmlContent: email.htmlContent ?? "<p>Test email content</p>",
    status: email.status ?? "sent",
    ...email,
  };

  const store = getDebugEmailStore();
  store.unshift(mockEmail);
  if (store.length > MAX_DEBUG_EMAILS) {
    store.splice(MAX_DEBUG_EMAILS);
  }
}
