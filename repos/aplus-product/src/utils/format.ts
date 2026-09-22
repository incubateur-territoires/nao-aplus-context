export function formatPhoneNumber(phoneNumber: string | null | undefined) {
  if (!phoneNumber) return "";
  return phoneNumber.replace(
    /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
    "$1 $2 $3 $4 $5",
  );
}

export function formatDate(
  date: Date | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
) {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString("fr-FR", { timeZone, ...options });
}

export function formatToLongDate(date: Date | string, timeZone: string) {
  // 26 mai 2025, 15h03
  const dateObj = new Date(date);

  const datePart = dateObj.toLocaleString("fr-FR", {
    timeZone,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const timePart = dateObj
    .toLocaleString("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(":", "h");

  return `${datePart}, ${timePart}`;
}

// Formate un délai en jours (fractionnaires) en texte long : « 2 jours et 12 heures ».
// Gère le singulier/pluriel et arrondit à l'heure la plus proche.
export function formatDelayDaysToText(days: number): string {
  const totalHours = Math.round(days * 24);
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;

  const dayPart = `${d} jour${d > 1 ? "s" : ""}`;
  const hourPart = `${h} heure${h > 1 ? "s" : ""}`;

  if (d === 0 && h === 0) return "moins d'une heure";
  if (d === 0) return hourPart;
  if (h === 0) return dayPart;
  return `${dayPart} et ${hourPart}`;
}

// Formate une date en durée relative au présent : « il y a 2 jours »,
// « il y a 3 heures », « à l'instant ». Pour du texte de contexte (récap).
export function formatRelativeToNow(date: Date | string): string {
  const dateObj = new Date(date);
  const diffMs = dateObj.getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "always" });

  if (absSeconds < 60) return "à l'instant";

  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "week", seconds: 604800 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
  ];

  for (const { unit, seconds } of units) {
    if (absSeconds >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "à l'instant";
}

export function onlyHours(date: Date | string, timeZone: string) {
  const dateObj = new Date(date);
  return dateObj
    .toLocaleString("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(":", "h");
}
