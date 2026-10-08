import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import type { AppRouter } from "@/trpc/routers/_app";
import { ContactDetail } from "./contact-detail";

type Contact = inferRouterOutputs<AppRouter>["crm"]["getContactById"];

const baseContact: Contact = {
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
  messages: [],
};

let mockContact: Contact | null = baseContact;

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(() => ({ data: mockContact, isLoading: false })),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(() => ({
    crm: {
      getContactById: {
        queryOptions: jest.fn(() => ({ queryKey: ["getContactById"] })),
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

describe("ContactDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContact = baseContact;
  });

  it("affiche les informations du contact", () => {
    render(<ContactDetail contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByRole("heading", { name: "Informations du contact" }),
    ).toBeInTheDocument();
    expect(screen.getByText("camille.durand@example.com")).toBeInTheDocument();
    expect(screen.getByText("12 rue des Lilas")).toBeInTheDocument();
    expect(screen.getByText("Pas-de-Calais")).toBeInTheDocument();
    expect(
      screen.getByText("Caisse d'Allocations Familiales (CAF)"),
    ).toBeInTheDocument();
  });

  it("affiche un tiret pour les champs non renseignés", () => {
    mockContact = {
      ...baseContact,
      address: null,
      areaId: null,
      area: null,
      organizationId: null,
      organization: null,
    };

    render(<ContactDetail contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getAllByText("-")).toHaveLength(3);
  });

  it("propose le lien de modification du contact", () => {
    render(<ContactDetail contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByRole("link", { name: "Modifier le contact" }),
    ).toHaveAttribute("href", "/admin/crm/modifier/contact-1");
  });

  it("ne rend rien tant que le contact n'est pas chargé", () => {
    mockContact = null;

    const { container } = render(<ContactDetail contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(container).toBeEmptyDOMElement();
  });
});
