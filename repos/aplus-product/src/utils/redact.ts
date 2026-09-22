const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Les messages d'erreur de Brevo citent souvent l'adresse rejetée, et ces messages
 * repartent vers les logs, Mattermost et Sentry, où aucune donnée personnelle ne
 * doit apparaître.
 */
export function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, "[adresse]");
}
