import { render, screen, fireEvent } from "@testing-library/react";
import { AddMemberForm } from "./add-member-form";
import React from "react";

jest.mock("@codegouvfr/react-dsfr/Tag", () => {
  return function MockTag({
    children,
    dismissible,
    nativeButtonProps,
  }: {
    children: React.ReactNode;
    dismissible?: boolean;
    nativeButtonProps?: {
      onClick?: (e: React.MouseEvent) => void;
      "aria-label"?: string;
    };
  }) {
    return (
      <div data-testid="tag">
        <span>{children}</span>
        {dismissible && nativeButtonProps?.onClick && (
          <button
            data-testid="tag-dismiss-button"
            aria-label={nativeButtonProps["aria-label"]}
            onClick={nativeButtonProps.onClick}
          >
            ×
          </button>
        )}
      </div>
    );
  };
});

jest.mock("@codegouvfr/react-dsfr/Button", () => ({
  __esModule: true,
  default: ({
    onClick,
    children,
    iconId,
    disabled,
  }: {
    onClick?: () => void;
    children?: React.ReactNode;
    iconId?: string;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} data-icon-id={iconId}>
      {children}
    </button>
  ),
}));

jest.mock("../added-member-row/added-member-row", () => ({
  AddedMemberRow: ({
    email,
    defaultIsManager,
    isManagerLocked,
    showConfirmDelete,
    onCancelDelete,
    onRemove,
  }: {
    email: string;
    defaultIsManager?: boolean;
    isManagerLocked?: boolean;
    showConfirmDelete?: boolean;
    onCancelDelete?: () => void;
    onRemove: () => void;
  }) => (
    <div
      data-testid={`member-row-${email}`}
      data-is-manager={String(defaultIsManager)}
      data-is-manager-locked={String(isManagerLocked)}
    >
      {showConfirmDelete ? (
        <div data-testid={`confirm-dialog-${email}`}>
          <p>Êtes-vous sûr de vouloir supprimer {email} ?</p>
          <button onClick={onRemove}>Confirmer la suppression</button>
          <button onClick={onCancelDelete}>Annuler</button>
        </div>
      ) : (
        <div>
          <span>{email}</span>
          <button onClick={onRemove}>Supprimer</button>
        </div>
      )}
    </div>
  ),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    team: {
      addUserToTeam: {
        mutationOptions: jest.fn(() => ({
          mutationKey: ["team", "addUserToTeam"],
        })),
      },
      getTeamById: {
        queryOptions: jest.fn(() => ({
          queryKey: ["team", "getTeamById"],
        })),
      },
    },
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    refetchQueries: jest.fn(),
  })),
}));

describe("AddMemberForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the form with title and input", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    expect(
      screen.getByText("Ajouter un ou plusieurs membres"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Adresses e-mail des nouveaux membres"),
    ).toBeInTheDocument();
    expect(screen.getByText("Champ obligatoire")).toBeInTheDocument();
  });

  it("renders the info message", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    expect(
      screen.getByText(
        /Saisissez une ou plusieurs adresses e-mail. Appuyez sur Entrée, espace ou virgule pour valider/,
      ),
    ).toBeInTheDocument();
  });

  it("disables submit button when no email tags", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const button = screen.queryByRole("button", { name: /Ajouter/ });
    expect(button).not.toBeInTheDocument();
  });

  it("enables submit button when email tag is added", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const button = screen.getByRole("button", { name: /Ajouter 1 membre/ });
    expect(button).not.toBeDisabled();
  });

  it("adds email tag on Enter key", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("tag")).toHaveTextContent("test@example.com");
    expect(
      screen.getByTestId("member-row-test@example.com"),
    ).toBeInTheDocument();
  });

  it("adds email tag on comma key", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.keyDown(input, { key: "," });

    expect(screen.getByTestId("tag")).toHaveTextContent("test@example.com");
    expect(
      screen.getByTestId("member-row-test@example.com"),
    ).toBeInTheDocument();
  });

  it("shows error for invalid email", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "invalid-email" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      screen.getByText(
        /"invalid-email" n'est pas une adresse e-mail au format attendu, exemple : nom@domaine.fr/,
      ),
    ).toBeInTheDocument();
  });

  it("shows error for duplicate email", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      screen.getByText(/"test@example.com" est déjà dans la liste/),
    ).toBeInTheDocument();
  });

  it("updates button text for multiple members", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test1@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.change(input, { target: { value: "test2@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      screen.getByRole("button", { name: /2 membres/ }),
    ).toBeInTheDocument();
  });

  it("removes email directly when clicking Tag dismiss button", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("tag")).toBeInTheDocument();
    expect(
      screen.getByTestId("member-row-test@example.com"),
    ).toBeInTheDocument();

    const dismissButton = screen.getByTestId("tag-dismiss-button");
    fireEvent.click(dismissButton);

    expect(screen.queryByTestId("tag")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("member-row-test@example.com"),
    ).not.toBeInTheDocument();
  });

  it("sets accessible aria-label on Tag dismiss button", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const dismissButton = screen.getByTestId("tag-dismiss-button");
    expect(dismissButton).toHaveAttribute(
      "aria-label",
      "Retirer test@example.com",
    );
  });

  it("auto-checks isManager for first member when team has no members", () => {
    render(<AddMemberForm teamId="test-team-id" hasMembers={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "first@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("member-row-first@example.com")).toHaveAttribute(
      "data-is-manager",
      "true",
    );
  });

  it("does not auto-check isManager for second member when team has no members", () => {
    render(<AddMemberForm teamId="test-team-id" hasMembers={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "first@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.change(input, { target: { value: "second@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("member-row-first@example.com")).toHaveAttribute(
      "data-is-manager",
      "true",
    );
    expect(screen.getByTestId("member-row-second@example.com")).toHaveAttribute(
      "data-is-manager",
      "false",
    );
  });

  it("locks isManager toggle for first member when team has no members", () => {
    render(<AddMemberForm teamId="test-team-id" hasMembers={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "first@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("member-row-first@example.com")).toHaveAttribute(
      "data-is-manager-locked",
      "true",
    );
  });

  it("does not lock isManager toggle for second member when team has no members", () => {
    render(<AddMemberForm teamId="test-team-id" hasMembers={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "first@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "second@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("member-row-second@example.com")).toHaveAttribute(
      "data-is-manager-locked",
      "false",
    );
  });

  it("does not lock isManager toggle when team already has members", () => {
    render(<AddMemberForm teamId="test-team-id" hasMembers={true} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "new@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("member-row-new@example.com")).toHaveAttribute(
      "data-is-manager-locked",
      "false",
    );
  });

  it("does not auto-check isManager when team already has members", () => {
    render(<AddMemberForm teamId="test-team-id" hasMembers={true} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "new@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("member-row-new@example.com")).toHaveAttribute(
      "data-is-manager",
      "false",
    );
  });

  it("removes correct email when clicking dismiss button on first of multiple tags", () => {
    render(<AddMemberForm teamId="test-team-id" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test1@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.change(input, { target: { value: "test2@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const dismissButtons = screen.getAllByTestId("tag-dismiss-button");
    fireEvent.click(dismissButtons[0]);

    expect(
      screen.queryByTestId("member-row-test1@example.com"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("member-row-test2@example.com"),
    ).toBeInTheDocument();
  });
});
