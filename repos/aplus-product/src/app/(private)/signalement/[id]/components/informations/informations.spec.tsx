import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Informations } from "./informations";
import {
  OrganizationRole,
  ReportStatus,
  TeamType,
} from "@/generated/prisma/client";
import { USER_ROLES } from "@/test/mocks";
// Mock the format utility
jest.mock("@/utils/format", () => ({
  formatToLongDate: jest.fn((date: Date) =>
    date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  ),
}));

describe("Informations", () => {
  const mockReport = {
    id: "1",
    authorId: "author1",
    coAuthors: [],
    coAuthorsId: [],
    firstName: "Marie",
    lastName: "Martin",
    birthDate: "1990-01-01",
    phone: "0612345678",
    userId: null,
    nir: "1901234567890",
    caf: "CAF123456",
    nif: "NIF789012",
    maritalName: null,
    subject: "Test subject",
    description: "Test description",
    createdAt: new Date(),
    updatedAt: new Date(),
    areaId: "area1",
    applicantTeamId: "group1",
    citizenPermissionConfirmed: true,
    organizationId: "struct1",
    status: ReportStatus.PENDING_ASSIGNMENT,
    email: "jean.dupont@example.com",
    author: {
      id: "author1",
      firstName: "Jean",
      lastName: "Dupont",
      phone: "0123456789",
      profession: "Developer",
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
    files: [],
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
          ],
        },
      },
    ],
    applicantTeam: {
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
      },
      id: "group1",
      role: OrganizationRole.OPERATOR,
      name: "Maison France Services",
      organizationId: "struct1",
      createdAt: new Date(),
      updatedAt: new Date(),
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
    colleagues: [],
    lastAnswerAt: null,
    overdueAt: null,
    answers: [],
    statusHistory: [],
  };

  it("renders informations section correctly", () => {
    render(<Informations report={mockReport} userTimezone="Europe/Paris" />);

    expect(screen.getByText("Informations")).toBeInTheDocument();
    expect(screen.getByText("Date de création")).toBeInTheDocument();
    expect(screen.getByText("Territoire")).toBeInTheDocument();
    expect(screen.getByText("Nombre de réponses")).toBeInTheDocument();
  });

  it("displays area information correctly", () => {
    render(<Informations report={mockReport} userTimezone="Europe/Paris" />);

    expect(screen.getByText("Paris")).toBeInTheDocument();
  });

  it("displays formatted creation date", () => {
    render(<Informations report={mockReport} userTimezone="Europe/Paris" />);

    // The mock should format the date
    expect(
      screen.getByText(
        new Date().toLocaleString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("displays default number of responses", () => {
    render(<Informations report={mockReport} userTimezone="Europe/Paris" />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("returns null when request is null", () => {
    const { container } = render(
      <Informations report={null} userTimezone="Europe/Paris" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders with horizontal line separator", () => {
    render(<Informations report={mockReport} userTimezone="Europe/Paris" />);

    const hr = document.querySelector("hr");
    expect(hr).toBeInTheDocument();
  });

  it("applies correct heading style", () => {
    render(<Informations report={mockReport} userTimezone="Europe/Paris" />);

    const heading = screen.getByText("Informations");
    expect(heading.tagName).toBe("H5");
    expect(heading).toHaveClass("mb-4");
  });

  it("renders all Row components with allXs prop", () => {
    render(<Informations report={mockReport} userTimezone="Europe/Paris" />);

    // Check that all the information labels are present
    const labels = ["Date de création", "Territoire", "Nombre de réponses"];

    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
