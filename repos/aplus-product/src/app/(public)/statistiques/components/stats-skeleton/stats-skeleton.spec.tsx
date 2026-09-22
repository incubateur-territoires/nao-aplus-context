import { render, screen } from "@testing-library/react";
import { StatsSkeleton } from "./stats-skeleton";

describe("StatsSkeleton", () => {
  it("annonce le chargement aux lecteurs d'écran", () => {
    render(<StatsSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Chargement des statistiques…",
    );
  });

  it("affiche une carte fantôme par graphique, masquée aux lecteurs d'écran", () => {
    const { container } = render(<StatsSkeleton count={3} />);

    const cards = container.querySelectorAll("section[aria-hidden='true']");
    expect(cards).toHaveLength(3);
  });
});
