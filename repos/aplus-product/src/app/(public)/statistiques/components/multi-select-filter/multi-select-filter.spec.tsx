import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelectFilter } from "./multi-select-filter";

const OPTIONS = [
  { id: "a", name: "Aisne" },
  { id: "b", name: "Oise" },
];

describe("MultiSelectFilter", () => {
  it("notifie la sélection d'une option", async () => {
    const onChange = jest.fn();
    render(
      <MultiSelectFilter
        label="Département(s)"
        placeholder="Tous les territoires"
        options={OPTIONS}
        selectedIds={[]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByPlaceholderText("Tous les territoires"));
    await userEvent.click(screen.getByRole("option", { name: "Oise" }));

    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("conserve la recherche saisie après avoir coché une option", async () => {
    render(
      <MultiSelectFilter
        label="Département(s)"
        placeholder="Tous les territoires"
        options={OPTIONS}
        selectedIds={[]}
        onChange={jest.fn()}
      />,
    );

    const field = screen.getByPlaceholderText("Tous les territoires");
    await userEvent.click(field);
    await userEvent.type(field, "Ois");
    await userEvent.click(screen.getByRole("option", { name: "Oise" }));

    expect(field).toHaveValue("Ois");
  });

  it("virtualise une longue liste (rend peu de lignes, pas toutes)", async () => {
    const manyOptions = Array.from({ length: 1000 }, (_, i) => ({
      id: `id-${i}`,
      name: `Équipe ${i}`,
    }));
    render(
      <MultiSelectFilter
        label="Équipe(s)"
        placeholder="Toutes les équipes"
        options={manyOptions}
        selectedIds={[]}
        onChange={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByPlaceholderText("Toutes les équipes"));

    // Sans virtualisation, 1000+ options seraient montées. Avec, seules les
    // lignes visibles (+ overscan) sont dans le DOM.
    expect(screen.getAllByRole("option").length).toBeLessThan(50);
  });

  it("limite l'affichage à 3 tags + « +X autres » repliable", async () => {
    const opts = Array.from({ length: 6 }, (_, i) => ({
      id: `id-${i}`,
      name: `Équipe ${i}`,
    }));
    render(
      <MultiSelectFilter
        label="Équipe(s)"
        placeholder="Toutes les équipes"
        options={opts}
        selectedIds={["id-0", "id-1", "id-2", "id-3", "id-4"]}
        onChange={jest.fn()}
      />,
    );

    const selectionList = screen.getByRole("list", {
      name: "Équipe(s) — sélection",
    });
    // 3 tags visibles + le bouton.
    expect(within(selectionList).getByText("Équipe 0")).toBeInTheDocument();
    expect(within(selectionList).getByText("Équipe 2")).toBeInTheDocument();
    expect(
      within(selectionList).queryByText("Équipe 3"),
    ).not.toBeInTheDocument();

    const toggle = within(selectionList).getByRole("button", {
      name: "+2 autres",
    });
    await userEvent.click(toggle);

    expect(within(selectionList).getByText("Équipe 3")).toBeInTheDocument();
    expect(within(selectionList).getByText("Équipe 4")).toBeInTheDocument();
    expect(
      within(selectionList).getByRole("button", { name: "Voir moins" }),
    ).toBeInTheDocument();
  });

  it("affiche un tag par sélection et permet de le retirer", async () => {
    const onChange = jest.fn();
    render(
      <MultiSelectFilter
        label="Département(s)"
        placeholder="Tous les territoires"
        options={OPTIONS}
        selectedIds={["a", "b"]}
        onChange={onChange}
      />,
    );

    // Un tag dismissible par sélection (le nom apparaît aussi dans la liste).
    expect(screen.getAllByText("Aisne").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /Aisne/i }));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("affiche « Aucun résultat » quand le filtrage ne laisse aucune option", async () => {
    render(
      <MultiSelectFilter
        label="Département(s)"
        placeholder="Tous les territoires"
        options={[]}
        selectedIds={[]}
        onChange={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByPlaceholderText("Tous les territoires"));

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
  });
});
