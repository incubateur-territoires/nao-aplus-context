import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiltersMemoryAlert } from "./filters-memory-alert";

describe("FiltersMemoryAlert", () => {
  it("affiche le titre et le rappel du marque-page", () => {
    render(<FiltersMemoryAlert />);

    expect(screen.getByText("Mémoire des filtres")).toBeInTheDocument();
    expect(screen.getByText("Marque-page")).toBeInTheDocument();
  });

  it("se ferme définitivement au clic sur la croix", async () => {
    render(<FiltersMemoryAlert />);

    await userEvent.click(screen.getByRole("button", { name: /Masquer/i }));

    expect(screen.queryByText("Mémoire des filtres")).not.toBeInTheDocument();
  });
});
