import { render, screen, fireEvent } from "@testing-library/react";
import { ReportsTableSearch } from "./reports-table-search";
import { createMockFunctions } from "@/test/mocks";

describe("ReportsTableSearch", () => {
  const mockFunctions = createMockFunctions();
  const mockSetSearchQuery = mockFunctions.setSearchQuery;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders search input with label", () => {
    render(
      <ReportsTableSearch searchQuery="" setSearchQuery={mockSetSearchQuery} />,
    );

    expect(screen.getByText("Rechercher")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Rechercher un citoyen, un sujet..."),
    ).toBeInTheDocument();
  });

  it("displays current search query value", () => {
    render(
      <ReportsTableSearch
        searchQuery="test query"
        setSearchQuery={mockSetSearchQuery}
      />,
    );

    const input = screen.getByPlaceholderText(
      "Rechercher un citoyen, un sujet...",
    );
    expect(input).toHaveValue("test query");
  });

  it("calls setSearchQuery when input changes", () => {
    render(
      <ReportsTableSearch searchQuery="" setSearchQuery={mockSetSearchQuery} />,
    );

    const input = screen.getByPlaceholderText(
      "Rechercher un citoyen, un sujet...",
    );
    fireEvent.change(input, { target: { value: "new search" } });

    expect(mockSetSearchQuery).toHaveBeenCalledWith("new search");
  });

  it("renders search icon addon", () => {
    const { container } = render(
      <ReportsTableSearch searchQuery="" setSearchQuery={mockSetSearchQuery} />,
    );

    const icon = container.querySelector(".fr-icon-search-line");
    expect(icon).toBeInTheDocument();
  });
});
