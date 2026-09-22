import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTeamContent } from "./create-team-content";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import {
  MOCK_IDS,
  createMockOrganizationFull,
  createMockArea,
} from "@/test/mocks";
import { ROUTE } from "@/app/constant/route";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { USER_ROLES } from "@/constants/user-roles";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
  keepPreviousData: "keepPreviousData",
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: jest.fn(),
}));

const mockOrganization1 = {
  ...createMockOrganizationFull({
    id: MOCK_IDS.ORG_1,
    name: "France Services",
    shortName: "FS",
    role: OrganizationRole.HELPER,
    type: TeamType.FRANCE_SERVICE,
  }),
};

const mockOrganization2 = {
  ...createMockOrganizationFull({
    id: "org-2",
    name: "Préfecture",
    shortName: "PREF",
    role: OrganizationRole.OPERATOR,
    type: TeamType.OPERATOR,
  }),
};

const mockArea1 = createMockArea({
  id: MOCK_IDS.AREA_1,
  name: "Pas-de-Calais",
});
const mockArea2 = createMockArea({ id: MOCK_IDS.AREA_2, name: "Nord" });

function setupMocks({
  organizations = [mockOrganization1, mockOrganization2],
  areas = [mockArea1, mockArea2],
  existingTeams = [],
}: {
  organizations?: (typeof mockOrganization1)[];
  areas?: (typeof mockArea1)[];
  existingTeams?: Array<{
    id: string;
    name: string;
    email: string | null;
    areas: Array<{ id: string; name: string; inseeCode: string }>;
    organization: { shortName: string };
  }>;
} = {}) {
  const mockCreateTeam = jest.fn();
  const mockInvalidateQueries = jest.fn();

  (useSession as jest.Mock).mockReturnValue({
    data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    isPending: false,
  });

  (useTRPC as jest.Mock).mockReturnValue({
    organization: {
      getMyManagedOrganizations: {
        queryOptions: () => ({
          queryKey: ["organization", "getMyManagedOrganizations"],
        }),
      },
    },
    area: {
      getMyAreas: {
        queryOptions: () => ({ queryKey: ["area", "getMyAreas"] }),
      },
    },
    team: {
      createTeam: {
        mutationOptions: (opts: {
          onSuccess?: () => void;
          onError?: (error: Error) => void;
        }) => ({
          mutationKey: ["team", "createTeam"],
          onSuccess: opts?.onSuccess,
          onError: opts?.onError,
        }),
      },
      getExistingTeamsByOrganizationAndAreas: {
        queryOptions: () => ({
          queryKey: ["team", "getExistingTeamsByOrganizationAndAreas"],
        }),
      },
      getManagerInheritedTeamType: {
        queryOptions: () => ({
          queryKey: ["team", "getManagerInheritedTeamType"],
        }),
      },
    },
  });

  (useQuery as jest.Mock).mockImplementation((options) => {
    const queryKey = JSON.stringify(options.queryKey);
    if (queryKey.includes("organization")) {
      return { data: organizations, isLoading: false };
    }
    if (queryKey.includes("area")) {
      return { data: areas, isLoading: false };
    }
    if (queryKey.includes("getExistingTeamsByOrganizationAndAreas")) {
      return { data: existingTeams, isLoading: false };
    }
    return { data: null, isLoading: false };
  });

  (useMutation as jest.Mock).mockImplementation((mutationOptions) => {
    const mutateAsync = jest.fn(async (...args) => {
      try {
        const result = await mockCreateTeam(...args);
        if (mutationOptions?.onSuccess) {
          await mutationOptions.onSuccess(result, ...args, undefined);
        }
        return result;
      } catch (error) {
        const err = error as Error;
        if (mutationOptions?.onError) {
          mutationOptions.onError(err, ...args, undefined);
        }
      }
    });

    return {
      mutateAsync,
      isPending: false,
    };
  });

  (useQueryClient as jest.Mock).mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  });

  return { mockCreateTeam, mockInvalidateQueries };
}

async function selectArea(
  user: ReturnType<typeof userEvent.setup>,
  areaName: string,
) {
  // With disableCloseOnSelect the dropdown stays open after each pick —
  // clicking the input again would toggle it closed, so only open it when needed.
  if (!screen.queryByRole("listbox")) {
    const input = screen.getByPlaceholderText(
      "Choisissez un ou plusieurs départements",
    );
    await user.click(input);
  }
  const option = await screen.findByRole("option", {
    name: new RegExp(areaName),
  });
  await user.click(option);
}

describe("CreateTeamContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe("when user has multiple organizations", () => {
    it("renders organization select dropdown", () => {
      setupMocks();

      render(<CreateTeamContent />);

      expect(screen.getByLabelText(/Type d'organisation/)).toBeInTheDocument();
      expect(
        screen.getByText("Sélectionner une organisation"),
      ).toBeInTheDocument();
    });

    it("shows all organizations in dropdown", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const select = screen.getByLabelText(/Type d'organisation/);
      await user.click(select);

      expect(screen.getByText("FS - France Services")).toBeInTheDocument();
      expect(screen.getByText("PREF - Préfecture")).toBeInTheDocument();
    });
  });

  describe("when user has single organization", () => {
    it("renders organization name inline instead of select", () => {
      setupMocks({ organizations: [mockOrganization1] });

      render(<CreateTeamContent />);

      expect(screen.getByText(/FS - France Services/)).toBeInTheDocument();
      expect(
        screen.queryByRole("combobox", { name: /Type d'organisation/ }),
      ).not.toBeInTheDocument();
    });

    it("auto-sets organizationId in form", async () => {
      const { mockCreateTeam } = setupMocks({
        organizations: [mockOrganization1],
      });
      mockCreateTeam.mockResolvedValue({});
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "Test Team");

      const registrationInput = screen.getByLabelText(/Matricule/);
      await user.type(registrationInput, "12345");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            organizationId: MOCK_IDS.ORG_1,
          }),
        );
      });
    });
  });

  describe("area selection", () => {
    it("renders area autocomplete", () => {
      setupMocks();

      render(<CreateTeamContent />);

      expect(
        screen.getByPlaceholderText("Choisissez un ou plusieurs départements"),
      ).toBeInTheDocument();
    });

    it("allows selecting an area via autocomplete", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      await selectArea(user, "Pas-de-Calais");

      expect(
        screen.getByRole("button", { name: /Pas-de-Calais/ }),
      ).toBeInTheDocument();
    });

    it("allows selecting multiple areas", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      await selectArea(user, "Pas-de-Calais");
      await selectArea(user, "Nord");

      expect(
        screen.getByRole("button", { name: /Pas-de-Calais/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Nord/ })).toBeInTheDocument();
    });

    it("allows removing an area via tag dismiss", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      await selectArea(user, "Pas-de-Calais");

      const dismissButton = screen.getByRole("button", {
        name: /Pas-de-Calais/,
      });
      await user.click(dismissButton);

      expect(
        screen.queryByRole("button", { name: /Pas-de-Calais/ }),
      ).not.toBeInTheDocument();
    });

    it("selects all areas via Tout sélectionner", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const input = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );
      await user.click(input);

      const toggle = await screen.findByRole("option", {
        name: /Tout sélectionner/,
      });
      await user.click(toggle);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Pas-de-Calais/ }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Nord/ }),
        ).toBeInTheDocument();
      });
    });

    it("deselects all areas via Tout désélectionner", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const input = screen.getByPlaceholderText(
        "Choisissez un ou plusieurs départements",
      );

      // Select all
      if (!screen.queryByRole("listbox")) await user.click(input);
      const toggle = await screen.findByRole("option", {
        name: /Tout sélectionner/,
      });
      await user.click(toggle);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Pas-de-Calais/ }),
        ).toBeInTheDocument();
      });

      // Reopen dropdown (Escape closes it if still open, then click opens it)
      await user.keyboard("{Escape}");
      await user.click(input);

      const deselect = await screen.findByRole("option", {
        name: /Tout désélectionner/,
      });
      await user.click(deselect);

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /Pas-de-Calais/ }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /Nord/ }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("renders all form fields", () => {
      setupMocks();

      render(<CreateTeamContent />);

      expect(screen.getByLabelText(/Type d'organisation/)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Choisissez un ou plusieurs départements"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Nom de l'équipe/)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Adresse e-mail de l'équipe/),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Créer l'équipe/ }),
      ).toBeInTheDocument();
    });

    it("renders Matricule field when France Services organization is selected", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      expect(screen.getByLabelText(/Matricule/)).toBeInTheDocument();
    });

    it("does not render Matricule field when non-France Services organization is selected", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-2");

      expect(screen.queryByLabelText(/Matricule/)).not.toBeInTheDocument();
    });

    it("requires Matricule field when France Services organization is selected", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "Test Team");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Le matricule est obligatoire pour France Services.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("allows submission when France Services organization is selected with registrationNumber", async () => {
      const { mockCreateTeam, mockInvalidateQueries } = setupMocks();
      mockCreateTeam.mockResolvedValue({});
      mockInvalidateQueries.mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "Test Team");

      const registrationInput = screen.getByLabelText(/Matricule/);
      await user.type(registrationInput, "12345");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Test Team",
            organizationId: MOCK_IDS.ORG_1,
            registrationNumber: "12345",
          }),
        );
      });
    });

    it("allows submission when non-France Services organization is selected without registrationNumber", async () => {
      const { mockCreateTeam, mockInvalidateQueries } = setupMocks();
      mockCreateTeam.mockResolvedValue({});
      mockInvalidateQueries.mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-2");

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "Test Team");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Test Team",
            organizationId: "org-2",
            registrationNumber: null,
          }),
        );
      });
    });

    it("submits form successfully and navigates to the created team page", async () => {
      const { mockCreateTeam, mockInvalidateQueries } = setupMocks();
      mockCreateTeam.mockResolvedValue({ id: "new-team-id" });
      mockInvalidateQueries.mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-2");

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "Test Team");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Test Team",
            organizationId: "org-2",
            areaIds: [MOCK_IDS.AREA_1],
          }),
        );
      });

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: [["team", "getMyTeams"]],
        });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`${ROUTE.TEAMS}/new-team-id`);
      });
    });

    it("displays error message when form submission fails", async () => {
      const { mockCreateTeam } = setupMocks();
      const errorMessage = "Une erreur est survenue";
      mockCreateTeam.mockRejectedValue({ message: errorMessage });
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-2");

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "Test Team");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it("displays default error message when form submission fails without error message", async () => {
      const { mockCreateTeam } = setupMocks();
      mockCreateTeam.mockRejectedValue({ message: "" });
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-2");

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "Test Team");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Une erreur est survenue lors de la création de l'équipe",
          ),
        ).toBeInTheDocument();
      });
    });

    it("displays the duplicate matricule error at the field level, not as a page-level alert", async () => {
      const { mockCreateTeam } = setupMocks();
      mockCreateTeam.mockRejectedValue({
        message:
          "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
      });
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      await user.type(screen.getByLabelText(/Nom de l'équipe/), "Test Team");
      await user.type(screen.getByLabelText(/Matricule/), "12345");
      await selectArea(user, "Pas-de-Calais");

      await user.click(screen.getByRole("button", { name: /Créer l'équipe/ }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
          ),
        ).toBeInTheDocument();
      });

      const group = screen
        .getByLabelText(/Matricule/)
        .closest("[class*='fr-input-group']");
      expect(group).toHaveTextContent(
        "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
      );
      expect(
        document.querySelector(".fr-alert--error"),
      ).not.toBeInTheDocument();
    });

    it("clears the matricule field error when the user edits the matricule", async () => {
      const { mockCreateTeam } = setupMocks();
      mockCreateTeam.mockRejectedValue({
        message:
          "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
      });
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      await user.type(screen.getByLabelText(/Nom de l'équipe/), "Test Team");
      await user.type(screen.getByLabelText(/Matricule/), "12345");
      await selectArea(user, "Pas-de-Calais");

      await user.click(screen.getByRole("button", { name: /Créer l'équipe/ }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
          ),
        ).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Matricule/), "6");

      await waitFor(() => {
        expect(
          screen.queryByText(
            "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
          ),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("team type selection", () => {
    it("sends OPERATOR type when operator organization is selected", async () => {
      const { mockCreateTeam } = setupMocks();
      mockCreateTeam.mockResolvedValue({});
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-2");

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "Operator Team");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            type: TeamType.OPERATOR,
          }),
        );
      });
    });

    it("auto-selects FRANCE_SERVICE type when France Services organization is selected", async () => {
      const { mockCreateTeam } = setupMocks();
      mockCreateTeam.mockResolvedValue({});
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      const nameInput = screen.getByLabelText(/Nom de l'équipe/);
      await user.type(nameInput, "FS Team");

      const registrationInput = screen.getByLabelText(/Matricule/);
      await user.type(registrationInput, "12345");

      await selectArea(user, "Pas-de-Calais");

      const submitButton = screen.getByRole("button", {
        name: /Créer l'équipe/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            type: TeamType.FRANCE_SERVICE,
          }),
        );
      });
    });

    it("does not show type radio buttons for operator organization", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-2");

      expect(
        screen.queryByText("Catégorie de l'équipe aidante"),
      ).not.toBeInTheDocument();
    });

    it("does not show category until an organization is selected", () => {
      setupMocks();

      render(<CreateTeamContent />);

      expect(
        screen.queryByText("Catégorie de l'équipe aidante"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Catégorie de l'équipe"),
      ).not.toBeInTheDocument();
    });

    it("shows disabled radio for operator organization", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-2");

      expect(screen.getByText("Catégorie de l'équipe")).toBeInTheDocument();
      expect(screen.getByLabelText("Opérateurs")).toBeDisabled();
    });

    it("shows disabled radio for France Services organization", async () => {
      setupMocks();
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      expect(
        screen.getByText("Catégorie de l'équipe aidante"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("France Services")).toBeDisabled();
    });

    it("nomme le fieldset « Catégorie de l'équipe aidante » par sa légende et décrit l'erreur via aria-describedby (a11y)", async () => {
      const helperOrganization = createMockOrganizationFull({
        id: "org-helper",
        name: "Travailleurs sociaux",
        shortName: "TS",
        role: OrganizationRole.HELPER,
        type: TeamType.HISTORICAL_SOCIAL_WORKER,
      });
      setupMocks({ organizations: [helperOrganization, mockOrganization2] });
      const user = userEvent.setup();

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, "org-helper");

      const fieldset = document.getElementById("type");
      expect(fieldset).toBeInTheDocument();
      // Le nom du groupe = la légende uniquement (pas le message d'erreur).
      expect(fieldset).toHaveAttribute("aria-labelledby", "type-legend");
      // Le message d'erreur est exposé comme description, pas comme nom.
      expect(fieldset).toHaveAttribute("aria-describedby", "type-messages");
      // Le groupe de messages cité existe dans le DOM.
      expect(document.getElementById("type-messages")).toBeInTheDocument();
    });
  });

  describe("existing teams alert", () => {
    it("renders ExistingTeamsAlert when existing teams are found", async () => {
      const user = userEvent.setup();
      const existingTeams = [
        {
          id: "existing-team-1",
          name: "Équipe Existante",
          email: "existing@example.com",
          areas: [
            { id: MOCK_IDS.AREA_1, name: "Pas-de-Calais", inseeCode: "62" },
          ],
          organization: { shortName: "FS" },
        },
      ];

      setupMocks({ existingTeams });

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      await selectArea(user, "Pas-de-Calais");

      await waitFor(() => {
        expect(screen.getByText("Équipes déjà existantes")).toBeInTheDocument();
        expect(screen.getByText("Équipe Existante")).toBeInTheDocument();
      });
    });

    it("does not render ExistingTeamsAlert when no existing teams are found", async () => {
      const user = userEvent.setup();
      setupMocks({ existingTeams: [] });

      render(<CreateTeamContent />);

      const orgSelect = screen.getByLabelText(/Type d'organisation/);
      await user.selectOptions(orgSelect, MOCK_IDS.ORG_1);

      await selectArea(user, "Pas-de-Calais");

      expect(
        screen.queryByText("Équipes déjà existantes"),
      ).not.toBeInTheDocument();
    });

    it("does not render ExistingTeamsAlert when no areas are selected", async () => {
      setupMocks({
        existingTeams: [
          {
            id: "existing-team-1",
            name: "Équipe Existante",
            email: "existing@example.com",
            areas: [
              { id: MOCK_IDS.AREA_1, name: "Pas-de-Calais", inseeCode: "62" },
            ],
            organization: { shortName: "FS" },
          },
        ],
      });

      render(<CreateTeamContent />);

      expect(
        screen.queryByText("Équipes déjà existantes"),
      ).not.toBeInTheDocument();
    });
  });
});
