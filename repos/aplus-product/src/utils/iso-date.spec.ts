import { isValidIsoDate } from "./iso-date";

describe("isValidIsoDate", () => {
  it("accepte une date au format AAAA-MM-JJ", () => {
    expect(isValidIsoDate("2026-07-13")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
  });

  it("rejette une date au mauvais format", () => {
    expect(isValidIsoDate("13/07/2026")).toBe(false);
    expect(isValidIsoDate("2026-7-1")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("';DROP TABLE--")).toBe(false);
  });

  it("rejette une date inexistante que JS décalerait silencieusement", () => {
    expect(isValidIsoDate("2026-02-31")).toBe(false);
    expect(isValidIsoDate("2026-99-99")).toBe(false);
    expect(isValidIsoDate("2025-02-29")).toBe(false);
  });
});
