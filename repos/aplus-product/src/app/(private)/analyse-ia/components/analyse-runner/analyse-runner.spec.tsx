import { fireEvent, render, screen } from "@testing-library/react";
import { AnalyseRunner } from "./analyse-runner";

const STORED_ITEMS = [
  {
    id: "1",
    subject: "Sujet A",
    summary: "Résumé A",
    tags: [{ axis: "organisme", label: "caf" }],
    guardOk: true,
  },
  {
    id: "2",
    subject: "Sujet B",
    summary: "Résumé B",
    tags: [{ axis: "organisme", label: "cpam" }],
    guardOk: true,
  },
];

describe("AnalyseRunner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("affiche le champ de nombre et le bouton de lancement", () => {
    render(<AnalyseRunner />);

    expect(
      screen.getByRole("button", { name: "Lancer l'analyse" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Signalements à analyser/),
    ).toBeInTheDocument();
  });

  it("filtre les résultats au clic sur un tag, puis se réinitialise", () => {
    localStorage.setItem("analyse-ia-items", JSON.stringify(STORED_ITEMS));
    render(<AnalyseRunner />);

    expect(screen.getByText("Sujet A")).toBeInTheDocument();
    expect(screen.getByText("Sujet B")).toBeInTheDocument();

    // Clic sur le tag agrégé « caf · 1 » → seul le signalement CAF reste.
    fireEvent.click(screen.getByRole("button", { name: "caf · 1" }));
    expect(screen.getByText("Sujet A")).toBeInTheDocument();
    expect(screen.queryByText("Sujet B")).not.toBeInTheDocument();
    expect(screen.getByText("Résultats (1 / 2)")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Réinitialiser le filtre" }),
    );
    expect(screen.getByText("Sujet B")).toBeInTheDocument();
    expect(screen.getByText("Résultats (2)")).toBeInTheDocument();
  });

  it("démarre vide : 0 analysé, ni tags ni résultats, pas de bouton Vider", () => {
    render(<AnalyseRunner />);

    expect(screen.getByRole("status")).toHaveTextContent("Déjà analysés : 0");
    expect(screen.queryByText(/Tags émergents/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Résultats/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Vider" }),
    ).not.toBeInTheDocument();
  });
});
