import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatEmptyState } from "./stat-empty-state";

describe("StatEmptyState", () => {
  it("affiche le message d'absence de résultat", () => {
    render(<StatEmptyState />);
    expect(
      screen.getByText(
        "Aucun signalement ne correspond à vos critères de filtrages.",
      ),
    ).toBeInTheDocument();
  });

  it("n'affiche pas le lien de modification sans callback", () => {
    render(<StatEmptyState />);
    expect(
      screen.queryByRole("button", { name: /Modifier les filtres/i }),
    ).not.toBeInTheDocument();
  });

  it("déclenche l'ouverture du tiroir depuis « Modifier les filtres »", async () => {
    const onOpenFilters = jest.fn();
    render(<StatEmptyState onOpenFilters={onOpenFilters} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Modifier les filtres/i }),
    );

    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it("annonce le message aux lecteurs d'écran", () => {
    render(<StatEmptyState />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Aucun signalement ne correspond à vos critères de filtrages.",
    );
  });

  it("distingue le bouton par le titre du bloc", () => {
    render(
      <StatEmptyState
        contextLabel="Délais de prise en charge"
        onOpenFilters={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Modifier les filtres (Délais de prise en charge)",
      }),
    ).toBeInTheDocument();
  });
});
