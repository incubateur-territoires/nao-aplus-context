import { fireEvent, render, screen } from "@testing-library/react";
import type { FreeTag } from "@/lib/ai/tag-axes";
import { buildMatrix, pairKey, TagMatrix } from "./tag-matrix";

function item(tags: FreeTag[]) {
  return { tags };
}

const ITEMS = [
  item([
    { axis: "organisme", label: "caf" },
    { axis: "blocage", label: "absence de réponse" },
  ]),
  item([
    { axis: "organisme", label: "caf" },
    { axis: "blocage", label: "absence de réponse" },
  ]),
  item([
    { axis: "organisme", label: "carsat" },
    { axis: "blocage", label: "trimestres manquants" },
  ]),
  // Sans blocage : exclu de la matrice.
  item([{ axis: "organisme", label: "cpam" }]),
];

describe("buildMatrix", () => {
  it("compte les paires, trie par fréquence et écarte les items incomplets", () => {
    const matrix = buildMatrix(ITEMS);

    expect(matrix.organismes).toEqual(["caf", "carsat"]);
    expect(matrix.blocages).toEqual([
      "absence de réponse",
      "trimestres manquants",
    ]);
    expect(matrix.counts.get(pairKey("caf", "absence de réponse"))).toBe(2);
    expect(matrix.counts.get(pairKey("carsat", "absence de réponse"))).toBe(
      undefined,
    );
    expect(matrix.rowTotals.get("caf")).toBe(2);
    expect(matrix.excluded).toBe(1);
  });
});

describe("TagMatrix", () => {
  it("ne rend rien sans paire complète", () => {
    const { container } = render(
      <TagMatrix
        items={[item([{ axis: "organisme", label: "cpam" }])]}
        filters={[]}
        onSelectPair={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("rend les cellules cliquables et remonte la paire sélectionnée", () => {
    const onSelectPair = jest.fn();
    render(
      <TagMatrix items={ITEMS} filters={[]} onSelectPair={onSelectPair} />,
    );

    expect(
      screen.getByText("Croisement organisme × blocage"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 signalement hors matrice", { exact: false }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "caf × absence de réponse : 2 signalements",
      }),
    );
    expect(onSelectPair).toHaveBeenCalledWith(
      { axis: "organisme", label: "caf" },
      { axis: "blocage", label: "absence de réponse" },
    );
  });
});
