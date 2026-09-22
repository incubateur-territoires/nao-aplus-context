import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { ReportContent } from "./report-content";
import { ReportStatus } from "@/generated/prisma/client";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import { USER_ROLES } from "@/test/mocks";
// Mock TRPCWrapper to avoid tRPC provider issues in tests
const MockTRPCWrapper = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="trpc-wrapper">{children}</div>
);
import * as reactQuery from "@tanstack/react-query";

// Mock useParams
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-request-id" }),
}));

// Define types for mocked components
interface MockRequest {
  id?: string;
  firstName?: string;
  lastName?: string;
  status?: ReportStatus;
  colleagues?: Array<{ id: string; firstName: string; lastName: string }>;
  author?: {
    firstName?: string;
    lastName?: string;
  };
}

interface MockFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  requestId: string;
}

// Mock child components
jest.mock("@/app/component/request-status-badge/request-status-badge", () => ({
  ReportStatusBadge: ({ status }: { status: ReportStatus | undefined }) => (
    <div data-testid="status-badge" data-status={status}>
      Status Badge: {status}
    </div>
  ),
}));

jest.mock("../documents/documents", () => ({
  Documents: ({ files }: { files: MockFile[] }) => (
    <div data-testid="documents">Documents: {files.length} files</div>
  ),
}));

jest.mock("../citizen-infos/citizen-infos", () => ({
  CitizenInfos: ({ report }: { report: MockRequest | null }) => (
    <div data-testid="citizen-infos">
      Citizen: {report?.firstName} {report?.lastName}
    </div>
  ),
}));

jest.mock("../author-infos/author-infos", () => ({
  AuthorInfos: ({ report }: { report: MockRequest | null }) => (
    <div data-testid="author-infos">
      Author: {report?.author?.firstName} {report?.author?.lastName}
    </div>
  ),
}));

jest.mock("../recipients-infos/recipients-infos", () => ({
  RecipientsInfos: ({ reportId }: { reportId: string | undefined }) => (
    <div data-testid="recipients-infos">Recipients: {reportId}</div>
  ),
}));

jest.mock("../informations/informations", () => ({
  Informations: ({ report }: { report: MockRequest | null }) => (
    <div data-testid="informations">Info: {report?.id}</div>
  ),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

const mockTrpc = {
  report: {
    getReportById: {
      queryOptions: jest.fn((id: string) => ({
        queryKey: ["report", "getReportById", id],
        queryFn: jest.fn(),
      })),
    },
  },
};

jest.mock("@/trpc/client", () => ({
  useTRPC: () => mockTrpc,
}));

describe("RequestContent", () => {
  const baseReport = {
    email: "jean.dupont@example.com",
    description: "Test description content",
    phone: "0123456789",
    profession: "Developer",
    id: "test-request-id",
    firstName: "Jean",
    lastName: "Dupont",
    birthDate: "1990-05-15",
    authorId: "author1",
    userId: "user1",
    nir: "1901234567890",
    caf: "CAF123456",
    nif: "NIF789012",
    maritalName: null,
    subject: "Test Subject",
    createdAt: new Date(),
    updatedAt: new Date(),
    areaId: "area1",
    applicantTeamId: "group1",
    citizenPermissionConfirmed: true,
    organizationId: "struct1",
    status: ReportStatus.PENDING_ASSIGNMENT,
    lastAnswerAt: null,
    overdueAt: null,
    author: {
      id: "author1",
      phone: "0123456789",
      profession: "Developer",
      firstName: "Jean",
      lastName: "Dupont",
      createdAt: new Date(),
      updatedAt: new Date(),
      email: "jean.dupont@example.com",
      name: "Jean Dupont",
      emailVerified: true,
      role: USER_ROLES.USER,
      isInactive: null,
      deletedAt: null,
      cguAcceptedAt: null,
      lastActivityAt: new Date(),
      inactivityWarningsSentAt: [],
      notificationFrequency: "EACH_SOLICITATION" as const,
      lastDigestSentAt: null,
      newsLetterAcceptedAt: null,
      internalSupportComment: null,
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: false,
      notificationsViewedBefore: null,
    },
    files: [
      {
        id: "file1",
        name: "document.pdf",
        size: 1024,
        type: "application/pdf",
        lastModified: new Date(),
        reportId: "test-request-id",
      },
    ],
    area: {
      id: "area1",
      name: "Paris",
      timezone: "Europe/Paris",
      createdAt: new Date(),
      updatedAt: new Date(),
      inseeCode: "75000",
    },
    requestedTeams: [
      {
        id: "group1",
        name: "CAF",
        organizationId: "struct1",
        createdAt: new Date(),
        updatedAt: new Date(),
        role: OrganizationRole.OPERATOR,
        email: null,
        description: null,
        registrationNumber: null,
        adminComment: null,
        type: TeamType.OTHERS_HELPERS,
        acceptTypes: Object.values(TeamType),
        publicNote: null,
        internalSupportComment: null,
        deletedAt: null,
        organization: {
          role: OrganizationRole.OPERATOR,
          type: TeamType.OPERATOR,
          id: "struct1",
          name: "Structure Test",
          shortName: "ST",
          createdAt: new Date(),
          updatedAt: new Date(),
          id_v1: "struct1_v1",
          additionalInformation: null,
          specificFields: [
            {
              id: "field1",
              name: "caf",
              label: "CAF",
              errorMessage: "CAF required",
              hintText: "7 digits",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: "field2",
              name: "nir",
              label: "NIR",
              errorMessage: "NIR required",
              hintText: "13 ou 15 chiffres",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      },
      {
        id: "group2",
        name: "CPAM",
        organizationId: "struct2",
        createdAt: new Date(),
        updatedAt: new Date(),
        role: OrganizationRole.OPERATOR,
        email: null,
        description: null,
        registrationNumber: null,
        adminComment: null,
        type: TeamType.OTHERS_HELPERS,
        acceptTypes: Object.values(TeamType),
        publicNote: null,
        internalSupportComment: null,
        deletedAt: null,
        organization: {
          role: OrganizationRole.OPERATOR,
          type: TeamType.OPERATOR,
          id: "struct2",
          name: "Structure Test 2",
          shortName: "ST2",
          createdAt: new Date(),
          updatedAt: new Date(),
          id_v1: "struct2_v1",
          additionalInformation: null,
          specificFields: [
            {
              id: "field3",
              name: "nif",
              label: "NIF",
              errorMessage: "NIF required",
              hintText: "13 digits",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      },
    ],
    applicantTeam: {
      organization: {
        id: "struct1",
        name: "Structure Test",
        shortName: "ST",
        createdAt: new Date(),
        updatedAt: new Date(),
        id_v1: "struct1_v1",
        additionalInformation: null,
        role: OrganizationRole.OPERATOR,
        type: TeamType.OPERATOR,
      },
      id: "group1",
      name: "Maison France Services",
      organizationId: "struct1",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: OrganizationRole.OPERATOR,
      email: null,
      description: null,
      registrationNumber: null,
      adminComment: null,
      type: TeamType.OTHERS_HELPERS,
      acceptTypes: Object.values(TeamType),
      publicNote: null,
      internalSupportComment: null,
      deletedAt: null,
    },
    colleagues: [
      {
        id: "colleague1",
        phone: "0123456789",
        profession: "Developer",
        firstName: "Jane",
        lastName: "Smith",
        createdAt: new Date(),
        updatedAt: new Date(),
        email: "jane.smith@example.com",
        name: "Jane Smith",
        emailVerified: true,
        role: [USER_ROLES.USER],
      },
    ],
    coAuthors: [],
    coAuthorsId: [],
    answers: [],
    statusHistory: [],
  };

  const renderWithWrapper = (children: React.ReactNode) => {
    return render(<MockTRPCWrapper>{children}</MockTRPCWrapper>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (reactQuery.useQuery as jest.Mock).mockReturnValue({
      data: baseReport,
      isLoading: false,
      error: null,
    });
  });

  it("renders request subject and description", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Test Subject")).toBeInTheDocument();
      expect(screen.getByText("Test description content")).toBeInTheDocument();
    });
  });

  it("renders documents component with files", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("documents")).toBeInTheDocument();
      expect(screen.getByTestId("documents")).toHaveTextContent(
        "Documents: 1 files",
      );
    });
  });

  it("renders citizen infos component", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("citizen-infos")).toBeInTheDocument();
      expect(screen.getByTestId("citizen-infos")).toHaveTextContent(
        "Citizen: Jean Dupont",
      );
    });
  });

  it("renders recipients infos component with correct report id", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("recipients-infos")).toBeInTheDocument();
      expect(screen.getByTestId("recipients-infos")).toHaveTextContent(
        `Recipients: ${baseReport.id}`,
      );
    });
  });

  it("renders informations component", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("informations")).toBeInTheDocument();
      expect(screen.getByTestId("informations")).toHaveTextContent(
        "Info: test-request-id",
      );
    });
  });

  it("applies correct container styles", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      // Find the main container (not the inner div with the subject)
      const container = document.querySelector(
        ".p-4.md\\:p-20.bg-white.mt-8.relative",
      );
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass(
        "p-4",
        "md:p-20",
        "bg-white",
        "mt-8",
        "relative",
      );
    });
  });

  it("applies correct layout structure", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      // Check main content area structure
      const mainContent = screen.getByText("Test Subject").closest(".w-full");
      expect(mainContent).toHaveClass("mt-6", "mb-10", "w-full", "md:w-2/3");

      // Check sidebar structure
      const sidebar = screen.getByTestId("citizen-infos").closest(".w-full");
      expect(sidebar).toHaveClass("w-full", "md:w-1/3", "flex", "flex-col");
    });
  });

  it("applies correct grid structure for info components", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      const infoGrid = screen.getByTestId("author-infos").closest(".grid");
      expect(infoGrid).toHaveClass(
        "grid",
        "grid-cols-1",
        "md:grid-cols-2",
        "lg:grid-cols-3",
        "gap-4",
        "md:gap-10",
        "mt-16",
      );
    });
  });

  it("handles empty files array", async () => {
    const requestWithoutFiles = { ...baseReport, files: [] };
    (reactQuery.useQuery as jest.Mock).mockReturnValue({
      data: requestWithoutFiles,
      isLoading: false,
      error: null,
    });

    renderWithWrapper(
      <ReportContent
        initialReport={requestWithoutFiles}
        userTimezone="Europe/Paris"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("documents")).toHaveTextContent(
        "Documents: 0 files",
      );
    });
  });

  it("handles empty requested groups", async () => {
    const requestWithoutGroups = { ...baseReport, requestedTeams: [] };
    (reactQuery.useQuery as jest.Mock).mockReturnValue({
      data: requestWithoutGroups,
      isLoading: false,
      error: null,
    });

    renderWithWrapper(
      <ReportContent
        initialReport={requestWithoutGroups}
        userTimezone="Europe/Paris"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("recipients-infos")).toHaveTextContent(
        `Recipients: ${requestWithoutGroups.id}`,
      );
    });
  });

  it("uses initial data correctly", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      expect(reactQuery.useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["report", "getReportById", "test-request-id"],
          queryFn: expect.any(Function),
          initialData: baseReport,
        }),
      );
    });
  });

  it("handles query loading state", async () => {
    (reactQuery.useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    // Should render with null/undefined data gracefully
    await waitFor(() => {
      expect(screen.getByTestId("citizen-infos")).toHaveTextContent("Citizen:");
    });
  });

  it("applies correct heading styles", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      const subject = screen.getByText("Test Subject");
      expect(subject.tagName).toBe("H2");
    });
  });

  it("applies correct description styles", async () => {
    renderWithWrapper(
      <ReportContent initialReport={baseReport} userTimezone="Europe/Paris" />,
    );

    await waitFor(() => {
      const description = screen.getByText("Test description content");
      expect(description).toHaveClass("text-md");
      expect(description.tagName).toBe("P");
    });
  });
});
