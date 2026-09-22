import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthorInfos } from "./author-infos";
import {
  OrganizationRole,
  ReportStatus,
  TeamType,
} from "@/generated/prisma/client";
import {
  MOCK_IDS,
  MOCK_DATES,
  createMockReportTeam,
  createMockTeam,
  createMockUser,
  USER_ROLES,
} from "@/test/mocks";

// Mock useSession for UserLink component
jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "current-user",
        email: "test@example.com",
        role: "user", // Non-admin user - links won't be displayed
      },
    },
    isPending: false,
  }),
}));

describe("AuthorInfos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockReport = {
    id: MOCK_IDS.REPORT_1,
    firstName: "Jean",
    lastName: "Dupont",
    birthDate: "1990-05-15",
    authorId: MOCK_IDS.USER_1,
    phone: "0123456789",
    nir: "1901234567890",
    caf: "CAF123456",
    nif: "NIF789012",
    maritalName: null,
    subject: "Test subject",
    description: "Test description",
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    areaId: MOCK_IDS.AREA_1,
    applicantTeamId: MOCK_IDS.TEAM_1,
    citizenPermissionConfirmed: true,
    organizationId: MOCK_IDS.ORG_1,
    status: ReportStatus.PENDING_ASSIGNMENT,
    author: {
      id: MOCK_IDS.USER_1,
      firstName: "Jean",
      lastName: "Dupont",
      phone: "0123456789",
      profession: "Developer",
      createdAt: MOCK_DATES.JAN_1_2024,
      updatedAt: MOCK_DATES.JAN_1_2024,
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
      id: MOCK_IDS.AREA_1,
      name: "Paris",
      timezone: "Europe/Paris",
      createdAt: MOCK_DATES.JAN_1_2024,
      updatedAt: MOCK_DATES.JAN_1_2024,
      inseeCode: "75000",
    },
    requestedTeams: [
      {
        ...createMockReportTeam({
          id: MOCK_IDS.TEAM_1,
          name: "CAF",
          organizationId: MOCK_IDS.ORG_1,
          role: OrganizationRole.OPERATOR,
        }),
        organization: {
          id: MOCK_IDS.ORG_1,
          name: "Structure Test",
          shortName: "ST",
          createdAt: MOCK_DATES.JAN_1_2024,
          updatedAt: MOCK_DATES.JAN_1_2024,
          id_v1: "struct1_v1",
          additionalInformation: null,
          specificFields: [],
          role: OrganizationRole.OPERATOR,
          type: TeamType.OPERATOR,
        },
      },
    ],
    applicantTeam: {
      ...createMockReportTeam({
        id: MOCK_IDS.TEAM_1,
        name: "Maison France Services",
        organizationId: MOCK_IDS.ORG_1,
        role: OrganizationRole.OPERATOR,
      }),
      organization: {
        id: MOCK_IDS.ORG_1,
        name: "Structure Test",
        shortName: "ST",
        createdAt: MOCK_DATES.JAN_1_2024,
        updatedAt: MOCK_DATES.JAN_1_2024,
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

  it("renders helpers section correctly", () => {
    render(<AuthorInfos report={mockReport} />);

    expect(screen.getByText("Auteur")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Maison France Services")).toBeInTheDocument();
  });

  it("renders with horizontal line separator", () => {
    render(<AuthorInfos report={mockReport} />);

    const hr = document.querySelector("hr");
    expect(hr).toBeInTheDocument();
  });

  it("returns null when request is null", () => {
    const { container } = render(<AuthorInfos report={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies correct heading style", () => {
    render(<AuthorInfos report={mockReport} />);

    const heading = screen.getByText("Auteur");
    expect(heading.tagName).toBe("H5");
    expect(heading).toHaveClass("mb-4");
  });

  it("renders Row component with boldReversed prop", () => {
    render(<AuthorInfos report={mockReport} />);

    // Check that the helper name is rendered as the label
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    // Check that the organization is rendered as the value
    expect(screen.getByText("Maison France Services")).toBeInTheDocument();
  });

  it("displays inactive author with (inactif) suffix", () => {
    const inactiveReport = {
      ...mockReport,
      author: {
        ...mockReport.author,
        isInactive: new Date(),
      },
    };
    render(<AuthorInfos report={inactiveReport} />);

    expect(screen.getByText("Jean Dupont (inactif)")).toBeInTheDocument();
  });

  it("renders co-authors section when coAuthors exist", () => {
    const reportWithCoAuthors = {
      ...mockReport,
      coAuthors: [
        {
          ...createMockUser({
            id: "co-author-1",
            firstName: "Marie",
            lastName: "Martin",
          }),
          hasViewed: false,
        },
        {
          ...createMockUser({
            id: "co-author-2",
            firstName: "Paul",
            lastName: "Bernard",
          }),
          hasViewed: false,
        },
      ],
    };
    render(<AuthorInfos report={reportWithCoAuthors} />);

    expect(screen.getByText("Co-auteurs")).toBeInTheDocument();
    expect(screen.getByText("Marie Martin")).toBeInTheDocument();
    expect(screen.getByText("Paul Bernard")).toBeInTheDocument();
  });

  it("sorts co-authors by last name", () => {
    const reportWithCoAuthors = {
      ...mockReport,
      coAuthors: [
        {
          ...createMockUser({
            id: "1",
            firstName: "Zoé",
            lastName: "Zorro",
          }),
          hasViewed: false,
        },
        {
          ...createMockUser({
            id: "2",
            firstName: "Alice",
            lastName: "Adam",
          }),
          hasViewed: false,
        },
      ],
    };
    render(<AuthorInfos report={reportWithCoAuthors} />);

    const coAuthorNames = screen
      .getAllByText(/Adam|Zorro/)
      .map((el) => el.textContent);
    expect(coAuthorNames[0]).toBe("Alice Adam");
    expect(coAuthorNames[1]).toBe("Zoé Zorro");
  });

  it("affiche le nom de leur équipe pour les co-auteurs hors équipe autrice", () => {
    const reportWithCoAuthors = {
      ...mockReport,
      coAuthors: [
        {
          ...createMockUser({
            id: "co-author-1",
            firstName: "Marie",
            lastName: "Martin",
            teams: [createMockTeam({ id: "other-team", name: "Autre équipe" })],
          }),
          hasViewed: false,
        },
      ],
    };
    render(<AuthorInfos report={reportWithCoAuthors} />);

    expect(screen.getByText("Autre équipe")).toBeInTheDocument();
  });

  it("n'affiche pas le nom d'une équipe supprimée pour un co-auteur hors équipe autrice", () => {
    const reportWithCoAuthors = {
      ...mockReport,
      coAuthors: [
        {
          ...createMockUser({
            id: "co-author-1",
            firstName: "Marie",
            lastName: "Martin",
            teams: [
              createMockTeam({
                id: "other-team",
                name: "Équipe fermée",
                deletedAt: new Date("2024-06-01"),
              }),
            ],
          }),
          hasViewed: false,
        },
      ],
    };
    render(<AuthorInfos report={reportWithCoAuthors} />);

    expect(screen.queryByText("Équipe fermée")).not.toBeInTheDocument();
  });

  describe("when applicant team is deleted", () => {
    const deletedTeamReport = {
      ...mockReport,
      applicantTeam: {
        ...mockReport.applicantTeam,
        deletedAt: new Date("2024-06-01"),
      },
    };

    it("displays 'Équipe supprimée' instead of team name for author", () => {
      render(<AuthorInfos report={deletedTeamReport} />);

      expect(screen.getByText("Équipe supprimée")).toBeInTheDocument();
      expect(
        screen.queryByText("Maison France Services"),
      ).not.toBeInTheDocument();
    });

    it("displays 'Équipe supprimée' for co-authors who are members of the deleted team", () => {
      const reportWithCoAuthors = {
        ...deletedTeamReport,
        coAuthors: [
          {
            ...createMockUser({
              id: "co-author-1",
              firstName: "Marie",
              lastName: "Martin",
              teams: [
                createMockTeam({
                  id: MOCK_IDS.TEAM_1,
                  name: "Maison France Services",
                }),
              ],
            }),
            hasViewed: false,
          },
        ],
      };
      render(<AuthorInfos report={reportWithCoAuthors} />);

      const deletedLabels = screen.getAllByText("Équipe supprimée");
      expect(deletedLabels).toHaveLength(2);
    });

    it("does not display 'Équipe supprimée' for co-authors who are not members of the deleted team", () => {
      const reportWithCoAuthors = {
        ...deletedTeamReport,
        coAuthors: [
          {
            ...createMockUser({
              id: "co-author-1",
              firstName: "Marie",
              lastName: "Martin",
              teams: [
                createMockTeam({ id: "other-team", name: "Autre équipe" }),
              ],
            }),
            hasViewed: false,
          },
        ],
      };
      render(<AuthorInfos report={reportWithCoAuthors} />);

      const deletedLabels = screen.getAllByText("Équipe supprimée");
      // Only the author should have "Équipe supprimée", not the co-author
      expect(deletedLabels).toHaveLength(1);
    });
  });

  it("falls back to the organization name when shortName is empty", () => {
    const reportWithoutShortName = {
      ...mockReport,
      applicantTeam: {
        ...mockReport.applicantTeam,
        organization: {
          ...mockReport.applicantTeam.organization,
          shortName: "",
        },
      },
    };
    render(<AuthorInfos report={reportWithoutShortName} />);

    // OrgPicto derives its label from the org name ("Structure Test" -> "STR")
    expect(screen.getByText("STR")).toBeInTheDocument();
  });

  describe("co-auteurs : comportement « voir plus » (plus de 5)", () => {
    const FADE_MASK =
      "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 55%)";

    const CO_AUTHOR_NAMES: [string, string][] = [
      ["Alice", "Alpha"],
      ["Bruno", "Bravo"],
      ["Carla", "Charlie"],
      ["David", "Delta"],
      ["Emma", "Echo"],
      ["Felix", "Foxtrot"],
      ["Gaby", "Golf"],
    ];

    function reportWithCoAuthors(count: number) {
      return {
        ...mockReport,
        coAuthors: CO_AUTHOR_NAMES.slice(0, count).map(
          ([firstName, lastName], index) => ({
            ...createMockUser({
              id: `co-author-${index}`,
              firstName,
              lastName,
              teams: [],
            }),
            hasViewed: false,
          }),
        ),
      };
    }

    function rowContainer(name: string) {
      return screen.getByText(name).closest("li.flex.items-center.gap-3");
    }

    it("affiche seulement les 5 premiers co-auteurs et un bouton « voir tous »", () => {
      render(<AuthorInfos report={reportWithCoAuthors(6)} />);

      expect(screen.getByText("Alice Alpha")).toBeInTheDocument();
      expect(screen.getByText("Emma Echo")).toBeInTheDocument();
      expect(screen.queryByText("Felix Foxtrot")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Voir tous les co-auteurs/i }),
      ).toBeInTheDocument();
    });

    it("le bouton est replié par défaut : aria-expanded=false et classe -mt-4", () => {
      render(<AuthorInfos report={reportWithCoAuthors(6)} />);

      const button = screen.getByRole("button", {
        name: /Voir tous les co-auteurs/i,
      });
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveClass("-mt-4");
    });

    it("applique le masque dégradé sur le dernier co-auteur visible quand c'est replié", () => {
      render(<AuthorInfos report={reportWithCoAuthors(6)} />);

      expect(rowContainer("Emma Echo")).toHaveStyle({ maskImage: FADE_MASK });
      expect(rowContainer("Alice Alpha")).not.toHaveStyle({
        maskImage: FADE_MASK,
      });
    });

    it("développe la liste, retire le masque et déplace le focus sur le 6e co-auteur au clic", async () => {
      const user = userEvent.setup();
      render(<AuthorInfos report={reportWithCoAuthors(6)} />);

      await user.click(
        screen.getByRole("button", { name: /Voir tous les co-auteurs/i }),
      );

      expect(screen.getByText("Felix Foxtrot")).toBeInTheDocument();
      const button = screen.getByRole("button", { name: /Voir moins/i });
      expect(button).toHaveAttribute("aria-expanded", "true");
      expect(button).not.toHaveClass("-mt-4");
      expect(rowContainer("Emma Echo")).not.toHaveStyle({
        maskImage: FADE_MASK,
      });

      const sixth = rowContainer("Felix Foxtrot");
      expect(sixth).toHaveAttribute("tabindex", "-1");
      await waitFor(() => expect(sixth).toHaveFocus());
    });

    it("replie de nouveau la liste au clic sur « voir moins »", async () => {
      const user = userEvent.setup();
      render(<AuthorInfos report={reportWithCoAuthors(6)} />);

      await user.click(
        screen.getByRole("button", { name: /Voir tous les co-auteurs/i }),
      );
      await user.click(screen.getByRole("button", { name: /Voir moins/i }));

      expect(screen.queryByText("Felix Foxtrot")).not.toBeInTheDocument();
      expect(rowContainer("Emma Echo")).toHaveStyle({ maskImage: FADE_MASK });
      expect(
        screen.getByRole("button", { name: /Voir tous les co-auteurs/i }),
      ).toHaveAttribute("aria-expanded", "false");
    });

    it("n'affiche ni bouton ni masque quand il y a exactement 5 co-auteurs", () => {
      render(<AuthorInfos report={reportWithCoAuthors(5)} />);

      expect(screen.getByText("Emma Echo")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(rowContainer("Emma Echo")).not.toHaveStyle({
        maskImage: FADE_MASK,
      });
    });
  });

  describe("picto « œil » : co-auteur ayant consulté la demande", () => {
    const EYE_LABEL = "A consulté le signalement";

    function rowContainer(name: string) {
      return screen.getByText(name).closest("li.flex.items-center.gap-3");
    }

    function reportWithCoAuthors(viewedIds: string[] = []) {
      return {
        ...mockReport,
        coAuthors: [
          {
            ...createMockUser({
              id: "co-author-1",
              firstName: "Marie",
              lastName: "Martin",
              teams: [],
            }),
            hasViewed: viewedIds.includes("co-author-1"),
          },
          {
            ...createMockUser({
              id: "co-author-2",
              firstName: "Paul",
              lastName: "Bernard",
              teams: [],
            }),
            hasViewed: viewedIds.includes("co-author-2"),
          },
        ],
      };
    }

    it("n'affiche jamais le picto pour l'auteur", () => {
      render(<AuthorInfos report={mockReport} />);

      expect(screen.queryByText(EYE_LABEL)).not.toBeInTheDocument();
    });

    it("n'affiche aucun picto quand aucun co-auteur n'a consulté la demande", () => {
      render(<AuthorInfos report={reportWithCoAuthors()} />);

      expect(screen.queryByText(EYE_LABEL)).not.toBeInTheDocument();
    });

    it("affiche le picto pour les seuls co-auteurs ayant consulté la demande", () => {
      render(<AuthorInfos report={reportWithCoAuthors(["co-author-1"])} />);

      const eyes = screen.getAllByText(EYE_LABEL);
      expect(eyes).toHaveLength(1);
      expect(rowContainer("Marie Martin")).toContainElement(eyes[0]);
      expect(rowContainer("Paul Bernard")).not.toContainElement(eyes[0]);
    });

    it("affiche le picto pour plusieurs co-auteurs ayant consulté la demande", () => {
      render(
        <AuthorInfos
          report={reportWithCoAuthors(["co-author-1", "co-author-2"])}
        />,
      );

      expect(screen.getAllByText(EYE_LABEL)).toHaveLength(2);
    });
  });
});
