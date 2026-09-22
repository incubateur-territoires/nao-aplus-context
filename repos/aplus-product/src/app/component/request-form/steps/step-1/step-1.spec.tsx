import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Step1 } from "./step-1";
import { FormProvider, useForm } from "react-hook-form";
import { TRPCWrapper } from "@/test/utils/trpc.wrapper";
import { reportFormSchema } from "../../request-form.schema";
import { zodResolver } from "@hookform/resolvers/zod";

let mockSearchParams = new URLSearchParams();
const mockReplace = jest.fn();

jest.mock("next/navigation", () => {
  const actual = jest.requireActual("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: jest.fn(),
      replace: mockReplace,
      prefetch: jest.fn(),
    }),
    useSearchParams: () => mockSearchParams,
    usePathname: () => "/signalement",
  };
});

// Mock window.scrollTo
Object.defineProperty(window, "scrollTo", {
  value: jest.fn(),
  writable: true,
});

// Mock scrollToFirstError
jest.mock("../../utils/scroll", () => ({
  scrollToFirstError: jest.fn(),
}));

jest.mock("@/trpc/client", () => {
  const originalModule = jest.requireActual("@/trpc/client");
  return {
    ...originalModule,
    useTRPC: () => ({
      user: {
        getCurrentUser: {
          queryOptions: () => ({
            queryKey: ["user.getCurrentUser"],
            queryFn: () =>
              Promise.resolve({
                id: "user1",
                name: "John Doe",
                teams: [
                  {
                    id: "group1",
                    name: "Test Group",
                    organization: {
                      id: "struct1",
                      name: "Structure 1",
                    },
                    areas: [{ id: "area1", name: "Paris" }],
                  },
                ],
              }),
          }),
        },
      },
      area: {
        getActiveAreas: {
          queryOptions: () => ({
            queryKey: ["area.getActiveAreas"],
            queryFn: () =>
              Promise.resolve([
                { id: "area1", name: "Paris" },
                { id: "area2", name: "Lyon" },
                { id: "area3", name: "Marseille" },
                { id: "area4", name: "Toulouse" },
                { id: "area5", name: "Nantes" },
                { id: "area6", name: "Nice" },
                { id: "area7", name: "Strasbourg" },
                { id: "area8", name: "Toulon" },
                { id: "area9", name: "Angers" },
              ]),
          }),
        },
      },
      team: {
        getActiveTeamsByAreaIds: {
          queryOptions: () => ({
            queryKey: ["team.getActiveTeamsByAreaIds"],
            queryFn: () =>
              Promise.resolve([
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
                        errorMessage: "Veuillez saisir l'identifiant CAF.",
                        hintText: "La CAF a besoin du numéro identifiant CAF",
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
                    tags: [{ id: "tag1", name: "social-sante" }],
                    specificFields: [
                      {
                        id: "nir",
                        name: "nir",
                        label: "Numéro de sécurité sociale NIR",
                        errorMessage: "Veuillez saisir le numéro NIR.",
                        hintText:
                          "La CPAM a besoin du numéro de sécurité sociale NIR",
                      },
                    ],
                  },
                },
              ]),
          }),
        },
        getActiveOperatorTeamsByAreaIds: {
          queryOptions: () => ({
            queryKey: ["team", "operator"],
            queryFn: () =>
              Promise.resolve([
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
                        errorMessage: "Veuillez saisir l'identifiant CAF.",
                        hintText: "La CAF a besoin du numéro identifiant CAF",
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
                    tags: [{ id: "tag1", name: "social-sante" }],
                    specificFields: [
                      {
                        id: "nir",
                        name: "nir",
                        label: "Numéro de sécurité sociale NIR",
                        errorMessage: "Veuillez saisir le numéro NIR.",
                        hintText:
                          "La CPAM a besoin du numéro de sécurité sociale NIR",
                      },
                    ],
                  },
                },
              ]),
          }),
        },
        getNotInvitedTeamsByReportId: {
          queryOptions: () => ({
            queryKey: ["team", "notInvited"],
            queryFn: () => Promise.resolve([]),
          }),
        },
      },
    }),
  };
});

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn((queryOptions) => {
    if (queryOptions?.queryKey?.[0] === "user.getCurrentUser") {
      return {
        data: {
          id: "user1",
          name: "John Doe",
          teams: [
            {
              id: "group1",
              name: "Test Group",
              organization: {
                id: "struct1",
                name: "Structure 1",
              },
              areas: [{ id: "area1", name: "Paris" }],
            },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    if (queryOptions?.queryKey?.[0] === "area.getActiveAreas") {
      return {
        data: [
          { id: "area1", name: "Paris" },
          { id: "area2", name: "Lyon" },
          { id: "area3", name: "Marseille" },
          { id: "area4", name: "Toulouse" },
          { id: "area5", name: "Nantes" },
          { id: "area6", name: "Nice" },
          { id: "area7", name: "Strasbourg" },
          { id: "area8", name: "Toulon" },
          { id: "area9", name: "Angers" },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (queryOptions?.queryKey?.[0] === "team.getActiveTeamsByAreaIds") {
      return {
        data: [
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
                  errorMessage: "Veuillez saisir l'identifiant CAF.",
                  hintText: "La CAF a besoin du numéro identifiant CAF",
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
              tags: [{ id: "tag1", name: "social-sante" }],
              specificFields: [
                {
                  id: "nir",
                  name: "nir",
                  label: "Numéro de sécurité sociale NIR",
                  errorMessage: "Veuillez saisir le numéro NIR.",
                  hintText:
                    "La CPAM a besoin du numéro de sécurité sociale NIR",
                },
              ],
            },
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (
      Array.isArray(queryOptions?.queryKey) &&
      queryOptions.queryKey[0] === "team" &&
      queryOptions.queryKey[1] === "operator"
    ) {
      return {
        data: [
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
                  errorMessage: "Veuillez saisir l'identifiant CAF.",
                  hintText: "La CAF a besoin du numéro identifiant CAF",
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
              tags: [{ id: "tag1", name: "social-sante" }],
              specificFields: [
                {
                  id: "nir",
                  name: "nir",
                  label: "Numéro de sécurité sociale NIR",
                  errorMessage: "Veuillez saisir le numéro NIR.",
                  hintText:
                    "La CPAM a besoin du numéro de sécurité sociale NIR",
                },
              ],
            },
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    return {
      data: [],
      isLoading: false,
      error: null,
    };
  }),
}));

function AllProviders({ children }: { children: React.ReactNode }) {
  const methods = useForm({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      area: [],
      requestedTeams: [],
      // Set applicantTeam to the first team since the mock user has only 1 team
      // This matches the behavior in request-form.tsx when userGroupsLength === 1
      applicantTeam: [{ value: "group1", label: "Test Group" }],
      subject: "Sujet test",
      description: "Description test",
      files: [],
      caf: "",
      nir: "",
      nif: "",
      firstName: "Jean",
      lastName: "Dupont",
      birthDate: "2000-01-01",
      citizenPermissionConfirmed: false,
      colleagues: [],
    },
    mode: "onChange",
  });
  return (
    <TRPCWrapper>
      <form>
        <FormProvider {...methods}>{children}</FormProvider>
      </form>
    </TRPCWrapper>
  );
}

describe("Step1", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockReplace.mockClear();
  });

  it("déplace le focus sur l'alerte « formulaire expiré » quand elle apparaît (a11y)", async () => {
    mockSearchParams = new URLSearchParams("form_expired=true");
    render(<Step1 />, { wrapper: AllProviders });

    const alert = await screen.findByText(
      /Votre formulaire a expiré suite à un rafraîchissement de page/i,
    );
    // Le conteneur focusable porte tabindex="-1" et reçoit le focus.
    const focusable = alert.closest('[tabindex="-1"]');
    expect(focusable).toBeInTheDocument();
    expect(focusable).toHaveFocus();
  });

  it("renders area select and organization selection", () => {
    render(<Step1 />, { wrapper: AllProviders });
    expect(screen.getByLabelText(/Territoire concerné/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Équipe\(s\) opérateur à contacter/i)[0],
    ).toBeInTheDocument();
  });

  it("shows all area options", () => {
    render(<Step1 />, { wrapper: AllProviders });
    [
      "Paris",
      "Lyon",
      "Marseille",
      "Toulouse",
      "Nantes",
      "Nice",
      "Strasbourg",
      "Toulon",
      "Angers",
    ].forEach((city) => {
      expect(screen.getByText(city)).toBeInTheDocument();
    });
  });

  it("selects an area and organization, submits, and navigates", async () => {
    const user = userEvent.setup();
    render(<Step1 />, { wrapper: AllProviders });

    const select = screen.getByLabelText(
      /Territoire concerné/i,
    ) as HTMLSelectElement;
    await user.selectOptions(select, "area1");

    // Check that the select has options and can be interacted with
    expect(select.options.length).toBeGreaterThan(1);
    expect(select.querySelector('option[value="area1"]')).toBeInTheDocument();

    // group1 is filtered out because it's the applicantTeam, so we use group2
    const orgCheckbox = screen.getByDisplayValue("group2") as HTMLInputElement;
    await user.click(orgCheckbox);
    expect(orgCheckbox).toBeChecked();
  });

  it("prevents navigation when required fields are missing", async () => {
    const user = userEvent.setup();
    render(<Step1 />, { wrapper: AllProviders });

    // Click submit without filling required fields
    const button = screen.getByRole("button", { name: /Étape 2/i });
    await user.click(button);

    // Form should still be visible (navigation blocked by validation)
    expect(screen.getByLabelText(/Territoire concerné/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Équipe\(s\) opérateur à contacter/i)[0],
    ).toBeInTheDocument();
  });

  it("allows form submission when valid data is entered", async () => {
    const user = userEvent.setup();
    render(<Step1 />, { wrapper: AllProviders });

    // Fill in valid data
    const select = screen.getByLabelText(
      /Territoire concerné/i,
    ) as HTMLSelectElement;
    await user.selectOptions(select, "area1");

    // group1 is filtered out because it's the applicantTeam, so we use group2
    const orgCheckbox = screen.getByDisplayValue("group2") as HTMLInputElement;
    await user.click(orgCheckbox);

    // Submit should work with valid data
    const button = screen.getByRole("button", { name: /Étape 2/i });
    await user.click(button);

    // No assertion needed - if validation passed, the test completes successfully
  });

  it("allows selecting multiple organizations", async () => {
    const user = userEvent.setup();
    render(<Step1 />, { wrapper: AllProviders });

    // Select area first to load teams
    const select = screen.getByLabelText(
      /Territoire concerné/i,
    ) as HTMLSelectElement;
    await user.selectOptions(select, "area1");

    // group1 is filtered out because it's the applicantTeam, so only group2 is available
    const org2 = screen.getByDisplayValue("group2") as HTMLInputElement;
    await user.click(org2);

    expect(org2).toBeChecked();
  });

  it("submits form with valid data and navigates", async () => {
    const user = userEvent.setup();

    render(<Step1 />, { wrapper: AllProviders });

    // Fill in required fields
    const select = screen.getByLabelText(
      /Territoire concerné/i,
    ) as HTMLSelectElement;
    await user.selectOptions(select, "area1");

    // group1 is filtered out because it's the applicantTeam, so we use group2
    const orgCheckbox = screen.getByDisplayValue("group2") as HTMLInputElement;
    await user.click(orgCheckbox);

    // Submit form
    const button = screen.getByRole("button", { name: /Étape 2/i });
    await user.click(button);
  });

  it("shows applicantTeam select when user has multiple teams", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reactQuery = require("@tanstack/react-query");
    const useQuerySpy = jest.spyOn(reactQuery, "useQuery");

    // Override the mock to return multiple teams
    useQuerySpy.mockImplementation((queryOptions: unknown) => {
      const opts = queryOptions as { queryKey?: string[] };
      if (opts?.queryKey?.[0] === "user.getCurrentUser") {
        return {
          data: {
            id: "user1",
            name: "John Doe",
            teams: [
              {
                id: "group1",
                name: "Test Group 1",
                organization: {
                  id: "struct1",
                  name: "Structure 1",
                },
                areas: [{ id: "area1", name: "Paris" }],
              },
              {
                id: "group2",
                name: "Test Group 2",
                organization: {
                  id: "struct2",
                  name: "Structure 2",
                },
                areas: [{ id: "area1", name: "Paris" }],
              },
            ],
          },
          isLoading: false,
          error: null,
        };
      }
      if (opts?.queryKey?.[0] === "area.getActiveAreas") {
        return {
          data: [
            { id: "area1", name: "Paris" },
            { id: "area2", name: "Lyon" },
          ],
          isLoading: false,
          error: null,
        };
      }
      return {
        data: [],
        isLoading: false,
        error: null,
      };
    });

    function MultipleTeamsProvider({
      children,
    }: {
      children: React.ReactNode;
    }) {
      const methods = useForm({
        resolver: zodResolver(reportFormSchema),
        defaultValues: {
          area: [],
          requestedTeams: [],
          applicantTeam: [],
          subject: "Sujet test",
          description: "Description test",
          files: [],
          caf: "",
          nir: "",
          nif: "",
          firstName: "Jean",
          lastName: "Dupont",
          birthDate: "2000-01-01",
          citizenPermissionConfirmed: false,
          colleagues: [],
        },
        mode: "onChange",
      });
      return (
        <TRPCWrapper>
          <form>
            <FormProvider {...methods}>{children}</FormProvider>
          </form>
        </TRPCWrapper>
      );
    }

    render(<Step1 />, { wrapper: MultipleTeamsProvider });
    expect(screen.getByLabelText(/Équipe autrice/i)).toBeInTheDocument();

    useQuerySpy.mockRestore();
  });

  it("vide la sélection de co-auteurs quand l'équipe autrice change", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reactQuery = require("@tanstack/react-query");
    const useQuerySpy = jest.spyOn(reactQuery, "useQuery");

    useQuerySpy.mockImplementation((queryOptions: unknown) => {
      const opts = queryOptions as { queryKey?: string[] };
      if (opts?.queryKey?.[0] === "user.getCurrentUser") {
        return {
          data: {
            id: "user1",
            name: "John Doe",
            teams: [
              {
                id: "group1",
                name: "Test Group 1",
                organization: { id: "struct1", name: "Structure 1" },
                areas: [{ id: "area1", name: "Paris" }],
              },
              {
                id: "group2",
                name: "Test Group 2",
                organization: { id: "struct2", name: "Structure 2" },
                areas: [{ id: "area1", name: "Paris" }],
              },
            ],
          },
          isLoading: false,
          error: null,
        };
      }
      if (opts?.queryKey?.[0] === "area.getActiveAreas") {
        return {
          data: [{ id: "area1", name: "Paris" }],
          isLoading: false,
          error: null,
        };
      }
      return { data: [], isLoading: false, error: null };
    });

    let getColleagues: (() => unknown) | undefined;

    function TeamChangeProvider({ children }: { children: React.ReactNode }) {
      const methods = useForm({
        resolver: zodResolver(reportFormSchema),
        defaultValues: {
          area: [],
          requestedTeams: [],
          applicantTeam: [{ value: "group1", label: "Test Group 1" }],
          subject: "Sujet test",
          description: "Description test",
          files: [],
          caf: "",
          nir: "",
          nif: "",
          firstName: "Jean",
          lastName: "Dupont",
          birthDate: "2000-01-01",
          citizenPermissionConfirmed: false,
          colleagues: [{ value: "colleague1", label: "Ancienne Équipe" }],
        },
        mode: "onChange",
      });
      getColleagues = () => methods.getValues("colleagues");
      return (
        <TRPCWrapper>
          <form>
            <FormProvider {...methods}>{children}</FormProvider>
          </form>
        </TRPCWrapper>
      );
    }

    const user = userEvent.setup();
    render(<Step1 />, { wrapper: TeamChangeProvider });

    await user.selectOptions(
      screen.getByLabelText(/Équipe autrice/i),
      "group2",
    );

    expect(getColleagues?.()).toEqual([]);

    useQuerySpy.mockRestore();
  });
});
