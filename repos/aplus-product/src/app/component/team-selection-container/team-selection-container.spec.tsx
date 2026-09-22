import { render, screen } from "@testing-library/react";
import { TeamSelectionContainer } from "./team-selection-container";

describe("TeamSelectionContainer", () => {
  const mockTags = [
    { label: "Social & Santé", value: "tag1" },
    { label: "Travail & Formation", value: "tag2" },
  ];
  const mockSetSelectedFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the heading", () => {
    render(
      <TeamSelectionContainer
        tags={mockTags}
        selectedFilters={[]}
        setSelectedFilters={mockSetSelectedFilters}
        isLoading={false}
      >
        <div>Test children</div>
      </TeamSelectionContainer>,
    );

    expect(
      screen.getByText("Équipe(s) opérateur à contacter"),
    ).toBeInTheDocument();
  });

  it("renders filters component", () => {
    render(
      <TeamSelectionContainer
        tags={mockTags}
        selectedFilters={[]}
        setSelectedFilters={mockSetSelectedFilters}
        isLoading={false}
      >
        <div>Test children</div>
      </TeamSelectionContainer>,
    );

    expect(screen.getByText("Filtrer par :")).toBeInTheDocument();
  });

  it("renders children when not loading", () => {
    render(
      <TeamSelectionContainer
        tags={mockTags}
        selectedFilters={[]}
        setSelectedFilters={mockSetSelectedFilters}
        isLoading={false}
      >
        <div data-testid="test-children">Test children content</div>
      </TeamSelectionContainer>,
    );

    expect(screen.getByTestId("test-children")).toBeInTheDocument();
    expect(screen.getByText("Test children content")).toBeInTheDocument();
  });

  it("renders spinner when loading", () => {
    render(
      <TeamSelectionContainer
        tags={mockTags}
        selectedFilters={[]}
        setSelectedFilters={mockSetSelectedFilters}
        isLoading={true}
      >
        <div data-testid="test-children">Test children</div>
      </TeamSelectionContainer>,
    );

    // Spinner should be visible
    expect(screen.getByTestId("spinner")).toBeInTheDocument();

    // Children should not be rendered when loading
    expect(screen.queryByTestId("test-children")).not.toBeInTheDocument();
  });

  it("applies correct styling classes", () => {
    const { container } = render(
      <TeamSelectionContainer
        tags={mockTags}
        selectedFilters={[]}
        setSelectedFilters={mockSetSelectedFilters}
        isLoading={false}
      >
        <div>Test children</div>
      </TeamSelectionContainer>,
    );

    // Check for blue background wrapper
    const blueBackground = container.querySelector(".bg-blue-background");
    expect(blueBackground).toBeInTheDocument();
    expect(blueBackground).toHaveClass("p-4", "md:p-10", "mt-4");
  });

  it("passes selected filters to Filters component", () => {
    const selectedFilters = ["tag1"];

    render(
      <TeamSelectionContainer
        tags={mockTags}
        selectedFilters={selectedFilters}
        setSelectedFilters={mockSetSelectedFilters}
        isLoading={false}
      >
        <div>Test children</div>
      </TeamSelectionContainer>,
    );

    // Filter tags should be rendered
    expect(screen.getByText("Social & Santé")).toBeInTheDocument();
    expect(screen.getByText("Travail & Formation")).toBeInTheDocument();
  });

  it("renders with empty tags array", () => {
    render(
      <TeamSelectionContainer
        tags={[]}
        selectedFilters={[]}
        setSelectedFilters={mockSetSelectedFilters}
        isLoading={false}
      >
        <div>Test children</div>
      </TeamSelectionContainer>,
    );

    expect(
      screen.getByText("Équipe(s) opérateur à contacter"),
    ).toBeInTheDocument();
    expect(screen.getByText("Test children")).toBeInTheDocument();
  });
});
