import { isNavItemActive } from "./nav-active";

describe("isNavItemActive", () => {
  it("allume l'entrée quand le chemin est exactement la route", () => {
    expect(isNavItemActive("/contact", "/contact")).toBe(true);
    expect(isNavItemActive("/contacts", "/contacts")).toBe(true);
  });

  it("n'allume pas « Contact » sur la liste des contacts", () => {
    expect(isNavItemActive("/contacts", "/contact")).toBe(false);
    expect(isNavItemActive("/contacts/creer", "/contact")).toBe(false);
  });

  it("allume l'entrée sur une sous-page", () => {
    expect(isNavItemActive("/contacts/creer", "/contacts")).toBe(true);
    expect(isNavItemActive("/contacts/modifier/abc", "/contacts")).toBe(true);
  });

  it("allume l'entrée quand le chemin porte des query params", () => {
    expect(isNavItemActive("/signalement?step=1", "/signalement")).toBe(true);
  });

  it("n'allume pas une route sans rapport", () => {
    expect(isNavItemActive("/equipes", "/contacts")).toBe(false);
  });
});
