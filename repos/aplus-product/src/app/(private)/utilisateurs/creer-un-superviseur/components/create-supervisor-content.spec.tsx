import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateSupervisorContent } from "./create-supervisor-content";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMockArea, createMockOrganization } from "@/test/mocks";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const mockAreas = [
  createMockArea({ id: "area-1", name: "Pas-de-Calais" }),
  createMockArea({ id: "area-2", name: "Nord" }),
];

const mockOrganizations = [
  createMockOrganization({
    id: "org-caf",
    name: "Caisse d'Allocations Familiales",
    shortName: "CAF",
  }),
  createMockOrganization({
    id: "org-ft",
    name: "France Travail",
    shortName: "France Travail",
  }),
  createMockOrganization({
    id: "org-dgfip",
    name: "Direction Générale des Finances Publiques",
    shortName: "DGFIP",
  }),
];

const mockMutateAsync = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn((options) => {
    const queryKey = JSON.stringify(options?.queryKey);
    if (queryKey?.includes("area")) {
      return { data: mockAreas, isLoading: false };
    }
    if (queryKey?.includes("organization")) {
      return { data: mockOrganizations, isLoading: false };
    }
    return { data: [], isLoading: false };
  }),
  useMutation: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(() => ({
    area: {
      getAreas: {
        queryOptions: () => ({ queryKey: ["area"] }),
      },
    },
    organization: {
      getOrganizations: {
        queryOptions: () => ({ queryKey: ["organization"] }),
      },
    },
    supervisor: {
      createSupervisor: {
        mutationOptions: jest.fn(() => ({})),
      },
    },
  })),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("CreateSupervisorContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render the email input", () => {
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    expect(screen.getByText("Adresse e-mail")).toBeInTheDocument();
  });

  it("should render territory and organization labels", () => {
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const labels = screen.getAllByText("Superviseur de territoire");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    const orgLabels = screen.getAllByText("Superviseur d'organisation");
    expect(orgLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("should render the submit button", () => {
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    expect(
      screen.getByRole("button", { name: /créer le superviseur/i }),
    ).toBeInTheDocument();
  });

  it("should display organization name with shortName when they differ", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const orgInput = screen.getByPlaceholderText(
      "Choisissez une ou plusieurs organisations",
    );
    await user.click(orgInput);

    const listbox = screen.getByRole("listbox");
    expect(
      within(listbox).getByText("Caisse d'Allocations Familiales"),
    ).toBeInTheDocument();
    expect(within(listbox).getByText("(CAF)")).toBeInTheDocument();
    expect(
      within(listbox).getByText("Direction Générale des Finances Publiques"),
    ).toBeInTheDocument();
    expect(within(listbox).getByText("(DGFIP)")).toBeInTheDocument();
  });

  it("should not display shortName when it equals the name", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const orgInput = screen.getByPlaceholderText(
      "Choisissez une ou plusieurs organisations",
    );
    await user.click(orgInput);

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("France Travail")).toBeInTheDocument();
    // Should NOT have a "(France Travail)" span
    expect(
      within(listbox).queryByText("(France Travail)"),
    ).not.toBeInTheDocument();
  });

  it("should display area options in territory autocomplete", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const areaInput = screen.getByPlaceholderText(
      "Choisissez un ou plusieurs départements",
    );
    await user.click(areaInput);

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Pas-de-Calais")).toBeInTheDocument();
    expect(within(listbox).getByText("Nord")).toBeInTheDocument();
  });

  it("should show selected organization as tag with shortName", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const orgInput = screen.getByPlaceholderText(
      "Choisissez une ou plusieurs organisations",
    );
    await user.click(orgInput);

    const listbox = screen.getByRole("listbox");
    const cafOption = within(listbox).getByText(
      "Caisse d'Allocations Familiales",
    );
    await user.click(cafOption);

    // Tag should display "name (shortName)"
    expect(
      screen.getByText("Caisse d'Allocations Familiales (CAF)"),
    ).toBeInTheDocument();
  });

  it("should display 'Tout sélectionner' option in area dropdown", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const areaInput = screen.getByPlaceholderText(
      "Choisissez un ou plusieurs départements",
    );
    await user.click(areaInput);

    expect(screen.getByText("Tout sélectionner")).toBeInTheDocument();
  });

  it("should select all areas when clicking 'Tout sélectionner'", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const areaInput = screen.getByPlaceholderText(
      "Choisissez un ou plusieurs départements",
    );
    await user.click(areaInput);
    await user.click(screen.getByText("Tout sélectionner"));

    // Both areas should appear as dismissible tags
    const tags = screen.getAllByRole("button", { name: /Pas-de-Calais|Nord/ });
    const dismissibleTags = tags.filter((tag) =>
      tag.classList.contains("fr-tag--dismiss"),
    );
    expect(dismissibleTags).toHaveLength(2);
  });

  it("should display 'Tout sélectionner' option in organization dropdown", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const orgInput = screen.getByPlaceholderText(
      "Choisissez une ou plusieurs organisations",
    );
    await user.click(orgInput);

    expect(screen.getByText("Tout sélectionner")).toBeInTheDocument();
  });

  it("should select all organizations when clicking 'Tout sélectionner'", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const orgInput = screen.getByPlaceholderText(
      "Choisissez une ou plusieurs organisations",
    );
    await user.click(orgInput);
    await user.click(screen.getByText("Tout sélectionner"));

    // All organizations should appear as dismissible tags
    const tags = screen
      .getAllByRole("button")
      .filter((tag) => tag.classList.contains("fr-tag--dismiss"));
    expect(tags).toHaveLength(3);
  });

  it("should show validation errors when submitting empty form", async () => {
    const user = userEvent.setup();
    render(<CreateSupervisorContent />, { wrapper: createWrapper() });

    const submitButton = screen.getByRole("button", {
      name: /créer le superviseur/i,
    });
    await user.click(submitButton);

    expect(
      await screen.findByText("Adresse e-mail invalide"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Veuillez sélectionner au moins un département"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Veuillez sélectionner au moins une organisation"),
    ).toBeInTheDocument();

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
