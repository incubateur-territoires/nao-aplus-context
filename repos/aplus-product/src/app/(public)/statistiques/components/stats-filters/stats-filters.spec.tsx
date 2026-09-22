import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StatsFilters as StatsFiltersValues } from "@/trpc/routers/stats";
import { StatsFilters, type StatsFilterOptions } from "./stats-filters";

const OPTIONS: StatsFilterOptions = {
  areas: [
    { id: "area-1", name: "Aisne" },
    { id: "area-2", name: "Oise" },
    { id: "area-3", name: "Somme" },
  ],
  authorOrganizations: [{ id: "org-1", name: "France Services" }],
  authorTeams: [{ id: "team-1", name: "FS Laon" }],
  requestedOrganizations: [{ id: "org-2", name: "CAF" }],
  requestedTeams: [{ id: "team-2", name: "CAF 02" }],
};

/**
 * Le composant est contrôlé : le parent applique aussitôt les filtres. On simule
 * ce parent pour que les sélections successives se cumulent comme en vrai.
 */
function renderControlled(
  initialFilters: StatsFiltersValues = {},
  options: StatsFilterOptions = OPTIONS,
) {
  const onChange = jest.fn();
  function Wrapper() {
    const [filters, setFilters] = useState<StatsFiltersValues>(initialFilters);
    return (
      <StatsFilters
        filters={filters}
        options={options}
        onChange={(next) => {
          onChange(next);
          setFilters(next);
        }}
      />
    );
  }
  render(<Wrapper />);
  return { onChange };
}

describe("StatsFilters", () => {
  it("affiche tous les groupes de filtres", () => {
    renderControlled();
    expect(screen.getByRole("group", { name: "Période" })).toBeInTheDocument();
    // « Territoire » n'a pas de `fieldset` : famille à champ unique, dont le
    // label tient lieu de titre. Il ne doit apparaître qu'une seule fois.
    expect(screen.getAllByText("Territoire")).toHaveLength(1);
    expect(
      screen.getByRole("group", { name: "Auteur des signalements" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Destinataire des signalements" }),
    ).toBeInTheDocument();
  });

  it("applique la sélection dès qu'un territoire est coché (pas de bouton de validation)", async () => {
    const { onChange } = renderControlled();

    expect(
      screen.queryByRole("button", { name: /Mettre à jour les statistiques/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByPlaceholderText("Choisissez un département"),
    );
    await userEvent.click(screen.getByRole("option", { name: "Aisne" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ areaIds: ["area-1"] }),
    );

    await userEvent.click(screen.getByRole("option", { name: "Oise" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ areaIds: ["area-1", "area-2"] }),
    );
  });

  it("« Tout sélectionner » envoie tous les ids affichés (pas de collapse vers undefined)", async () => {
    const { onChange } = renderControlled();

    await userEvent.click(
      screen.getByPlaceholderText("Choisissez un département"),
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Tout sélectionner" }),
    );

    // Avec le filtrage à facettes, on n'interprète plus « tout coché » comme
    // « aucun filtre » (sinon plusieurs dimensions à une seule option s'annulent
    // simultanément → total non filtré). On envoie la sélection explicite.
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ areaIds: ["area-1", "area-2", "area-3"] }),
    );
  });

  it("désélectionner le dernier territoire renvoie undefined (aucun filtre)", async () => {
    const { onChange } = renderControlled({ areaIds: ["area-1"] });

    await userEvent.click(
      screen.getByRole("button", { name: /Retirer Aisne/i }),
    );

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ areaIds: undefined }),
    );
  });

  it("n'affiche pas « Effacer la période » tant qu'aucune date n'est saisie", () => {
    renderControlled();
    expect(
      screen.queryByRole("button", { name: /Effacer la période/i }),
    ).not.toBeInTheDocument();
  });

  it("« Effacer la période » vide les deux dates et disparaît", async () => {
    renderControlled({ startDate: "2024-01-01", endDate: "2024-02-01" });

    // Le label DSFR englobe le texte d'aide (« Format : jj / mm / aaaa ») :
    // on cible donc le début du libellé accessible.
    const startInput = screen.getByLabelText(
      /^Date de début/,
    ) as HTMLInputElement;
    const endInput = screen.getByLabelText(/^Date de fin/) as HTMLInputElement;
    expect(startInput.value).toBe("2024-01-01");
    expect(endInput.value).toBe("2024-02-01");

    await userEvent.click(
      screen.getByRole("button", { name: /Effacer la période/i }),
    );

    expect(startInput.value).toBe("");
    expect(endInput.value).toBe("");
    expect(
      screen.queryByRole("button", { name: /Effacer la période/i }),
    ).not.toBeInTheDocument();
  });

  it("reflète les filtres reçus (page partagée via URL)", () => {
    renderControlled({ startDate: "2024-01-01", areaIds: ["area-1"] });

    expect(
      (screen.getByLabelText(/^Date de début/) as HTMLInputElement).value,
    ).toBe("2024-01-01");
    expect(screen.getByRole("button", { name: /Aisne/i })).toBeInTheDocument();
  });

  it("élague les sélections devenues indisponibles quand les options se restreignent", () => {
    // « area-9 » n'existe pas dans les options → il doit être retiré.
    const { onChange } = renderControlled({ areaIds: ["area-1", "area-9"] });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ areaIds: ["area-1"] }),
    );
  });

  it("annonce le recalcul des options à facettes", () => {
    render(
      <StatsFilters
        filters={{}}
        options={OPTIONS}
        onChange={jest.fn()}
        isLoadingOptions
      />,
    );

    expect(
      screen.getByText("Mise à jour des options de filtres…"),
    ).toBeInTheDocument();
  });

  it("affiche un indicateur de recalcul à côté de chaque champ", () => {
    const { rerender } = render(
      <StatsFilters filters={{}} options={OPTIONS} onChange={jest.fn()} />,
    );

    const spinners = () => screen.queryAllByTestId("spinner");

    expect(spinners()).toHaveLength(0);

    rerender(
      <StatsFilters
        filters={{}}
        options={OPTIONS}
        onChange={jest.fn()}
        isLoadingOptions
      />,
    );

    // Aucun champ n'a encore été actionné : les 2 dates et les 5 multi-selects
    // portent tous un indicateur.
    expect(spinners()).toHaveLength(7);
  });

  it("n'affiche pas d'indicateur sur le champ que l'utilisateur vient d'actionner", async () => {
    function Wrapper({ isLoadingOptions }: { isLoadingOptions: boolean }) {
      const [filters, setFilters] = useState<StatsFiltersValues>({});
      return (
        <StatsFilters
          filters={filters}
          options={OPTIONS}
          onChange={setFilters}
          isLoadingOptions={isLoadingOptions}
        />
      );
    }
    const { rerender } = render(<Wrapper isLoadingOptions={false} />);

    await userEvent.click(
      screen.getByPlaceholderText("Choisissez un département"),
    );
    await userEvent.click(screen.getByRole("option", { name: "Aisne" }));

    rerender(<Wrapper isLoadingOptions />);

    // 7 champs − le territoire, qui vient d'être actionné.
    expect(screen.queryAllByTestId("spinner")).toHaveLength(6);
  });
});
