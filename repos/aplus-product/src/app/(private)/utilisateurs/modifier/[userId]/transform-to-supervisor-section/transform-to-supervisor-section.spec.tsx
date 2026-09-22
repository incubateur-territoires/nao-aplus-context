import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { TransformToSupervisorSection } from "./transform-to-supervisor-section";
import { useTRPC } from "@/trpc/client";
import { MOCK_IDS } from "@/test/mocks";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useQueryClient: jest.fn(),
  };
});

const mockModalOpen = jest.fn();
const mockModalClose = jest.fn();
jest.mock("@codegouvfr/react-dsfr/Modal", () => ({
  createModal: () => ({
    Component: ({
      children,
      title,
      buttons,
    }: {
      children: React.ReactNode;
      title: string;
      buttons: {
        children: string;
        onClick?: () => void;
        priority?: string;
      }[];
    }) => (
      <dialog data-testid="transform-modal" aria-label={title}>
        {children}
        <div>
          {buttons.map((btn, i) => (
            <button
              key={i}
              type="button"
              onClick={btn.onClick}
              data-testid={
                btn.priority === "secondary"
                  ? "modal-cancel-btn"
                  : "modal-confirm-btn"
              }
            >
              {btn.children}
            </button>
          ))}
        </div>
      </dialog>
    ),
    open: mockModalOpen,
    close: mockModalClose,
  }),
}));

const mockAllAreas = [
  { id: MOCK_IDS.AREA_1, name: "Nord", inseeCode: "59" },
  { id: MOCK_IDS.AREA_2, name: "Pas-de-Calais", inseeCode: "62" },
];

const mockAllOrganizations = [
  { id: MOCK_IDS.ORG_1, name: "CPAM", shortName: "CPAM" },
  { id: "org-2", name: "Préfecture", shortName: "PREF" },
];

const mockTransformToSupervisor = jest
  .fn()
  .mockResolvedValue({ success: true });
const mockOnSuccess = jest.fn();
const mockQueryClient = {
  refetchQueries: jest.fn(),
  invalidateQueries: jest.fn(),
};

interface PreviewData {
  scenarios: {
    type: string;
    reportId: string;
    reportSubject: string;
    reportApplicant: string;
    newAuthor?: string;
    newAuthorEmail?: string;
  }[];
  teams: string[];
  managedTeams: string[];
  managerTransfers: {
    teamName: string;
    newManagerName: string | null;
    hasOtherManagers: boolean;
  }[];
}

function setupMocks(
  options: {
    previewData?: PreviewData | null;
    previewLoading?: boolean;
  } = {},
) {
  const { previewData = null, previewLoading = false } = options;

  (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);

  (useMutation as jest.Mock).mockImplementation(() => ({
    mutateAsync: mockTransformToSupervisor,
    isPending: false,
  }));

  (useTRPC as jest.Mock).mockReturnValue({
    user: {
      getFullUserById: {
        queryOptions: () => ({
          queryKey: ["user", "getFullUserById"],
        }),
      },
      transformToSupervisor: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationKey: ["user", "transformToSupervisor"],
          mutationFn: mockTransformToSupervisor,
          ...opts,
        }),
      },
      previewSupervisorTransformation: {
        queryOptions: () => ({
          queryKey: ["user", "previewSupervisorTransformation"],
        }),
      },
    },
    area: {
      getAreas: {
        queryOptions: () => ({
          queryKey: ["area", "getAreas"],
        }),
      },
    },
    organization: {
      getOrganizations: {
        queryOptions: () => ({
          queryKey: ["organization", "getOrganizations"],
        }),
      },
    },
  });

  (useQuery as jest.Mock).mockImplementation((options) => {
    const queryKey = JSON.stringify(options?.queryKey || []);
    if (queryKey.includes("getAreas")) {
      return { data: mockAllAreas, isLoading: false };
    }
    if (queryKey.includes("getOrganizations")) {
      return { data: mockAllOrganizations, isLoading: false };
    }
    if (queryKey.includes("previewSupervisorTransformation")) {
      return { data: previewData, isLoading: previewLoading };
    }
    return { data: undefined, isLoading: false };
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("TransformToSupervisorSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the section heading and description", () => {
      setupMocks();
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      expect(
        screen.getByRole("heading", {
          name: /Transformer l'utilisateur en superviseur/i,
          level: 2,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Si le membre est auteur de signalements/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/a accès à tous les signalements des territoires/),
      ).toBeInTheDocument();
    });

    it("renders both selectors and the submit button", () => {
      setupMocks();
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText("Territoires à superviser")).toBeInTheDocument();
      expect(screen.getByText("Organisation à superviser")).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /Transformer l'utilisateur en superviseur/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("shows error when submitting with no selection", async () => {
      const user = userEvent.setup();
      setupMocks();
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      const submitButton = screen.getByRole("button", {
        name: /Transformer l'utilisateur en superviseur/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            /Sélectionnez au moins un territoire ou une organisation/i,
          ),
        ).toBeInTheDocument();
      });

      expect(mockModalOpen).not.toHaveBeenCalled();
    });

    it("opens modal when at least one area is selected", async () => {
      const user = userEvent.setup();
      setupMocks();
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      // Select an area via the autocomplete
      const areaInput = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(areaInput);
      const nordOption = await screen.findByText("Nord");
      await user.click(nordOption);

      const submitButton = screen.getByRole("button", {
        name: /Transformer l'utilisateur en superviseur/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockModalOpen).toHaveBeenCalled();
      });
    });
  });

  describe("Tag dismissal", () => {
    it("removes a selected area when its tag is dismissed", async () => {
      const user = userEvent.setup();
      setupMocks();
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      const areaInput = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(areaInput);
      const nordOption = await screen.findByText("Nord");
      await user.click(nordOption);

      // Click outside to close dropdown
      await user.keyboard("{Escape}");

      // Find dismiss button on the selected tag
      const tags = screen.getAllByText("Nord");
      const tagButton = tags
        .map((el) => el.closest("button"))
        .find((btn) => btn?.getAttribute("type") === "button") as HTMLElement;
      await user.click(tagButton);

      // Now no selection — submit should fail validation
      const submitButton = screen.getByRole("button", {
        name: /Transformer l'utilisateur en superviseur/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            /Sélectionnez au moins un territoire ou une organisation/i,
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Mutation flow", () => {
    it("calls transformToSupervisor when confirming the modal", async () => {
      const user = userEvent.setup();
      setupMocks();
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      const areaInput = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(areaInput);
      const nordOption = await screen.findByText("Nord");
      await user.click(nordOption);
      await user.keyboard("{Escape}");

      const submitButton = screen.getByRole("button", {
        name: /Transformer l'utilisateur en superviseur/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockModalOpen).toHaveBeenCalled();
      });

      const confirmButton = screen.getByTestId("modal-confirm-btn");
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockTransformToSupervisor).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
          areaIds: [MOCK_IDS.AREA_1],
          organizationIds: [],
        });
      });

      expect(mockModalClose).toHaveBeenCalled();
    });

    it("invokes onSuccess and refetches user data after successful mutation", async () => {
      let onSuccessCallback: (() => Promise<void>) | undefined;
      setupMocks();
      (useMutation as jest.Mock).mockImplementation((options) => {
        if (options?.onSuccess) {
          onSuccessCallback = options.onSuccess;
        }
        return {
          mutateAsync: mockTransformToSupervisor,
          isPending: false,
        };
      });

      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      await onSuccessCallback?.();

      expect(mockQueryClient.refetchQueries).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: "smooth",
      });
    });
  });

  describe("Preview in modal", () => {
    it("shows loading state while preview is fetching", async () => {
      const user = userEvent.setup();
      setupMocks({ previewLoading: true });
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      const areaInput = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(areaInput);
      const nordOption = await screen.findByText("Nord");
      await user.click(nordOption);
      await user.keyboard("{Escape}");

      await user.click(
        screen.getByRole("button", {
          name: /Transformer l'utilisateur en superviseur/i,
        }),
      );

      expect(screen.getByText(/Chargement de l'aperçu/i)).toBeInTheDocument();
    });

    it("renders empty state when no impacts", async () => {
      const user = userEvent.setup();
      setupMocks({
        previewData: {
          scenarios: [],
          teams: [],
          managedTeams: [],
          managerTransfers: [],
        },
      });
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      const areaInput = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(areaInput);
      const nordOption = await screen.findByText("Nord");
      await user.click(nordOption);
      await user.keyboard("{Escape}");
      await user.click(
        screen.getByRole("button", {
          name: /Transformer l'utilisateur en superviseur/i,
        }),
      );

      expect(
        screen.getByText(/n'est dans aucune équipe et n'a aucun signalement/),
      ).toBeInTheDocument();
    });

    it("lists teams, managed teams and scenarios with correct labels", async () => {
      const user = userEvent.setup();
      setupMocks({
        previewData: {
          scenarios: [
            {
              type: "AUTHOR_TRANSFER",
              reportId: "r1",
              reportSubject: "Sujet 1",
              reportApplicant: "Marie Dupont",
              newAuthor: "Paul Martin",
              newAuthorEmail: "paul@example.com",
            },
            {
              type: "RECIPIENT_HANDLED_REVERT",
              reportId: "r2",
              reportSubject: "Sujet 2",
              reportApplicant: "Anne Curie",
            },
            {
              type: "AUTHOR_ALONE_CLOSE",
              reportId: "r3",
              reportSubject: "Sujet 3",
              reportApplicant: "Léo Petit",
            },
            {
              type: "COAUTHOR_ONLY",
              reportId: "r4",
              reportSubject: "Sujet 4",
              reportApplicant: "Sophie",
            },
          ],
          teams: ["FS Arras", "FS Lyon"],
          managedTeams: ["FS Lyon"],
          managerTransfers: [
            {
              teamName: "FS Lyon",
              newManagerName: "Paul Martin",
              hasOtherManagers: false,
            },
          ],
        },
      });
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      const areaInput = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(areaInput);
      const nordOption = await screen.findByText("Nord");
      await user.click(nordOption);
      await user.keyboard("{Escape}");
      await user.click(
        screen.getByRole("button", {
          name: /Transformer l'utilisateur en superviseur/i,
        }),
      );

      expect(
        screen.getByText(/Équipes \(sera retiré de\)/),
      ).toBeInTheDocument();
      expect(screen.getByText("FS Arras")).toBeInTheDocument();
      expect(
        screen.getByText(/Équipes gérées \(ne sera plus responsable\)/),
      ).toBeInTheDocument();
      // Manager transfer label — "Paul Martin" appears as both new manager and new author
      expect(screen.getAllByText("Paul Martin").length).toBeGreaterThan(0);
      // Summary counters
      expect(
        screen.getByText(/transféré\(s\) à un autre membre/),
      ).toBeInTheDocument();
      expect(screen.getByText(/fermé\(s\)/)).toBeInTheDocument();
      expect(
        screen.getByText(/remis en attente de prise en charge/),
      ).toBeInTheDocument();
      // Detail labels match app vocabulary
      expect(
        screen.getByText(/Transféré à un autre membre de l'équipe/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Remis en attente de prise en charge/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Fermé \(auteur seul sans équipe\)/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Retiré des co-auteurs/)).toBeInTheDocument();
    });

    it("shows 'd'autres responsables existent' when other managers exist", async () => {
      const user = userEvent.setup();
      setupMocks({
        previewData: {
          scenarios: [],
          teams: [],
          managedTeams: ["FS Lyon"],
          managerTransfers: [
            {
              teamName: "FS Lyon",
              newManagerName: null,
              hasOtherManagers: true,
            },
          ],
        },
      });
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      const areaInput = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(areaInput);
      const nordOption = await screen.findByText("Nord");
      await user.click(nordOption);
      await user.keyboard("{Escape}");
      await user.click(
        screen.getByRole("button", {
          name: /Transformer l'utilisateur en superviseur/i,
        }),
      );

      expect(
        screen.getByText(/d'autres responsables existent/),
      ).toBeInTheDocument();
    });

    it("warns when no active member can take over the manager role", async () => {
      const user = userEvent.setup();
      setupMocks({
        previewData: {
          scenarios: [],
          teams: [],
          managedTeams: ["FS Lyon"],
          managerTransfers: [
            {
              teamName: "FS Lyon",
              newManagerName: null,
              hasOtherManagers: false,
            },
          ],
        },
      });
      render(
        <TransformToSupervisorSection
          userId={MOCK_IDS.USER_2}
          onSuccess={mockOnSuccess}
        />,
        { wrapper: createWrapper() },
      );

      const areaInput = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(areaInput);
      const nordOption = await screen.findByText("Nord");
      await user.click(nordOption);
      await user.keyboard("{Escape}");
      await user.click(
        screen.getByRole("button", {
          name: /Transformer l'utilisateur en superviseur/i,
        }),
      );

      expect(
        screen.getByText(/aucun membre actif pour reprendre le rôle/),
      ).toBeInTheDocument();
    });
  });
});
