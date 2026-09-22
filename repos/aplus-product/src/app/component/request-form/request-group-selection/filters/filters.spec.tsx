import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Filters } from "./filters";

describe("Filters", () => {
  const mockTags = [
    { value: "social-sante", label: "Social - santé" },
    { value: "travail-formation", label: "Travail - formation" },
    { value: "logement", label: "Logement" },
  ];

  const setup = (selectedFilters: string[] = []) => {
    const setSelectedFilters = jest.fn();
    render(
      <Filters
        tags={mockTags}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />,
    );
    return { setSelectedFilters };
  };

  it("renders all filter tags", () => {
    setup();
    expect(screen.getByText("Social - santé")).toBeInTheDocument();
    expect(screen.getByText("Travail - formation")).toBeInTheDocument();
    expect(screen.getByText("Logement")).toBeInTheDocument();
  });

  it("toggles filter selection", async () => {
    const user = userEvent.setup();
    const { setSelectedFilters } = setup([]);
    const tag = screen.getByText("Social - santé");
    await user.click(tag);
    expect(setSelectedFilters).toHaveBeenCalledWith(["social-sante"]);
  });

  it("removes filter if already selected", async () => {
    const user = userEvent.setup();
    const { setSelectedFilters } = setup(["social-sante"]);
    const tag = screen.getByText("Social - santé");
    await user.click(tag);
    expect(setSelectedFilters).toHaveBeenCalledWith([]);
  });

  it("shows reset when filters are selected and resets on click", async () => {
    const user = userEvent.setup();
    const { setSelectedFilters } = setup(["social-sante"]);
    const reset = screen.getByText("Réinitialiser les filtres");
    expect(reset).toBeVisible();
    await user.click(reset);
    expect(setSelectedFilters).toHaveBeenCalledWith([]);
  });

  it("hides reset when no filters selected", () => {
    setup([]);
    expect(screen.getByText("Réinitialiser les filtres")).toHaveClass(
      "!hidden",
    );
  });

  it("Tag pressed state reflects selectedFilters", () => {
    setup(["social-sante"]);
    const tag = screen.getByText("Social - santé");
    expect(tag.closest("button")).toHaveAttribute("aria-pressed", "true");
  });
});
