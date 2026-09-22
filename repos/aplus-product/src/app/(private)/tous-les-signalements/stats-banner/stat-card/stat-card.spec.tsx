import { render, screen, fireEvent } from "@testing-library/react";
import { StatCard } from "./stat-card";

describe("StatCard", () => {
  it("affiche la valeur et le label", () => {
    render(<StatCard value={5} label="en cours de traitement" />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("en cours de traitement")).toBeInTheDocument();
  });

  it("chiffre noir quand la valeur est 0", () => {
    render(<StatCard value={0} label="en attente de prise en charge" />);
    expect(screen.getByText("0")).toHaveStyle({ color: "#161616" });
  });

  it("chiffre bleu quand la valeur est différente de 0 (variant défaut)", () => {
    render(<StatCard value={3} label="en cours de traitement" />);
    expect(screen.getByText("3")).toHaveStyle({ color: "#000091" });
  });

  it("chiffre rouge quand la valeur est différente de 0 pour le variant overdue", () => {
    render(<StatCard value={2} label="en souffrance" variant="overdue" />);
    expect(screen.getByText("2")).toHaveStyle({ color: "#CE0500" });
  });

  it("chiffre noir quand la valeur est 0 même pour le variant overdue", () => {
    render(<StatCard value={0} label="en souffrance" variant="overdue" />);
    expect(screen.getByText("0")).toHaveStyle({ color: "#161616" });
  });

  it("rend un bouton cliquable quand onClick est fourni", () => {
    const onClick = jest.fn();
    render(<StatCard value={1} label="en souffrance" onClick={onClick} />);
    const button = screen.getByRole("button", { name: /en souffrance/i });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ne rend pas de bouton lorsque onClick est absent", () => {
    render(<StatCard value={1} label="traités" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
