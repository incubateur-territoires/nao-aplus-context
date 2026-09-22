// Ce module reste importable hors runtime Next : `scripts/check-email-templates.ts`
// l'importe depuis tsx, où `server-only` lèverait.

interface TemplateDefinition {
  readonly id: number;
  readonly subject: string;
  readonly vars: readonly string[];
}

export const EMAIL_TEMPLATES = {
  CONFIRM_ACCOUNT: {
    id: 36,
    subject: "Vous avez été ajouté à une équipe sur Administration+",
    vars: ["linkUrl"],
  },
  ACCOUNT_CREATED: {
    id: 39,
    subject: "Votre compte Administration+ a été créé",
    vars: ["userFirstName", "linkUrl"],
  },
  RESET_PASSWORD: {
    id: 40,
    subject: "[A+] Réinitialisation du mot de passe",
    vars: ["linkUrl", "expiresAt"],
  },
  REPORT_CREATED: {
    id: 41,
    subject: "[A+] Nouveau signalement : {{ params.reportSubject }}",
    vars: ["userFirstName", "reportSubject", "reportUrl", "authorName"],
  },
  ANSWER_CREATED: {
    id: 29,
    subject: "[A+] Nouvelle réponse : {{ params.reportName }}",
    vars: ["userFirstName", "authorFullName", "answerUrl", "reportName"],
  },
  INACTIVITY_WARNING_FIRST: {
    id: 31,
    subject: "[A+] Compte inactif - première notification",
    vars: ["userFirstName", "loginUrl"],
  },
  INACTIVITY_WARNING_FINAL: {
    id: 34,
    subject: "[A+] Compte inactif - dernière notification",
    vars: ["userFirstName", "loginUrl"],
  },
  ACCOUNT_DEACTIVATED_INACTIVITY: {
    id: 33,
    subject: "[A+] Compte désactivé",
    vars: ["userFirstName"],
  },
  ACCOUNT_DEACTIVATED: {
    id: 42,
    subject: "[A+] Compte désactivé",
    vars: ["userFirstName"],
  },
  DEACTIVATION_REPORTS_REASSIGNED: {
    id: 45,
    subject:
      "[A+] Signalements attribués suite à la désactivation d'un membre de votre équipe",
    vars: ["userFirstName", "linkUrl"],
  },
  ACCOUNT_REACTIVATED: {
    id: 43,
    subject: "[A+] Compte réactivé",
    vars: ["userFirstName", "linkUrl"],
  },
  DIGEST: {
    id: 46,
    subject: "[A+] Récapitulatif des notifications",
    vars: ["userFirstName", "reportsText", "answersText", "statusText"],
  },
  ACCOUNT_DELETED: {
    id: 44,
    subject: "[A+] Compte supprimé",
    vars: [],
  },
  INVITE_SUPERVISOR: {
    id: 53,
    subject:
      "Un administrateur vous invite à devenir superviseur sur Administration+",
    vars: ["linkUrl"],
  },
  REPORT_AUTO_CLOSED: {
    id: 59,
    subject:
      "[A+] Signalement automatiquement fermé : {{ params.reportSubject }}",
    vars: ["userFirstName", "reportSubject", "reportUrl"],
  },
  REPORT_OVERDUE: {
    id: 60,
    subject: "[A+] Signalement en souffrance : {{ params.reportSubject }}",
    vars: ["userFirstName", "reportSubject", "reportUrl"],
  },
} as const satisfies Record<string, TemplateDefinition>;

export type TemplateKey = keyof typeof EMAIL_TEMPLATES;

export const TEMPLATE_PLACEHOLDER = /\{\{\s*params\.([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * Les valeurs sont des `string` et non des `unknown` : Brevo fait une substitution
 * textuelle, donc le formatage appartient à l'appelant et non au transport.
 */
export type TemplateVars<K extends TemplateKey> = Record<
  (typeof EMAIL_TEMPLATES)[K]["vars"][number],
  string
>;

/**
 * Substitution en une seule passe : une valeur fournie par un citoyen, comme le
 * sujet d'un signalement, ne doit pas pouvoir introduire un placeholder qu'une
 * passe suivante remplirait.
 */
export function renderSubject<K extends TemplateKey>(
  template: K,
  vars: TemplateVars<K>,
): string {
  const values = vars as Record<string, string>;
  return EMAIL_TEMPLATES[template].subject.replace(
    TEMPLATE_PLACEHOLDER,
    (placeholder, name: string) => values[name] ?? placeholder,
  );
}
