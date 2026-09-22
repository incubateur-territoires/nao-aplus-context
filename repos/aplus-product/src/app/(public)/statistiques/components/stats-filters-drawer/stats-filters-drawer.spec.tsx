import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatsFiltersDrawer } from "./stats-filters-drawer";

const OPTIONS = {
  areas: [{ id: "area-1", name: "Aisne" }],
  authorOrganizations: [],
  authorTeams: [],
  requestedOrganizations: [],
  requestedTeams: [],
};

const BASE_PROPS = {
  open: true,
  onClose: jest.fn(),
  filters: {},
  options: OPTIONS,
  onChange: jest.fn(),
};

describe("StatsFiltersDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ne rend rien quand il est fermé", () => {
    render(<StatsFiltersDrawer {...BASE_PROPS} open={false} />);
    expect(
      screen.queryByRole("heading", { name: "Filtrer les statistiques" }),
    ).not.toBeInTheDocument();
  });

  it("affiche le titre et le texte d'explication des filtres liés", () => {
    render(<StatsFiltersDrawer {...BASE_PROPS} />);

    expect(
      screen.getByRole("heading", { name: "Filtrer les statistiques" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Les filtres se mettent à jour automatiquement/),
    ).toBeInTheDocument();
  });

  it("ferme le tiroir depuis « Fermer le panneau »", async () => {
    const onClose = jest.fn();
    render(<StatsFiltersDrawer {...BASE_PROPS} onClose={onClose} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Fermer le panneau/i }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("désactive la réinitialisation quand aucun filtre n'est actif", () => {
    render(<StatsFiltersDrawer {...BASE_PROPS} />);
    expect(
      screen.getByRole("button", { name: /Réinitialiser tous les filtres/i }),
    ).toBeDisabled();
  });

  it("réinitialise tous les filtres", async () => {
    const onChange = jest.fn();
    render(
      <StatsFiltersDrawer
        {...BASE_PROPS}
        filters={{ areaIds: ["area-1"] }}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Réinitialiser tous les filtres/i }),
    );

    expect(onChange).toHaveBeenCalledWith({});
  });
});
