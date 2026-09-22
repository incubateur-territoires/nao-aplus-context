import { formatDelayDaysToText, formatRelativeToNow } from "./format";

describe("formatDelayDaysToText", () => {
  it("formate jours et heures (pluriel)", () => {
    expect(formatDelayDaysToText(2.5)).toBe("2 jours et 12 heures");
    expect(formatDelayDaysToText(6.25)).toBe("6 jours et 6 heures");
  });

  it("gère le singulier des jours et des heures", () => {
    // 1 jour et 1 heure = 25h = 1.0417 jours
    expect(formatDelayDaysToText(25 / 24)).toBe("1 jour et 1 heure");
  });

  it("affiche uniquement les heures sous un jour", () => {
    expect(formatDelayDaysToText(12 / 24)).toBe("12 heures");
    expect(formatDelayDaysToText(1 / 24)).toBe("1 heure");
  });

  it("affiche uniquement les jours quand pile un nombre de jours", () => {
    expect(formatDelayDaysToText(3)).toBe("3 jours");
    expect(formatDelayDaysToText(1)).toBe("1 jour");
  });

  it("repli sous une heure", () => {
    expect(formatDelayDaysToText(0)).toBe("moins d'une heure");
    expect(formatDelayDaysToText(0.01)).toBe("moins d'une heure");
  });
});

describe("formatRelativeToNow", () => {
  it("renvoie « à l'instant » pour une date très récente", () => {
    expect(formatRelativeToNow(new Date())).toBe("à l'instant");
  });

  it("formate une date passée de quelques jours", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000);
    expect(formatRelativeToNow(twoDaysAgo)).toBe("il y a 2 jours");
  });

  it("formate une date passée de quelques heures", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);
    expect(formatRelativeToNow(threeHoursAgo)).toBe("il y a 3 heures");
  });
});
