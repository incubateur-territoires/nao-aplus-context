// Traduit une chaîne User-Agent en libellé lisible « Navigateur sur Système »
// pour la vue support (ex. « Chrome sur macOS »). Renvoie null si l'agent est
// vide ou non reconnu, pour ne rien afficher plutôt qu'une donnée trompeuse.

function detectBrowser(ua: string): string | null {
  // L'ordre compte : Edge, Opera et Samsung embarquent tous « Chrome » dans
  // leur User-Agent, ils doivent donc être testés avant.
  if (ua.includes("Edg/") || ua.includes("Edge/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("SamsungBrowser")) return "Samsung Internet";
  if (ua.includes("Firefox/") || ua.includes("FxiOS")) return "Firefox";
  if (ua.includes("Chrome/") || ua.includes("CriOS")) return "Chrome";
  // Safari se reconnaît par « Version/… Safari » sans marqueur Chrome.
  if (ua.includes("Safari/") && ua.includes("Version/")) return "Safari";
  return null;
}

function detectOS(ua: string): string | null {
  if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod")) {
    return "iOS";
  }
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Windows NT")) return "Windows";
  if (ua.includes("Mac OS X") || ua.includes("Macintosh")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return null;
}

export function formatUserAgent(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) return null;

  const browser = detectBrowser(userAgent);
  const os = detectOS(userAgent);

  if (browser && os) return `${browser} sur ${os}`;
  if (browser) return browser;
  if (os) return os;
  return null;
}
