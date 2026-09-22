import { getSafeReturnTo } from "./return-to";
import { ROUTE } from "@/app/constant/route";

describe("getSafeReturnTo", () => {
  it("retourne le chemin interne fourni", () => {
    expect(getSafeReturnTo("/signalement/abc123")).toBe("/signalement/abc123");
  });

  it("conserve la query string", () => {
    expect(getSafeReturnTo("/tous-les-signalements?page=2")).toBe(
      "/tous-les-signalements?page=2",
    );
  });

  it("retourne la route par défaut quand returnTo est null", () => {
    expect(getSafeReturnTo(null)).toBe(ROUTE.ALL_REPORTS);
  });

  it("retourne la route par défaut quand returnTo est undefined", () => {
    expect(getSafeReturnTo(undefined)).toBe(ROUTE.ALL_REPORTS);
  });

  it("rejette les URLs absolues externes", () => {
    expect(getSafeReturnTo("https://evil.com")).toBe(ROUTE.ALL_REPORTS);
  });

  it("rejette les URLs protocol-relative (//)", () => {
    expect(getSafeReturnTo("//evil.com")).toBe(ROUTE.ALL_REPORTS);
  });

  it("rejette les URLs protocol-relative avec backslash (/\\)", () => {
    expect(getSafeReturnTo("/\\evil.com")).toBe(ROUTE.ALL_REPORTS);
  });

  it("rejette un chemin relatif sans slash initial", () => {
    expect(getSafeReturnTo("signalement/abc")).toBe(ROUTE.ALL_REPORTS);
  });
});
