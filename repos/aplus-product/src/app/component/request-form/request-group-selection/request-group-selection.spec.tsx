jest.mock("@/trpc/client", () => ({
  TRPCProvider: ({ children }: { children: React.ReactNode }) => children,
  useTRPC: () => ({
    team: {
      getActiveOperatorTeamsByAreaIds: {
        queryOptions: () => ({ queryKey: ["team", "operator"] }),
      },
      getNotInvitedTeamsByReportId: {
        queryOptions: () => ({ queryKey: ["team", "notInvited"] }),
      },
    },
  }),
}));

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestedGroupsSelection } from "./request-group-selection";
import { FormProvider, useForm, UseFormReturn } from "react-hook-form";
import { ReportFormValues } from "../request-form";

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn().mockImplementation((options) => {
    if (options?.queryKey?.includes("operator")) {
      return {
        data: [
          {
            id: "group3",
            name: "Pôle emploi",
            organization: {
              id: "struct2",
              name: "Lille",
              tags: [{ id: "tag3", name: "travail-formation" }],
              specificFields: [
                {
                  id: "caf",
                  name: "caf",
                  label: "Identifiant CAF",
                  hintText: "Pôle emploi a besoin du numéro identifiant CAF",
                  description: "Pôle emploi description",
                },
              ],
            },
          },
          {
            id: "group2",
            name: "CPAM",
            organization: {
              id: "struct1",
              name: "Pas-de-Calais",
              tags: [{ id: "tag2", name: "social-sante" }],
              specificFields: [
                {
                  id: "nir",
                  name: "nir",
                  label: "Numéro de sécurité sociale NIR",
                  hintText:
                    "La CPAM a besoin du numéro de sécurité sociale NIR",
                  description: "CPAM description",
                },
              ],
            },
          },
          {
            id: "group1",
            name: "CAF",
            organization: {
              id: "struct1",
              name: "Pas-de-Calais",
              tags: [{ id: "tag1", name: "social-sante" }],
              specificFields: [
                {
                  id: "caf",
                  name: "caf",
                  label: "Identifiant CAF",
                  hintText: "La CAF a besoin du numéro identifiant CAF",
                  description: "CAF description",
                },
              ],
            },
          },
          {
            id: "group5",
            name: "CPAM",
            organization: {
              id: "struct2",
              name: "Lille",
              tags: [{ id: "tag5", name: "social-sante" }],
              specificFields: [],
            },
          },
          {
            id: "group4",
            name: "CAF",
            organization: {
              id: "struct2",
              name: "Lille",
              tags: [{ id: "tag4", name: "social-sante" }],
              specificFields: [],
            },
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (options?.queryKey?.includes("getActiveGroupsByAreaIds")) {
      return {
        data: [
          {
            id: "group1",
            name: "CAF",
            structure: {
              id: "struct1",
              name: "Pas-de-Calais",
              tags: [{ name: "social-sante" }],
              specificFields: [
                {
                  id: "caf",
                  name: "caf",
                  label: "Identifiant CAF",
                  hintText: "La CAF a besoin du numéro identifiant CAF",
                  description: "CAF description",
                },
              ],
            },
          },
          {
            id: "group2",
            name: "CPAM",
            structure: {
              id: "struct1",
              name: "Pas-de-Calais",
              tags: [{ name: "social-sante" }],
              specificFields: [
                {
                  id: "nir",
                  name: "nir",
                  label: "Numéro de sécurité sociale NIR",
                  hintText:
                    "La CPAM a besoin du numéro de sécurité sociale NIR",
                  description: "CPAM description",
                },
              ],
            },
          },
          {
            id: "group3",
            name: "Pôle emploi",
            structure: {
              id: "struct2",
              name: "Lille",
              tags: [{ name: "travail-formation" }],
              specificFields: [
                {
                  id: "caf",
                  name: "caf",
                  label: "Identifiant CAF",
                  hintText: "Pôle emploi a besoin du numéro identifiant CAF",
                  description: "Pôle emploi description",
                },
              ],
            },
          },
          {
            id: "group4",
            name: "CAF",
            structure: {
              id: "struct2",
              name: "Lille",
              tags: [{ name: "social-sante" }],
              specificFields: [],
            },
          },
          {
            id: "group5",
            name: "CPAM",
            structure: {
              id: "struct2",
              name: "Lille",
              tags: [{ name: "social-sante" }],
              specificFields: [],
            },
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (options?.queryKey?.includes("user")) {
      return {
        data: {
          id: "user1",
          firstName: "John",
          lastName: "Doe",
          groups: [
            { id: "group1", name: "Group 1" },
            { id: "group2", name: "Group 2" },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    if (options?.queryKey?.includes("area")) {
      return {
        data: [
          { id: "area1", name: "Area 1" },
          { id: "area2", name: "Area 2" },
        ],
        isLoading: false,
        error: null,
      };
    }
    return {
      data: undefined,
      isLoading: false,
      error: null,
    };
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function Wrapper({ children }: { children: React.ReactNode }) {
  const methods = useForm({
    defaultValues: {
      organizations: [],
      caf: "",
      nir: "",
      area: [{ value: "area1", label: "Area 1" }],
      applicantTeam: [{ value: "team1", label: "Team 1" }],
      requestedGroups: [],
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("RequestedGroupsSelection", () => {
  it("renders the component", () => {
    render(<RequestedGroupsSelection />, { wrapper: Wrapper });
    expect(
      screen.getAllByText("Équipe(s) opérateur à contacter").length,
    ).toBeGreaterThan(0);
  });

  it("nomme le fieldset par les textes visibles et décrit l'erreur via aria-describedby (a11y)", () => {
    const { container } = render(<RequestedGroupsSelection />, {
      wrapper: Wrapper,
    });

    const fieldset = container.querySelector("#requested-teams-fieldset");
    expect(fieldset).toBeInTheDocument();
    // Le nom du groupe = textes visibles uniquement (pas le message d'erreur).
    expect(fieldset).toHaveAttribute(
      "aria-labelledby",
      "equipe-operateur-label equipe-operateur-hint",
    );
    // Le message d'erreur est exposé comme description.
    expect(fieldset).toHaveAttribute(
      "aria-describedby",
      "requested-teams-fieldset-messages",
    );
    // Les ids cités existent réellement dans le DOM.
    expect(
      container.querySelector("#equipe-operateur-label"),
    ).toHaveTextContent("Équipe(s) opérateur à contacter");
    expect(container.querySelector("#equipe-operateur-hint")).toHaveTextContent(
      "Veuillez choisir au moins une équipe opérateur",
    );
    expect(
      container.querySelector("#requested-teams-fieldset-messages"),
    ).toBeInTheDocument();
  });

  it("renders filters", () => {
    render(<RequestedGroupsSelection />, { wrapper: Wrapper });
    expect(screen.getByText("Filtrer par :")).toBeInTheDocument();
  });

  it("renders Filters component", () => {
    render(<RequestedGroupsSelection />, { wrapper: Wrapper });
    expect(screen.getByText("Filtrer par :")).toBeInTheDocument();
  });

  it("renders teams in alphabetical order", () => {
    render(<RequestedGroupsSelection />, { wrapper: Wrapper });
    const checkboxes = screen
      .getAllByRole("checkbox")
      .filter((cb) => cb.getAttribute("value") !== "hidden-checkbox");

    const teamNames = checkboxes.map((cb) => cb.getAttribute("value"));
    // CAF (group1), CAF (group4), CPAM (group2), CPAM (group5), Pôle emploi (group3)
    expect(teamNames).toEqual([
      "group1",
      "group4",
      "group2",
      "group5",
      "group3",
    ]);
  });

  describe("identity field cleanup when an operator is unchecked", () => {
    function setup() {
      let formRef!: UseFormReturn<ReportFormValues>;
      function FormWrapper({ children }: { children: React.ReactNode }) {
        const methods = useForm<ReportFormValues>({
          defaultValues: {
            area: [{ value: "area1", label: "Area 1" }],
            applicantTeam: [{ value: "team1", label: "Team 1" }],
            requestedTeams: [],
            caf: "",
            nir: "",
            nif: "",
          },
        });
        formRef = methods;
        return <FormProvider {...methods}>{children}</FormProvider>;
      }
      const utils = render(<RequestedGroupsSelection />, {
        wrapper: FormWrapper,
      });
      return { ...utils, getForm: () => formRef };
    }

    function getCheckboxByValue(value: string): HTMLElement {
      const checkbox = screen
        .getAllByRole("checkbox")
        .find((cb) => cb.getAttribute("value") === value);
      if (!checkbox) throw new Error(`Checkbox with value=${value} not found`);
      return checkbox;
    }

    it("resets caf when the only operator requiring it is unchecked", async () => {
      const user = userEvent.setup();
      const { getForm } = setup();

      const cafOperator = getCheckboxByValue("group1");
      await user.click(cafOperator);

      act(() => {
        getForm().setValue("caf", "1234567");
      });
      expect(getForm().getValues("caf")).toBe("1234567");

      await user.click(cafOperator);

      expect(getForm().getValues("caf")).toBeUndefined();
    });

    it("keeps caf when another checked operator still requires it", async () => {
      const user = userEvent.setup();
      const { getForm } = setup();

      const cafOperator = getCheckboxByValue("group1");
      const poleEmploiOperator = getCheckboxByValue("group3");

      await user.click(cafOperator);
      await user.click(poleEmploiOperator);

      act(() => {
        getForm().setValue("caf", "1234567");
      });

      await user.click(cafOperator);

      expect(getForm().getValues("caf")).toBe("1234567");
    });

    it("resets nir when the cpam operator is unchecked", async () => {
      const user = userEvent.setup();
      const { getForm } = setup();

      const cpamOperator = getCheckboxByValue("group2");
      await user.click(cpamOperator);

      act(() => {
        getForm().setValue("nir", "1234567890123");
      });

      await user.click(cpamOperator);

      expect(getForm().getValues("nir")).toBeUndefined();
    });
  });
});
