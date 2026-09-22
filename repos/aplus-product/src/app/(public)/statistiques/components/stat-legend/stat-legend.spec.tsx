import { render, screen } from "@testing-library/react";
import { StatLegend } from "./stat-legend";

describe("StatLegend", () => {
  it("affiche un élément par libellé", () => {
    render(<StatLegend labels={["Traité (70,6 %)", "Fermé (29,4 %)"]} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Traité (70,6 %)")).toBeInTheDocument();
  });

  it("colore chaque puce avec la couleur de la série correspondante", () => {
    const { container } = render(<StatLegend labels={["A", "B"]} />);

    const swatches = container.querySelectorAll("span[aria-hidden='true']");
    expect(swatches[0]).toHaveStyle({ backgroundColor: "#5C68E5" });
    expect(swatches[1]).toHaveStyle({ backgroundColor: "#82B5F2" });
  });
});
