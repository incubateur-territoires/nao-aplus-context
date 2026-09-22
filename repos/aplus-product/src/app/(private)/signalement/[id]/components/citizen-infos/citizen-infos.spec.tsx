import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { CitizenInfos } from "./citizen-infos";
import {
  OrganizationRole,
  ReportStatus,
  TeamType,
} from "@/generated/prisma/client";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

// Mock the format utility
jest.mock("@/utils/format", () => ({
  formatPhoneNumber: jest.fn((phone: string) =>
    phone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5"),
  ),
  formatDate: jest.fn((date: Date | string) =>
    new Date(date).toLocaleDateString("fr-FR"),
  ),
}));

describe("CitizenInfos", () => {
  const mockReport = {
    id: "1",
    firstName: "Jean",
    lastName: "Dupont",
    birthDate: "1990-05-15",
    authorId: "author1",
    phone: "0123456789",
    profession: "Developer",
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
        ...createMockReportTeam({
          id: "group1",
          name: "CAF",
          organizationId: "struct1",
          role: OrganizationRole.OPERATOR,
        }),
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
      ...createMockReportTeam({
        id: "group1",
        name: "Maison France Services",
        organizationId: "struct1",
        role: OrganizationRole.OPERATOR,
      }),
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
    },
    colleagues: [],
    coAuthors: [],
    coAuthorsId: [],
    userId: null,
    lastAnswerAt: null,
    overdueAt: null,
    answers: [],
    statusHistory: [],
  };

  it("renders citizen information correctly", () => {
    render(<CitizenInfos report={mockReport} userTimezone="Europe/Paris" />);

    expect(screen.getByText("Citoyen")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Date de naissance")).toBeInTheDocument();
    expect(screen.getByText("Numéro de téléphone")).toBeInTheDocument();
    expect(screen.getByText("01 23 45 67 89")).toBeInTheDocument();
  });

  it("renders NIR when provided", () => {
    render(<CitizenInfos report={mockReport} userTimezone="Europe/Paris" />);

    expect(
      screen.getAllByText("Numéro de sécurité sociale NIR").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("1901234567890")).toBeInTheDocument();
  });

  it("renders CAF when provided", () => {
    render(<CitizenInfos report={mockReport} userTimezone="Europe/Paris" />);

    expect(screen.getAllByText("Identifiant CAF").length).toBeGreaterThan(0);
    expect(screen.getByText("CAF123456")).toBeInTheDocument();
  });

  it("renders NIF when provided", () => {
    render(<CitizenInfos report={mockReport} userTimezone="Europe/Paris" />);

    expect(
      screen.getAllByText("Numéro d'identification fiscale NIF").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("NIF789012")).toBeInTheDocument();
  });

  it("does not render NIR section when not provided and not required", () => {
    const requestWithoutNIR = {
      ...mockReport,
      nir: null,
      requestedTeams: [
        {
          ...mockReport.requestedTeams[0],
          organization: {
            ...mockReport.requestedTeams[0].organization,
            specificFields: [],
          },
        },
      ],
    };
    render(
      <CitizenInfos report={requestWithoutNIR} userTimezone="Europe/Paris" />,
    );

    expect(
      screen.queryByText("Numéro de sécurité sociale NIR"),
    ).not.toBeInTheDocument();
  });

  it("renders NIR section with 'cannot provide' message when null but required", () => {
    const requestWithoutNIR = {
      ...mockReport,
      nir: null,
      requestedTeams: [
        {
          ...mockReport.requestedTeams[0],
          organization: {
            ...mockReport.requestedTeams[0].organization,
            specificFields: [
              {
                id: "field1",
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
      ],
    };
    render(
      <CitizenInfos report={requestWithoutNIR} userTimezone="Europe/Paris" />,
    );

    expect(
      screen.getByText("Numéro de sécurité sociale NIR"),
    ).toBeInTheDocument();
    expect(screen.getByText("Non disponible")).toBeInTheDocument();
    expect(
      screen.getByText(/Le citoyen ne peut pas fournir son numéro NIR/i),
    ).toBeInTheDocument();
  });

  it("does not render CAF section when not provided and not required", () => {
    const requestWithoutCAF = {
      ...mockReport,
      caf: null,
      requestedTeams: [
        {
          ...mockReport.requestedTeams[0],
          organization: {
            ...mockReport.requestedTeams[0].organization,
            specificFields: [],
          },
        },
      ],
    };
    render(
      <CitizenInfos report={requestWithoutCAF} userTimezone="Europe/Paris" />,
    );

    expect(screen.queryByText("Identifiant CAF")).not.toBeInTheDocument();
  });

  it("renders CAF section with 'cannot provide' message when null but required", () => {
    const requestWithoutCAF = {
      ...mockReport,
      caf: null,
      requestedTeams: [
        {
          ...mockReport.requestedTeams[0],
          organization: {
            ...mockReport.requestedTeams[0].organization,
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
    };
    render(
      <CitizenInfos report={requestWithoutCAF} userTimezone="Europe/Paris" />,
    );

    expect(screen.getByText("Identifiant CAF")).toBeInTheDocument();
    expect(screen.getByText("Non disponible")).toBeInTheDocument();
    expect(
      screen.getByText(/Le citoyen ne peut pas fournir son identifiant CAF/i),
    ).toBeInTheDocument();
  });

  it("does not render NIF section when not provided and not required", () => {
    const requestWithoutNIF = {
      ...mockReport,
      nif: null,
      maritalName: null,
      requestedTeams: [
        {
          ...mockReport.requestedTeams[0],
          organization: {
            ...mockReport.requestedTeams[0].organization,
            specificFields: [],
          },
        },
      ],
    };
    render(
      <CitizenInfos report={requestWithoutNIF} userTimezone="Europe/Paris" />,
    );

    expect(
      screen.queryByText("Numéro d'identification fiscale NIF"),
    ).not.toBeInTheDocument();
  });

  it("renders NIF section with 'cannot provide' message when null but required", () => {
    const requestWithoutNIF = {
      ...mockReport,
      nif: null,
      maritalName: null,
      requestedTeams: [
        {
          ...mockReport.requestedTeams[0],
          organization: {
            ...mockReport.requestedTeams[0].organization,
            specificFields: [
              {
                id: "field1",
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
    };
    render(
      <CitizenInfos report={requestWithoutNIF} userTimezone="Europe/Paris" />,
    );

    expect(
      screen.getByText("Numéro d'identification fiscale NIF"),
    ).toBeInTheDocument();
    expect(screen.getByText("Non disponible")).toBeInTheDocument();
    expect(
      screen.getByText(/Le citoyen ne peut pas fournir son numéro NIF/i),
    ).toBeInTheDocument();
  });

  it("returns null when request is null", () => {
    const { container } = render(
      <CitizenInfos report={null} userTimezone="Europe/Paris" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("handles missing phone number gracefully", () => {
    const requestWithoutPhone = { ...mockReport, phone: null };
    render(
      <CitizenInfos report={requestWithoutPhone} userTimezone="Europe/Paris" />,
    );

    // Should not render phone section when phone is null
    expect(screen.queryByText("Numéro de téléphone")).not.toBeInTheDocument();
  });

  it("displays marital name when present", () => {
    const reportWithMaritalName = {
      ...mockReport,
      maritalName: "Dupont-Martin",
    };
    render(
      <CitizenInfos
        report={reportWithMaritalName}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("Nom marital")).toBeInTheDocument();
    expect(screen.getByText("Dupont-Martin")).toBeInTheDocument();
  });

  it("does not display marital name when null", () => {
    const reportWithoutMaritalName = { ...mockReport, maritalName: null };
    render(
      <CitizenInfos
        report={reportWithoutMaritalName}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.queryByText("Nom marital")).not.toBeInTheDocument();
  });

  it("handles missing birth date gracefully", () => {
    const requestWithoutBirthDate = {
      ...mockReport,
      birthDate: null as unknown as string,
    };
    render(
      <CitizenInfos
        report={requestWithoutBirthDate}
        userTimezone="Europe/Paris"
      />,
    );

    // Should not render birth date section when birthDate is null
    expect(screen.queryByText("Date de naissance")).not.toBeInTheDocument();
  });

  it("renders copy buttons for sensitive information", () => {
    render(<CitizenInfos report={mockReport} userTimezone="Europe/Paris" />);

    // Check that copy buttons are present for NIR, CAF, and NIF
    const copyButtons = screen.getAllByText("Copier");
    expect(copyButtons).toHaveLength(3); // NIR, CAF, and NIF
  });

  it("does not render copy button when field value is null", () => {
    const reportWithNullNIR = {
      ...mockReport,
      nir: null,
      requestedTeams: [
        {
          ...mockReport.requestedTeams[0],
          organization: {
            ...mockReport.requestedTeams[0].organization,
            specificFields: [
              {
                id: "field1",
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
      ],
    };
    render(
      <CitizenInfos report={reportWithNullNIR} userTimezone="Europe/Paris" />,
    );

    // Should show the field but without copy button
    expect(
      screen.getByText("Numéro de sécurité sociale NIR"),
    ).toBeInTheDocument();
    expect(screen.getByText("Non disponible")).toBeInTheDocument();
    // Copy button should not be present for null values
    const copyButtons = screen.queryAllByText("Copier");
    expect(copyButtons.length).toBeLessThan(3);
  });

  it("applies correct CSS classes to main sections", () => {
    render(<CitizenInfos report={mockReport} userTimezone="Europe/Paris" />);

    const sections = document.querySelectorAll(".bg-blue-background");
    expect(sections).toHaveLength(4); // Main citizen info + NIR + CAF + NIF

    sections.forEach((section) => {
      expect(section).toHaveClass("p-6", "h-fit");
    });
  });

  it("renders horizontal divider in main section", () => {
    render(<CitizenInfos report={mockReport} userTimezone="Europe/Paris" />);

    const hr = document.querySelector("hr");
    expect(hr).toBeInTheDocument();
  });
});
