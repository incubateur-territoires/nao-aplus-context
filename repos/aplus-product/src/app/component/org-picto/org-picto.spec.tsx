import { render, screen } from "@testing-library/react";
import { OrgPicto, getOrgPictoConfig } from "./org-picto";

describe("getOrgPictoConfig", () => {
  it("retourne la config exacte pour CAF", () => {
    const config = getOrgPictoConfig("CAF");
    expect(config.label).toBe("CAF");
    expect(config.bgColor).toBe("#3558a2");
    expect(config.fontSize).toBe("16px");
  });

  it("est insensible à la casse", () => {
    expect(getOrgPictoConfig("caf")).toEqual(getOrgPictoConfig("CAF"));
    expect(getOrgPictoConfig("Maison France Services")).toEqual(
      getOrgPictoConfig("maison france services"),
    );
  });

  it("retourne la config pour Maison France Services", () => {
    const config = getOrgPictoConfig("Maison France Services");
    expect(config.label).toBe("FS");
    expect(config.bgColor).toBe("#6a6156");
  });

  it("retourne un fallback pour une org inconnue", () => {
    const config = getOrgPictoConfig("Organisation Inconnue");
    expect(config.label).toBe("ORG");
    expect(config.bgColor).toBe("#6a6156");
    expect(config.fontSize).toBe("12px");
  });

  it("tronque à 3 caractères pour le fallback", () => {
    const config = getOrgPictoConfig("AB");
    expect(config.label).toBe("AB");
  });
});

describe("OrgPicto", () => {
  it("rend le label CAF", () => {
    render(<OrgPicto orgName="CAF" />);
    expect(screen.getByText("CAF")).toBeInTheDocument();
  });

  it("rend le label FS pour Maison France Services", () => {
    render(<OrgPicto orgName="Maison France Services" />);
    expect(screen.getByText("FS")).toBeInTheDocument();
  });

  it("a aria-hidden pour ne pas polluer l'arbre d'accessibilité", () => {
    const { container } = render(<OrgPicto orgName="CAF" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("applique la className optionnelle", () => {
    const { container } = render(<OrgPicto orgName="CAF" className="mt-2" />);
    expect(container.firstChild).toHaveClass("mt-2");
  });

  it("rend un fallback pour une org inconnue", () => {
    render(<OrgPicto orgName="XYZ inconnu" />);
    expect(screen.getByText("XYZ")).toBeInTheDocument();
  });
});
