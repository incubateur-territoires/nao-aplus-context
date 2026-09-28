import { render, screen } from "@testing-library/react";
import type {
  ClosedTaxonomyReport,
  ItemProjection,
} from "@/utils/golden-dataset-taxonomy";
import { GoldenDatasetClosedTaxonomy } from "./golden-dataset-closed-taxonomy";

const FREEZE_ACTION = "Figer la v1";

function report(
  overrides: Partial<ClosedTaxonomyReport> = {},
): ClosedTaxonomyReport {
  return {
    version: 1,
    items: new Map<number, ItemProjection>(),
    corpus: { ok: true },
    distribution: {
      blockageTag: [{ tag: "retard", count: 4, belowMinimum: false }],
      procedureTag: [{ tag: "RSA", count: 2, belowMinimum: true }],
    },
    frozenRows: 0,
    ...overrides,
  };
}

function renderSection(overrides: Partial<ClosedTaxonomyReport> = {}) {
  render(
    <GoldenDatasetClosedTaxonomy
      report={report(overrides)}
      total={100}
      isFreezing={false}
      freezeError={null}
      onFreeze={jest.fn()}
    />,
  );
}

describe("GoldenDatasetClosedTaxonomy", () => {
  it("active le gel quand tout le corpus se projette", () => {
    renderSection();

    expect(screen.getByRole("button", { name: FREEZE_ACTION })).toBeEnabled();
  });

  it("désactive le gel tant qu'un axe n'est pas adjugé", () => {
    renderSection({
      corpus: { ok: false, unmapped: [], unadjudicated: [7, 9] },
    });

    expect(
      screen.getByText(/Signalements non adjugés : 7, 9/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: FREEZE_ACTION })).toBeDisabled();
  });

  it("liste les labels sans entrée avec leurs positions et désactive le gel", () => {
    renderSection({
      corpus: {
        ok: false,
        unmapped: [
          { axis: "blockageTag", fineLabel: "retard cpam", positions: [3, 8] },
        ],
        unadjudicated: [],
      },
    });

    expect(
      screen.getByText("« retard cpam » (Blocage) : signalements 3, 8"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: FREEZE_ACTION })).toBeDisabled();
  });

  it("désactive le gel quand la version est déjà figée", () => {
    renderSection({ frozenRows: 100 });

    expect(screen.getByText(/Figée : 100\/100/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: FREEZE_ACTION })).toBeDisabled();
  });

  it("marque les tags sous la barre de mesure", () => {
    renderSection();

    const rsa = screen.getByText("RSA").closest("li") as HTMLElement;

    expect(rsa).toHaveTextContent("moins de 3");
  });

  it("signale les signalements qui ont dérivé depuis le gel", () => {
    renderSection({
      frozenRows: 1,
      items: new Map<number, ItemProjection>([
        [
          4,
          {
            position: 4,
            derived: {
              blockageTag: { kind: "unadjudicated" },
              procedureTag: { kind: "unadjudicated" },
            },
            stored: {
              taxonomyVersion: 1,
              blockageTag: "retard",
              procedureTag: "RSA",
            },
            driftedAxes: ["blockageTag"],
          },
        ],
      ]),
    });

    expect(
      screen.getByText(/1 signalement\(s\) ont dérivé depuis le gel/),
    ).toBeInTheDocument();
  });
});
