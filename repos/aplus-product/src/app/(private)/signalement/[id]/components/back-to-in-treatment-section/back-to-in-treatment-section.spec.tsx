import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackToInTreatmentSection } from "./back-to-in-treatment-section";
import {
  OrganizationRole,
  ReportStatus,
  TeamType,
} from "@/generated/prisma/enums";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createMockAuthor,
  createMockReportTeam,
  USER_ROLES,
} from "@/test/mocks";
import { useTRPC } from "@/trpc/client";
import { mockQueryClient, mockTRPC } from "@/test/utils/global-mocks";
import { useUploadFiles } from "@/app/query/file/file.query";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "request-123" }),
}));

const mockUseSession = jest.fn();
jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

const mockScrollToLastMessage = jest.fn();
jest.mock("@/app/hooks/use-scroll-to-last-message", () => ({
  useScrollToLastMessage: () => ({
    scrollToLastMessage: mockScrollToLastMessage,
  }),
}));

jest.mock("@/app/query/file/file.query", () => ({
  useUploadFiles: jest.fn(),
}));

const mockCreateAnswer = jest.fn();
const mockUploadFiles = jest.fn();
let mockIsCreatingAnswer = false;
let mockIsUploadingFiles = false;

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useQueryClient: jest.fn(),
  };
});

const baseReport = {
  id: "request-123",
  status: ReportStatus.COMPLETED,
  caf: null,
  nir: null,
  nif: null,
  maritalName: null,
  subject: "Test Subject",
  description: "Test Description",
  phone: null,
  firstName: "John",
  lastName: "Doe",
  birthDate: "1990-01-01",
  citizenPermissionConfirmed: true,
  organizationId: "structure-1",
  applicantTeamId: "group-1",
  areaId: "area-1",
  authorId: "author-1",
  userId: null,
  coAuthorsId: [],
  coAuthors: [],
  requestedTeams: [],
  area: {
    id: "area-1",
    name: "Test Area",
    inseeCode: "12345",
    timezone: "Europe/Paris",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  applicantTeam: {
    ...createMockReportTeam({
      id: "group-1",
      name: "Test Group",
      organizationId: "structure-1",
      role: OrganizationRole.HELPER,
    }),
    organization: {
      id: "structure-1",
      name: "Test Structure",
      shortName: "TS",
      id_v1: "v1",
      additionalInformation: null,
      role: OrganizationRole.HELPER,
      type: TeamType.OTHERS_HELPERS,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  files: [],
  answers: [],
  statusHistory: [],
  author: createMockAuthor({ id: "author-1" }),
  createdAt: new Date(),
  updatedAt: new Date(),
  lastAnswerAt: null,
  overdueAt: null,
};

describe("BackToInTreatmentSection", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function renderWithProvider(component: React.ReactNode) {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsCreatingAnswer = false;
    mockIsUploadingFiles = false;

    mockUseSession.mockReturnValue({
      data: { user: { id: "author-1", role: USER_ROLES.USER } },
      isPending: false,
    });

    (useTRPC as jest.Mock).mockReturnValue({
      ...mockTRPC,
      answer: {
        ...mockTRPC.answer,
        createAnswer: {
          mutationOptions: (options?: {
            onSuccess?: (data: { success: boolean; message?: string }) => void;
            onError?: (error: Error) => void;
          }) => ({
            mutationKey: ["answer", "create"],
            onSuccess: options?.onSuccess,
            onError: options?.onError,
          }),
        },
      },
    });
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);

    (useMutation as jest.Mock).mockImplementation((mutationOptions) => ({
      mutateAsync: mockCreateAnswer.mockImplementation(async () => {
        const result = { success: true };
        if (mutationOptions?.onSuccess) {
          mutationOptions.onSuccess(result);
        }
        return Promise.resolve(result);
      }),
      get isPending() {
        return mockIsCreatingAnswer;
      },
    }));

    (useUploadFiles as jest.Mock).mockReturnValue({
      mutateAsync: mockUploadFiles.mockResolvedValue({
        ok: true,
        data: [],
      }),
      get isPending() {
        return mockIsUploadingFiles;
      },
    });

    (useQuery as jest.Mock).mockImplementation((queryOptions) => {
      if (
        queryOptions &&
        typeof queryOptions === "object" &&
        "initialData" in queryOptions &&
        queryOptions.initialData !== undefined
      ) {
        return {
          data: (queryOptions as { initialData: unknown }).initialData,
        };
      }
      return { data: undefined };
    });
  });

  describe("Display logic", () => {
    it("renders the section for author when report is COMPLETED", () => {
      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      expect(
        screen.getByRole("heading", {
          name: "Repasser le signalement En cours de traitement",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Le blocage du citoyen n'est pas résolu."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      ).toBeInTheDocument();
    });

    it("renders for co-author", () => {
      const reportWithCoAuthor = {
        ...baseReport,
        coAuthors: [
          { ...createMockAuthor({ id: "co-author-1" }), hasViewed: false },
        ],
      };
      mockUseSession.mockReturnValue({
        data: { user: { id: "co-author-1", role: USER_ROLES.USER } },
        isPending: false,
      });

      renderWithProvider(
        <BackToInTreatmentSection initialReport={reportWithCoAuthor} />,
      );

      expect(
        screen.getByRole("heading", {
          name: "Repasser le signalement En cours de traitement",
        }),
      ).toBeInTheDocument();
    });

    it("does not render when status is PENDING_ASSIGNMENT", () => {
      const pending = {
        ...baseReport,
        status: ReportStatus.PENDING_ASSIGNMENT,
      };
      const { container } = renderWithProvider(
        <BackToInTreatmentSection initialReport={pending} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("does not render when status is IN_TREATMENT", () => {
      const inTreatment = { ...baseReport, status: ReportStatus.IN_TREATMENT };
      const { container } = renderWithProvider(
        <BackToInTreatmentSection initialReport={inTreatment} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders the section for author when report is CLOSED", () => {
      const closed = { ...baseReport, status: ReportStatus.CLOSED };
      renderWithProvider(<BackToInTreatmentSection initialReport={closed} />);

      expect(
        screen.getByRole("heading", {
          name: "Repasser le signalement En cours de traitement",
        }),
      ).toBeInTheDocument();
    });

    it("renders the section for admin when report is CLOSED", () => {
      const closed = { ...baseReport, status: ReportStatus.CLOSED };
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-1", role: USER_ROLES.ADMIN } },
        isPending: false,
      });

      renderWithProvider(<BackToInTreatmentSection initialReport={closed} />);

      expect(
        screen.getByRole("heading", {
          name: "Repasser le signalement En cours de traitement",
        }),
      ).toBeInTheDocument();
    });

    it("shows the 'en attente de prise en charge' note only when report is CLOSED", () => {
      const closed = { ...baseReport, status: ReportStatus.CLOSED };
      const { rerender } = renderWithProvider(
        <BackToInTreatmentSection initialReport={closed} />,
      );

      expect(screen.getByText(/il reviendra à cet état/)).toBeInTheDocument();

      rerender(
        <QueryClientProvider client={queryClient}>
          <BackToInTreatmentSection initialReport={baseReport} />
        </QueryClientProvider>,
      );

      expect(screen.queryByText(/il reviendra à cet état/)).toBeNull();
    });

    it("does not render for admin when report is COMPLETED and not author", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-1", role: USER_ROLES.ADMIN } },
        isPending: false,
      });

      const { container } = renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("does not render when current user is not author, co-author or admin", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "other-user", role: USER_ROLES.USER } },
        isPending: false,
      });

      const { container } = renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("does not render when applicant team is deleted", () => {
      const reportWithDeletedTeam = {
        ...baseReport,
        applicantTeam: {
          ...baseReport.applicantTeam,
          deletedAt: new Date("2024-06-01"),
        },
      };

      const { container } = renderWithProvider(
        <BackToInTreatmentSection initialReport={reportWithDeletedTeam} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("does not render when session user id is missing", () => {
      mockUseSession.mockReturnValue({
        data: { user: null },
        isPending: false,
      });

      const { container } = renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Form submission", () => {
    it("requires a message before submitting", async () => {
      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      const submitButton = screen.getByRole("button", {
        name: "Repasser le signalement En cours de traitement",
      });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Veuillez saisir un message."),
        ).toBeInTheDocument();
      });
      expect(mockCreateAnswer).not.toHaveBeenCalled();
    });

    it("submits with IN_TREATMENT status and typed message", async () => {
      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      const textarea = screen.getByLabelText(/Votre message/);
      await userEvent.type(textarea, "Le problème persiste");

      const submitButton = screen.getByRole("button", {
        name: "Repasser le signalement En cours de traitement",
      });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateAnswer).toHaveBeenCalledWith({
          reportId: "request-123",
          content: "Le problème persiste",
          files: [],
          newReportStatus: ReportStatus.IN_TREATMENT,
        });
      });
    });

    it("submits with reopenFromClosed when report is CLOSED (server resolves the target status)", async () => {
      const closed = { ...baseReport, status: ReportStatus.CLOSED };
      renderWithProvider(<BackToInTreatmentSection initialReport={closed} />);

      const textarea = screen.getByLabelText(/Votre message/);
      await userEvent.type(textarea, "Je rouvre ce signalement");

      const submitButton = screen.getByRole("button", {
        name: "Repasser le signalement En cours de traitement",
      });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateAnswer).toHaveBeenCalledWith({
          reportId: "request-123",
          content: "Je rouvre ce signalement",
          files: [],
          reopenFromClosed: true,
        });
      });
    });

    it("does not upload files when none are attached", async () => {
      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      const textarea = screen.getByLabelText(/Votre message/);
      await userEvent.type(textarea, "Sans fichier");

      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(mockCreateAnswer).toHaveBeenCalled();
      });
      expect(mockUploadFiles).not.toHaveBeenCalled();
    });

    it("invalidates report and answer queries on success", async () => {
      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      await userEvent.type(
        screen.getByLabelText(/Votre message/),
        "Message test",
      );
      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
      });
      expect(mockScrollToLastMessage).toHaveBeenCalled();
    });

    it("displays API error when createAnswer returns success=false", async () => {
      (useMutation as jest.Mock).mockImplementation((mutationOptions) => ({
        mutateAsync: mockCreateAnswer.mockImplementation(async () => {
          const result = {
            success: false,
            message: "Erreur serveur simulée",
          };
          if (mutationOptions?.onSuccess) {
            mutationOptions.onSuccess(result);
          }
          return Promise.resolve(result);
        }),
        get isPending() {
          return mockIsCreatingAnswer;
        },
      }));

      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      await userEvent.type(
        screen.getByLabelText(/Votre message/),
        "Message test",
      );
      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(screen.getByText("Erreur serveur simulée")).toBeInTheDocument();
      });
    });

    it("displays generic API error when createAnswer throws", async () => {
      (useMutation as jest.Mock).mockImplementation((mutationOptions) => ({
        mutateAsync: mockCreateAnswer.mockImplementation(async () => {
          const error = new Error("Network boom");
          if (mutationOptions?.onError) {
            mutationOptions.onError(error);
          }
          throw error;
        }),
        get isPending() {
          return mockIsCreatingAnswer;
        },
      }));

      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      await userEvent.type(
        screen.getByLabelText(/Votre message/),
        "Message test",
      );
      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(screen.getByText("Network boom")).toBeInTheDocument();
      });
    });

    it("displays upload error and does not create answer when upload fails", async () => {
      (useUploadFiles as jest.Mock).mockReturnValue({
        mutateAsync: mockUploadFiles.mockResolvedValue({
          ok: false,
          message: "Upload a échoué",
        }),
        get isPending() {
          return mockIsUploadingFiles;
        },
      });

      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      await userEvent.type(
        screen.getByLabelText(/Votre message/),
        "Avec fichier",
      );

      // Simulate file attached via the hidden input
      const fileInput = document.getElementById(
        "input-file-back-to-in-treatment",
      ) as HTMLInputElement;
      const file = new File(["hello"], "hello.pdf", {
        type: "application/pdf",
      });
      await userEvent.upload(fileInput, file);

      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(screen.getByText("Upload a échoué")).toBeInTheDocument();
      });
      expect(mockCreateAnswer).not.toHaveBeenCalled();
    });

    it("displays fallback message when createAnswer returns success=false without message", async () => {
      (useMutation as jest.Mock).mockImplementation((mutationOptions) => ({
        mutateAsync: mockCreateAnswer.mockImplementation(async () => {
          const result = { success: false };
          if (mutationOptions?.onSuccess) {
            mutationOptions.onSuccess(result);
          }
          return Promise.resolve(result);
        }),
        get isPending() {
          return mockIsCreatingAnswer;
        },
      }));

      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );
      await userEvent.type(
        screen.getByLabelText(/Votre message/),
        "Message test",
      );
      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
      });
    });

    it("displays fallback message when createAnswer throws without message", async () => {
      (useMutation as jest.Mock).mockImplementation((mutationOptions) => ({
        mutateAsync: mockCreateAnswer.mockImplementation(async () => {
          const error = new Error();
          if (mutationOptions?.onError) {
            mutationOptions.onError(error);
          }
          throw error;
        }),
        get isPending() {
          return mockIsCreatingAnswer;
        },
      }));

      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );
      await userEvent.type(
        screen.getByLabelText(/Votre message/),
        "Message test",
      );
      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
      });
    });

    it("displays fallback message when upload fails without message", async () => {
      (useUploadFiles as jest.Mock).mockReturnValue({
        mutateAsync: mockUploadFiles.mockResolvedValue({ ok: false }),
        get isPending() {
          return mockIsUploadingFiles;
        },
      });

      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );
      await userEvent.type(
        screen.getByLabelText(/Votre message/),
        "Avec fichier",
      );
      const fileInput = document.getElementById(
        "input-file-back-to-in-treatment",
      ) as HTMLInputElement;
      const file = new File(["hello"], "hello.pdf", {
        type: "application/pdf",
      });
      await userEvent.upload(fileInput, file);
      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByText("Erreur lors du téléchargement des fichiers"),
        ).toBeInTheDocument();
      });
    });

    it("uploads files then creates answer with uploaded metadata", async () => {
      const uploadedMeta = {
        id: "file-1",
        name: "hello.pdf",
        size: 5,
        type: "application/pdf",
        lastModified: new Date().getTime(),
      };
      (useUploadFiles as jest.Mock).mockReturnValue({
        mutateAsync: mockUploadFiles.mockResolvedValue({
          ok: true,
          data: [uploadedMeta],
        }),
        get isPending() {
          return mockIsUploadingFiles;
        },
      });

      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      await userEvent.type(
        screen.getByLabelText(/Votre message/),
        "Avec fichier",
      );

      const fileInput = document.getElementById(
        "input-file-back-to-in-treatment",
      ) as HTMLInputElement;
      const file = new File(["hello"], "hello.pdf", {
        type: "application/pdf",
      });
      await userEvent.upload(fileInput, file);

      await userEvent.click(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      );

      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(mockCreateAnswer).toHaveBeenCalledWith(
          expect.objectContaining({
            reportId: "request-123",
            content: "Avec fichier",
            newReportStatus: ReportStatus.IN_TREATMENT,
            files: [
              expect.objectContaining({
                id: "file-1",
                name: "hello.pdf",
                lastModified: expect.any(Date),
              }),
            ],
          }),
        );
      });
    });
  });

  describe("Button state", () => {
    it("disables the submit button while creating an answer", () => {
      mockIsCreatingAnswer = true;
      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      expect(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      ).toBeDisabled();
    });

    it("disables the submit button while uploading files", () => {
      mockIsUploadingFiles = true;
      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      expect(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      ).toBeDisabled();
    });

    it("enables the submit button when idle", () => {
      renderWithProvider(
        <BackToInTreatmentSection initialReport={baseReport} />,
      );

      expect(
        screen.getByRole("button", {
          name: "Repasser le signalement En cours de traitement",
        }),
      ).not.toBeDisabled();
    });
  });
});
