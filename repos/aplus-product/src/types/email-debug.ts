export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface DebugEmail {
  id: string;
  timestamp: Date;
  templateName?: string;
  templateId?: number;
  subject?: string;
  sender: EmailRecipient;
  recipients: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  htmlContent?: string;
  textContent?: string;
  variables?: Record<string, unknown>;
  status: "sent" | "failed";
  error?: string;
  messageId?: string;
}
