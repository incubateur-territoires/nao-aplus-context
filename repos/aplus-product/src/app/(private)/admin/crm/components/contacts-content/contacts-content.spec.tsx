import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockUseSearchParams, mockUseRouter } from "@/test/utils/global-mocks";
import { ContactsContent } from "./contacts-content";

const mockContacts = [
  {
    id: "contact-1",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
    firstName: "Camille",
    lastName: "Durand",
    email: "camille.durand@example.com",
    address: "12 rue des Lilas",
    areaId: "area-1",
    area: { id: "area-1", name: "Pas-de-Calais" },
    organizationId: "org-1",
    organization: {
      id: "org-1",
      name: "Caisse d'Allocations Familiales",
      shortName: "CAF",
    },
    deletedAt: null,
  },
  {
    id: "contact-2",
    createdAt: new Date("2024-02-20T10:00:00Z"),
    updatedAt: new Date("2024-02-20T10:00:00Z"),
    firstName: "Alex",
    lastName: "Martel",
    email: "alex.martel@example.com",
    address: null,
    areaId: null,
    area: null,
    organizationId: null,
    organization: null,
    deletedAt: null,
  },
];

let mockContactsData: {
  items: typeof mockContacts;
  total: number;
  totalPages: number;
} = { items: mockContacts, total: 2, totalPages: 1 };

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(() => ({ data: mockContactsData, isLoading: false })),
  keepPreviousData: {},
}));

const mockGetContactsQueryOptions = jest.fn(() => ({
  queryKey: ["getContacts"],
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(() => ({
    crm: {
      getContacts: {
        queryOptions: mockGetContactsQueryOptions,
        queryKey: () => ["getContacts"],
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

describe("ContactsContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContactsData = { items: mockContacts, total: 2, totalPages: 1 };
  });

  it("affiche le champ de recherche", () => {
    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(
      screen.getByPlaceholderText("Rechercher un nom, une adresse e-mail..."),
    ).toBeInTheDocument();
  });

  it("affiche les contacts et leurs rattachements", () => {
    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(screen.getByText("Camille Durand")).toBeInTheDocument();
    expect(screen.getByText("alex.martel@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("Caisse d'Allocations Familiales (CAF)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pas-de-Calais")).toBeInTheDocument();
  });

  it("affiche le message de liste vide", () => {
    mockContactsData = { items: [], total: 0, totalPages: 0 };

    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(
      screen.getByText(
        "Aucun contact ne correspond à vos critères de recherche.",
      ),
    ).toBeInTheDocument();
  });

  it("propose le bouton d'ajout d'un contact", () => {
    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(
      screen.getByRole("link", { name: /ajouter un contact/i }),
    ).toHaveAttribute("href", "/admin/crm/creer");
  });

  it("interroge la première page triée par nom au montage", () => {
    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(mockGetContactsQueryOptions).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      search: undefined,
      sortBy: "name",
      sortOrder: "asc",
    });
  });

  it("transmet la page et le tri lus dans l'URL à la requête", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("c_page=2&c_sort=email&c_order=desc"),
    );

    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(mockGetContactsQueryOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        sortBy: "email",
        sortOrder: "desc",
      }),
    );
  });

  it("restaure la recherche depuis l'URL et la transmet à la requête", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("c_q=Durand"));

    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(
      screen.getByPlaceholderText("Rechercher un nom, une adresse e-mail..."),
    ).toHaveValue("Durand");
    expect(mockGetContactsQueryOptions).toHaveBeenCalledWith(
      expect.objectContaining({ search: "Durand" }),
    );
  });

  it("écrit la recherche dans l'URL après le debounce", async () => {
    const replaceSpy = jest.fn();
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      replace: replaceSpy,
      prefetch: jest.fn(),
    });
    const user = userEvent.setup();

    render(<ContactsContent />, { wrapper: createWrapper() });

    await user.type(
      screen.getByPlaceholderText("Rechercher un nom, une adresse e-mail..."),
      "Durand",
    );

    await waitFor(() => {
      const lastCall = replaceSpy.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("c_q=Durand");
    });
  });

  it("masque la pagination quand il n'y a qu'une page", () => {
    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("affiche la pagination au-delà d'une page", () => {
    mockContactsData = { items: mockContacts, total: 24, totalPages: 3 };

    render(<ContactsContent />, { wrapper: createWrapper() });

    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
  });
});
