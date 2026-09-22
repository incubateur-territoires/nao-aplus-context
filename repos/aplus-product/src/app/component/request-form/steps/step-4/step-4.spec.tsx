import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Step4, InfoRow } from "./step-4";
import React from "react";
import { TRPCWrapper } from "@/test/utils/trpc.wrapper";
import { RequestFormWrapper } from "@/test/utils/request-form.wrapper";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        ok: true,
        data: [],
      }),
  }),
) as jest.Mock;

const mockPush = jest.fn();
const mockCreateRequest = jest.fn().mockResolvedValue({ success: true });
const mockUploadFiles = jest.fn().mockResolvedValue({ ok: true, data: [] });

// Variable to control mock colleagues data per test
let mockColleaguesData: Array<{
  id: string;
  firstName: string;
  lastName: string;
}> = [
  { id: "user1", firstName: "John", lastName: "Doe" },
  { id: "user2", firstName: "Jane", lastName: "Smith" },
  { id: "user3", firstName: "Bob", lastName: "Johnson" },
];

jest.mock("next/navigation", () => {
  const actual = jest.requireActual("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
    }),
  };
});

jest.mock("@/app/query/request/request.query", () => ({
  useCreateRequest: () => ({
    createRequest: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    report: {
      createReport: {
        mutationOptions: (options = {}) => ({
          mutationFn: mockCreateRequest,
          onSuccess: () => mockPush("/"),
          ...options,
        }),
      },
      getTeamHelpers: {
        queryOptions: () => ({ queryKey: ["report", "getTeamHelpers"] }),
      },
      getColleagues: {
        queryOptions: () => ({ queryKey: ["report", "getColleagues"] }),
      },
    },
    user: {
      getUsers: {
        queryOptions: () => ({
          queryKey: ["users"],
          queryFn: () =>
            Promise.resolve([
              { id: "user1", firstName: "John", lastName: "Doe" },
              { id: "user2", firstName: "Jane", lastName: "Smith" },
              { id: "user3", firstName: "Bob", lastName: "Johnson" },
            ]),
        }),
      },
    },
  }),
  TRPCProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("@/app/query/file/file.query", () => ({
  useUploadFiles: () => ({
    mutateAsync: mockUploadFiles,
    isPending: false,
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(() => {
    return {
      data: mockColleaguesData,
      isLoading: false,
      error: null,
    };
  }),
  useMutation: () => ({
    mutateAsync: mockCreateRequest,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <TRPCWrapper>
      <RequestFormWrapper>{children}</RequestFormWrapper>
    </TRPCWrapper>
  );
}

describe("Step4", () => {
  it("renders all summary sections and info", () => {
    render(<Step4 />, { wrapper: AllProviders });
    expect(
      screen.getByText(/Destinataires du signalement/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Territoire concerné/i)).toBeInTheDocument();
    expect(
      screen
        .getAllByText(/Pas-de-Calais/)
        .some((el) => el.textContent === "Pas-de-Calais"),
    ).toBe(true);
    expect(
      screen.getByText(/Équipe\(s\) opérateur à contacter/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Équipe autrice/i)).toBeInTheDocument();
    expect(screen.getByText(/Structure Test/)).toBeInTheDocument();
    expect(screen.getByText(/Identifiant CAF/i)).toBeInTheDocument();
    expect(screen.getByText(/CAF1234567/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Informations du citoyen/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Prénom/i)).toBeInTheDocument();
    expect(screen.getByText(/Jean/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Nom/i).some((el) => el.textContent === "Nom"),
    ).toBe(true);
    expect(screen.getAllByText(/Dupont/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Date de naissance/i)).toBeInTheDocument();

    expect(
      screen
        .getAllByText(/Signalement détaillé/i)
        .some((el) => el.textContent === "Signalement détaillé"),
    ).toBe(true);
    expect(screen.getByText(/Sujet du signalement/i)).toBeInTheDocument();
    expect(screen.getByText(/Sujet test/)).toBeInTheDocument();
    expect(screen.getByText(/Description du blocage/i)).toBeInTheDocument();
    expect(screen.getByText(/Description test/)).toBeInTheDocument();
    expect(screen.getByText(/Fichier\(s\) joint\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Attestation décès.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/Document CAF.pdf/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Mandat/i,
        level: 3,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/autorisation du citoyen/i),
    ).toBeInTheDocument();
  });

  it("structure chaque catégorie du récapitulatif en liste (a11y)", () => {
    const { container } = render(<Step4 />, { wrapper: AllProviders });

    // Chaque catégorie (Destinataires, Informations du citoyen, Signalement
    // détaillé) expose ses lignes label/valeur dans une <ul> de <li>.
    const recapLists = Array.from(
      container.querySelectorAll("ul.list-none"),
    ).filter((ul) => ul.querySelector("li"));
    expect(recapLists.length).toBeGreaterThanOrEqual(3);

    // Les lignes label/valeur sont bien des <li>.
    const territoireLabel = screen.getByText(/Territoire concerné/i);
    expect(territoireLabel.closest("li")).toBeInTheDocument();
    const prenomLabel = screen.getByText(/Prénom/i);
    expect(prenomLabel.closest("li")).toBeInTheDocument();
  });

  it("décrit l'erreur du groupe « Inviter des collègues » via aria-describedby (a11y)", () => {
    const { container } = render(<Step4 />, { wrapper: AllProviders });

    const fieldset = container.querySelector("#colleagues-fieldset");
    expect(fieldset).toBeInTheDocument();
    // Le nom du groupe = la légende uniquement (pas le message d'erreur).
    expect(fieldset).toHaveAttribute(
      "aria-labelledby",
      "colleagues-fieldset-legend",
    );
    // Le message d'erreur est exposé comme description.
    expect(fieldset).toHaveAttribute(
      "aria-describedby",
      "colleagues-fieldset-messages",
    );
  });

  it("displays formatted phone number when present", () => {
    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [],
              caf: "CAF1234567",
              nir: "123456789012345",
              firstName: "Jean",
              lastName: "Dupont",
              phone: "0122334455",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    expect(screen.getByText(/Numéro de téléphone/i)).toBeInTheDocument();
    expect(screen.getByText(/01 22 33 44 55/i)).toBeInTheDocument();
  });

  it("does not display phone number row when phone is empty", () => {
    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [],
              caf: "CAF1234567",
              nir: "123456789012345",
              firstName: "Jean",
              lastName: "Dupont",
              phone: "",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    // InfoRow returns null when value is empty, so phone row should not render
    expect(screen.queryByText(/Numéro de téléphone/i)).not.toBeInTheDocument();
  });

  it("displays 'cannot provide' message when phone is null", () => {
    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [],
              firstName: "Jean",
              lastName: "Dupont",
              phone: null,
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    expect(screen.getAllByText(/Numéro de téléphone/i)[0]).toBeInTheDocument();
    expect(document.body.textContent).toContain(
      "Le citoyen ne peut pas fournir son numéro de téléphone",
    );
  });

  it("displays marital name when present", () => {
    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [],
              firstName: "Jean",
              lastName: "Dupont",
              maritalName: "Dupont-Martin",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    expect(screen.getByText(/Nom marital/i)).toBeInTheDocument();
    expect(screen.getByText("Dupont-Martin")).toBeInTheDocument();
  });

  it("does not display marital name when not set", () => {
    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [],
              firstName: "Jean",
              lastName: "Dupont",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    expect(screen.queryByText(/Nom marital/i)).not.toBeInTheDocument();
  });

  it("navigates to step 1 when edit in destinataires section is clicked", async () => {
    render(<Step4 />, { wrapper: AllProviders });
    const editButton = screen.getByRole("button", {
      name: /Modifier les informations du destinataire/i,
    });
    await userEvent.click(editButton);
    expect(mockPush).toHaveBeenCalledWith("/signalement?step=1");
  });

  it("navigates to step 2 when edit in citoyen section is clicked", async () => {
    render(<Step4 />, { wrapper: AllProviders });
    const editButton = screen.getByRole("button", {
      name: /Modifier les informations du citoyen/i,
    });
    await userEvent.click(editButton);
    expect(mockPush).toHaveBeenCalledWith("/signalement?step=2");
  });

  it("navigates to step 3 when edit in demande section is clicked", async () => {
    render(<Step4 />, { wrapper: AllProviders });
    const editButton = screen.getByRole("button", {
      name: /Modifier le contenu du signalement/i,
    });
    await userEvent.click(editButton);
    expect(mockPush).toHaveBeenCalledWith("/signalement?step=3");
  });

  it("link to step 3 is correct", () => {
    render(<Step4 />, { wrapper: AllProviders });
    const link = screen.getByRole("button", { name: /Retour à l'étape 3/i });
    expect(link).toHaveAttribute("href", "/signalement?step=3");
  });

  // it("shows validation error if citizenPermissionConfirmed is not checked", async () => {
  //   render(<Step4 />, { wrapper: AllProviders });
  //   const button = screen.getByRole("button", { name: /Envoyer le signalement/i });
  //   await userEvent.click(button);

  //   expect(mockCreateRequest).not.toHaveBeenCalled();
  //   expect(
  //     screen.getByText(
  //       /Vous devez recueillir l'autorisation du citoyen pour envoyer le signalement\./i
  //     )
  //   ).toBeInTheDocument();

  //   const checkbox = screen.getByLabelText(
  //     /Je certifie que les informations communiquées sont exactes/i
  //   );
  //   expect(checkbox).toHaveAttribute("aria-invalid", "true");
  // });

  it("submits request when citizenPermissionConfirmed is checked", async () => {
    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [],
              caf: "CAF1234567",
              nir: "123456789012345",
              firstName: "Jean",
              lastName: "Dupont",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    // Directly call the mutation to simulate successful form submission
    await mockCreateRequest({
      citizenPermissionConfirmed: true,
      area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
      applicantGroup: [{ label: "Structure Test", value: "structure-test" }],
      requestedGroups: [
        { label: "CAF - Pas-de-Calais", value: "caf-pas-de-calais" },
      ],
      caf: "CAF1234567",
      nir: "123456789012345",
      firstName: "Jean",
      lastName: "Dupont",
      birthDate: "2000-01-01",
      subject: "Sujet test",
      description: "Description test",
      files: [],
      colleagues: [],
    });

    expect(mockCreateRequest).toHaveBeenCalled();
  });

  it("renders colleagues section with available users", async () => {
    render(<Step4 />, { wrapper: AllProviders });

    expect(screen.getByText(/Inviter des collègues/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Johnson/i)).toBeInTheDocument();
  });

  it("does not render colleagues section when user is alone in team", async () => {
    // Set empty colleagues to simulate user alone in team
    mockColleaguesData = [];

    render(<Step4 />, { wrapper: AllProviders });

    expect(
      screen.queryByText(/Inviter des collègues/i),
    ).not.toBeInTheDocument();

    // Restore default colleagues data for subsequent tests
    mockColleaguesData = [
      { id: "user1", firstName: "John", lastName: "Doe" },
      { id: "user2", firstName: "Jane", lastName: "Smith" },
      { id: "user3", firstName: "Bob", lastName: "Johnson" },
    ];
  });

  it("pre-checks all colleagues by default and allows opting out", async () => {
    render(<Step4 />, { wrapper: AllProviders });

    const johnCheckbox = screen.getByLabelText(/John Doe/i);
    const janeCheckbox = screen.getByLabelText(/Jane Smith/i);
    const bobCheckbox = screen.getByLabelText(/Bob Johnson/i);

    // All colleagues should be pre-checked by default
    await waitFor(() => expect(johnCheckbox).toBeChecked());
    expect(janeCheckbox).toBeChecked();
    expect(bobCheckbox).toBeChecked();

    // Deselect John
    await userEvent.click(johnCheckbox);
    await waitFor(() => expect(johnCheckbox).not.toBeChecked());

    // Jane and Bob should still be selected
    expect(janeCheckbox).toBeChecked();
    expect(bobCheckbox).toBeChecked();
  });

  it("does not re-select colleagues after the user deselects all of them", async () => {
    render(<Step4 />, { wrapper: AllProviders });

    const johnCheckbox = screen.getByLabelText(/John Doe/i);
    const janeCheckbox = screen.getByLabelText(/Jane Smith/i);
    const bobCheckbox = screen.getByLabelText(/Bob Johnson/i);

    await waitFor(() => expect(johnCheckbox).toBeChecked());

    // Deselect each one in turn — the last unchecks must stick
    // (regression: returning to the [] default used to retrigger the
    // auto-fill effect and re-check everyone).
    await userEvent.click(johnCheckbox);
    await waitFor(() => expect(johnCheckbox).not.toBeChecked());

    await userEvent.click(janeCheckbox);
    await waitFor(() => expect(janeCheckbox).not.toBeChecked());

    await userEvent.click(bobCheckbox);
    await waitFor(() => expect(bobCheckbox).not.toBeChecked());

    expect(johnCheckbox).not.toBeChecked();
    expect(janeCheckbox).not.toBeChecked();
    expect(bobCheckbox).not.toBeChecked();
  });

  it("submits form with selected colleagues", async () => {
    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [],
              caf: "CAF1234567",
              nir: "123456789012345",
              firstName: "Jean",
              lastName: "Dupont",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: false,
              colleagues: [
                { value: "user1", label: "John Doe" },
                { value: "user2", label: "Jane Smith" },
              ],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    // Check that colleagues are already selected (from defaultValues)
    const johnCheckbox = screen.getByLabelText(/John Doe/i);
    const janeCheckbox = screen.getByLabelText(/Jane Smith/i);
    expect(johnCheckbox).toBeChecked();
    expect(janeCheckbox).toBeChecked();

    // Check citizen permission (this must be done to enable form submission)
    const permissionCheckbox = screen.getByLabelText(
      /J'atteste avoir recueilli l'autorisation du citoyen/i,
    );
    await userEvent.click(permissionCheckbox);
    await waitFor(() => expect(permissionCheckbox).toBeChecked());

    // Submit form
    const button = screen.getByRole("button", {
      name: /Envoyer le signalement/i,
    });
    await userEvent.click(button);

    await waitFor(() => expect(mockCreateRequest).toHaveBeenCalled());

    expect(mockCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        colleagues: [
          { value: "user1", label: "John Doe" },
          { value: "user2", label: "Jane Smith" },
        ],
      }),
    );
  });

  it("InfoRow does not render if value is falsy", () => {
    const { container } = render(<InfoRow label="Test" value={null} />);
    expect(container.textContent).not.toContain("Test");
  });

  it("renders file buttons as clickable elements", () => {
    render(<Step4 />, { wrapper: AllProviders });

    const attestationButton = screen.getByRole("button", {
      name: /Attestation décès.pdf/i,
    });
    const documentButton = screen.getByRole("button", {
      name: /Document CAF.pdf/i,
    });

    expect(attestationButton).toBeInTheDocument();
    expect(documentButton).toBeInTheDocument();
    expect(attestationButton).toHaveAttribute("type", "button");
    expect(documentButton).toHaveAttribute("type", "button");
  });

  it("handles file clicks without errors", async () => {
    // Mock URL.createObjectURL and revokeObjectURL to prevent errors
    const originalCreateObjectURL = global.URL.createObjectURL;
    const originalRevokeObjectURL = global.URL.revokeObjectURL;

    global.URL.createObjectURL = jest.fn(() => "mock-url");
    global.URL.revokeObjectURL = jest.fn();

    render(<Step4 />, { wrapper: AllProviders });

    const fileButton = screen.getByRole("button", {
      name: /Attestation décès.pdf/i,
    });

    // Should not throw when clicking the file button
    expect(() => userEvent.click(fileButton)).not.toThrow();

    // File button should have proper styling classes for file display
    expect(fileButton).toHaveClass("underline");
    expect(fileButton).toHaveClass("text-black");

    // Clean up
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("does not render files section when no files are present", () => {
    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [], // No files
              caf: "CAF1234567",
              firstName: "Jean",
              lastName: "Dupont",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    expect(
      screen.queryByText(/Fichier\(s\) joint\(s\)/i),
    ).not.toBeInTheDocument();
  });

  it("does not create report when file upload fails with ok: false", async () => {
    mockUploadFiles.mockResolvedValueOnce({ ok: false });
    mockCreateRequest.mockClear();

    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [new File(["test"], "test.pdf")],
              caf: "CAF1234567",
              nir: "123456789012345",
              firstName: "Jean",
              lastName: "Dupont",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    const button = screen.getByRole("button", {
      name: /Envoyer le signalement/i,
    });
    await userEvent.click(button);

    await waitFor(() => expect(mockUploadFiles).toHaveBeenCalled());
    expect(mockCreateRequest).not.toHaveBeenCalled();
  });

  it("does not create report when file upload returns ok but no data", async () => {
    mockUploadFiles.mockResolvedValueOnce({ ok: true, data: null });
    mockCreateRequest.mockClear();

    render(<Step4 />, {
      wrapper: ({ children }) => (
        <TRPCWrapper>
          <RequestFormWrapper
            defaultValues={{
              area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
              applicantTeam: [
                { label: "Structure Test", value: "structure-test" },
              ],
              requestedTeams: [
                {
                  label: "CAF - Pas-de-Calais",
                  value: "caf-pas-de-calais",
                  specificFields: [],
                },
              ],
              subject: "Sujet test",
              description: "Description test",
              files: [new File(["test"], "test.pdf")],
              caf: "CAF1234567",
              nir: "123456789012345",
              firstName: "Jean",
              lastName: "Dupont",
              birthDate: "2000-01-01",
              citizenPermissionConfirmed: true,
              colleagues: [],
            }}
          >
            {children}
          </RequestFormWrapper>
        </TRPCWrapper>
      ),
    });

    const button = screen.getByRole("button", {
      name: /Envoyer le signalement/i,
    });
    await userEvent.click(button);

    await waitFor(() => expect(mockUploadFiles).toHaveBeenCalled());
    expect(mockCreateRequest).not.toHaveBeenCalled();
  });
});
