import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMockArea, createMockOrganization } from "@/test/mocks";
import { ContactForm } from "./contact-form";

interface MutationOptions {
  kind: "create" | "update";
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}

const mockPush = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
let mockNextError: { message: string } | null = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const mockAreas = [
  createMockArea({ id: "area-2", name: "Nord" }),
  createMockArea({ id: "area-1", name: "Pas-de-Calais" }),
];

const mockOrganizations = [
  createMockOrganization({
    id: "org-ft",
    name: "France Travail",
    shortName: "France Travail",
  }),
  createMockOrganization({
    id: "org-caf",
    name: "Caisse d'Allocations Familiales",
    shortName: "CAF",
  }),
];

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn((options: { queryKey?: string[] }) => {
    if (options?.queryKey?.[0] === "getAreas") {
      return { data: mockAreas, isLoading: false };
    }
    return { data: mockOrganizations, isLoading: false };
  }),
  useMutation: jest.fn((options: MutationOptions) => ({
    mutate: (input: unknown) => {
      const spy = options.kind === "create" ? mockCreate : mockUpdate;
      spy(input);
      if (mockNextError) options.onError?.(mockNextError);
      else options.onSuccess?.();
    },
    isPending: false,
  })),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(() => ({
    area: {
      getAreas: { queryOptions: () => ({ queryKey: ["getAreas"] }) },
    },
    organization: {
      getOrganizations: {
        queryOptions: () => ({ queryKey: ["getOrganizations"] }),
      },
    },
    crm: {
      createContact: {
        mutationOptions: (options: MutationOptions) => ({
          ...options,
          kind: "create",
        }),
      },
      updateContact: {
        mutationOptions: (options: MutationOptions) => ({
          ...options,
          kind: "update",
        }),
      },
    },
  })),
}));

const existingContact = {
  id: "contact-1",
  createdAt: new Date("2024-01-15T10:00:00Z"),
  updatedAt: new Date("2024-01-15T10:00:00Z"),
  firstName: "Camille",
  lastName: "Durand",
  email: "camille.durand@example.com",
  address: "12 rue des Lilas",
  areaId: "area-1",
  area: { id: "area-1", name: "Pas-de-Calais" },
  organizationId: "org-caf",
  organization: {
    id: "org-caf",
    name: "Caisse d'Allocations Familiales",
    shortName: "CAF",
  },
  deletedAt: null,
  messages: [],
};

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

describe("ContactForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNextError = null;
  });

  describe("création", () => {
    it("affiche des champs vides et le bouton de création", () => {
      render(<ContactForm />, { wrapper: createWrapper() });

      expect(screen.getByLabelText("Prénom")).toHaveValue("");
      expect(screen.getByLabelText("Nom")).toHaveValue("");
      expect(screen.getByLabelText("Adresse e-mail")).toHaveValue("");
      expect(screen.getByLabelText("Adresse")).toHaveValue("");
      expect(screen.getByLabelText("Territoire")).toHaveValue("");
      expect(screen.getByLabelText("Organisme")).toHaveValue("");
      expect(
        screen.getByRole("button", { name: "Créer le contact" }),
      ).toBeInTheDocument();
    });

    it("trie les territoires par nom et propose « Non renseigné »", () => {
      render(<ContactForm />, { wrapper: createWrapper() });

      const options = screen
        .getAllByRole("option")
        .map((option) => option.textContent);
      expect(options.slice(0, 3)).toEqual([
        "Non renseigné",
        "Nord",
        "Pas-de-Calais",
      ]);
    });

    it("affiche le sigle d'un organisme seulement quand il diffère du nom", () => {
      render(<ContactForm />, { wrapper: createWrapper() });

      expect(
        screen.getByRole("option", {
          name: "Caisse d'Allocations Familiales (CAF)",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "France Travail" }),
      ).toBeInTheDocument();
    });

    it("refuse un formulaire incomplet", async () => {
      const user = userEvent.setup();
      render(<ContactForm />, { wrapper: createWrapper() });

      await user.click(
        screen.getByRole("button", { name: "Créer le contact" }),
      );

      expect(
        await screen.findByText("Le prénom est obligatoire"),
      ).toBeInTheDocument();
      expect(screen.getByText("Le nom est obligatoire")).toBeInTheDocument();
      expect(screen.getByText("Adresse e-mail invalide")).toBeInTheDocument();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("crée le contact en envoyant null pour les champs laissés vides", async () => {
      const user = userEvent.setup();
      render(<ContactForm />, { wrapper: createWrapper() });

      await user.type(screen.getByLabelText("Prénom"), "Alex");
      await user.type(screen.getByLabelText("Nom"), "Martel");
      await user.type(
        screen.getByLabelText("Adresse e-mail"),
        "alex.martel@example.com",
      );
      await user.click(
        screen.getByRole("button", { name: "Créer le contact" }),
      );

      expect(mockCreate).toHaveBeenCalledWith({
        firstName: "Alex",
        lastName: "Martel",
        email: "alex.martel@example.com",
        address: null,
        areaId: null,
        organizationId: null,
      });
      expect(mockPush).toHaveBeenCalledWith("/admin/crm");
    });

    it("affiche le message d'erreur du routeur", async () => {
      mockNextError = {
        message: "Un contact utilise déjà cette adresse e-mail.",
      };
      const user = userEvent.setup();
      render(<ContactForm />, { wrapper: createWrapper() });

      await user.type(screen.getByLabelText("Prénom"), "Alex");
      await user.type(screen.getByLabelText("Nom"), "Martel");
      await user.type(
        screen.getByLabelText("Adresse e-mail"),
        "alex.martel@example.com",
      );
      await user.click(
        screen.getByRole("button", { name: "Créer le contact" }),
      );

      expect(
        await screen.findByText(
          "Un contact utilise déjà cette adresse e-mail.",
        ),
      ).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("édition", () => {
    it("préremplit les champs depuis le contact", () => {
      render(<ContactForm contact={existingContact} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByLabelText("Prénom")).toHaveValue("Camille");
      expect(screen.getByLabelText("Nom")).toHaveValue("Durand");
      expect(screen.getByLabelText("Adresse e-mail")).toHaveValue(
        "camille.durand@example.com",
      );
      expect(screen.getByLabelText("Adresse")).toHaveValue("12 rue des Lilas");
      expect(screen.getByLabelText("Territoire")).toHaveValue("area-1");
      expect(screen.getByLabelText("Organisme")).toHaveValue("org-caf");
      expect(
        screen.getByRole("button", { name: "Enregistrer les modifications" }),
      ).toBeInTheDocument();
    });

    it("met à jour le contact et renvoie vers sa fiche", async () => {
      const user = userEvent.setup();
      render(<ContactForm contact={existingContact} />, {
        wrapper: createWrapper(),
      });

      await user.clear(screen.getByLabelText("Adresse"));
      await user.click(
        screen.getByRole("button", { name: "Enregistrer les modifications" }),
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        id: "contact-1",
        firstName: "Camille",
        lastName: "Durand",
        email: "camille.durand@example.com",
        address: null,
        areaId: "area-1",
        organizationId: "org-caf",
      });
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/admin/crm/contact-1");
    });
  });
});
