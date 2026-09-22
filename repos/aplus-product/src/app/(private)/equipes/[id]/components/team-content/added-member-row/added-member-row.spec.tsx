import { render, screen, fireEvent } from "@testing-library/react";
import { AddedMemberRow } from "./added-member-row";

jest.mock("@codegouvfr/react-dsfr/Button", () => ({
  __esModule: true,
  default: ({
    onClick,
    title,
    children,
    iconId,
    priority,
  }: {
    onClick?: () => void;
    title?: string;
    children?: React.ReactNode;
    iconId?: string;
    priority?: string;
  }) => (
    <button
      onClick={onClick}
      title={title}
      data-priority={priority}
      data-icon-id={iconId}
    >
      {children || title}
    </button>
  ),
}));

jest.mock("@codegouvfr/react-dsfr/ToggleSwitch", () => ({
  __esModule: true,
  default: ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  ),
}));

jest.mock("@codegouvfr/react-dsfr/Input", () => ({
  __esModule: true,
  default: ({
    label,
    nativeInputProps,
  }: {
    label: string;
    nativeInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  }) => (
    <label>
      {label}
      <input {...nativeInputProps} />
    </label>
  ),
}));

describe("AddedMemberRow", () => {
  const defaultProps = {
    email: "test@example.com",
    onRemove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the email address", () => {
    render(<AddedMemberRow {...defaultProps} />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("shows confirmation dialog when delete button is clicked", () => {
    render(<AddedMemberRow {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Supprimer"));

    expect(
      screen.getByText(/Êtes-vous sûr de vouloir supprimer/i),
    ).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Confirmer la suppression")).toBeInTheDocument();
    expect(screen.getByText("Annuler")).toBeInTheDocument();
    expect(defaultProps.onRemove).not.toHaveBeenCalled();
  });

  it("calls onRemove when confirming deletion", () => {
    render(<AddedMemberRow {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Supprimer"));
    fireEvent.click(screen.getByText("Confirmer la suppression"));

    expect(defaultProps.onRemove).toHaveBeenCalledTimes(1);
  });

  it("does not call onRemove when canceling deletion", () => {
    render(<AddedMemberRow {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Supprimer"));
    fireEvent.click(screen.getByText("Annuler"));

    expect(defaultProps.onRemove).not.toHaveBeenCalled();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(
      screen.queryByText(/Êtes-vous sûr de vouloir supprimer/i),
    ).not.toBeInTheDocument();
  });

  it("displays email in bold in confirmation message", () => {
    render(<AddedMemberRow {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Supprimer"));

    const confirmationText = screen.getByText(
      /Êtes-vous sûr de vouloir supprimer/i,
    );
    const emailSpan = confirmationText.querySelector("span");

    expect(emailSpan).toBeInTheDocument();
    expect(emailSpan).toHaveTextContent("test@example.com");
    expect(emailSpan).toHaveClass("font-bold");
  });

  it("shows edit email link when onEmailChange is provided", () => {
    const onEmailChange = jest.fn();
    render(<AddedMemberRow {...defaultProps} onEmailChange={onEmailChange} />);
    expect(screen.getByText("Modifier l'adresse e-mail")).toBeInTheDocument();
  });

  it("shows edit form when clicking on edit email link", () => {
    const onEmailChange = jest.fn();
    render(<AddedMemberRow {...defaultProps} onEmailChange={onEmailChange} />);
    fireEvent.click(screen.getByText("Modifier l'adresse e-mail"));
    expect(
      screen.getByLabelText("Adresse e-mail du membre à ajouter"),
    ).toHaveValue("test@example.com");
    expect(screen.getByText("Valider la modification")).toBeInTheDocument();
    expect(screen.getByText("Annuler")).toBeInTheDocument();
  });

  it("calls onEmailChange with new email on validate", () => {
    const onEmailChange = jest.fn();
    render(<AddedMemberRow {...defaultProps} onEmailChange={onEmailChange} />);
    fireEvent.click(screen.getByText("Modifier l'adresse e-mail"));

    const input = screen.getByLabelText("Adresse e-mail du membre à ajouter");
    fireEvent.change(input, { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByText("Valider la modification"));

    expect(onEmailChange).toHaveBeenCalledWith("new@example.com");
  });

  it("closes edit form on cancel", () => {
    const onEmailChange = jest.fn();
    render(<AddedMemberRow {...defaultProps} onEmailChange={onEmailChange} />);
    fireEvent.click(screen.getByText("Modifier l'adresse e-mail"));
    fireEvent.click(screen.getByText("Annuler"));

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Adresse e-mail du membre à ajouter"),
    ).not.toBeInTheDocument();
  });

  it("does not show edit email link when onEmailChange is not provided", () => {
    render(<AddedMemberRow {...defaultProps} />);
    expect(
      screen.queryByText("Modifier l'adresse e-mail"),
    ).not.toBeInTheDocument();
  });

  it("shows operator group callout when isOperatorGroup is true", () => {
    render(<AddedMemberRow {...defaultProps} isOperatorGroup />);
    expect(screen.getByText(/aura accès au contenu/i)).toBeInTheDocument();
  });

  it("does not show operator group callout when isOperatorGroup is false", () => {
    render(<AddedMemberRow {...defaultProps} />);
    expect(
      screen.queryByText(/aura accès au contenu/i),
    ).not.toBeInTheDocument();
  });

  it("calls onManagerToggle when toggle is changed", () => {
    const onManagerToggle = jest.fn();
    render(
      <AddedMemberRow {...defaultProps} onManagerToggle={onManagerToggle} />,
    );
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(onManagerToggle).toHaveBeenCalledWith(true);
  });

  it("uses defaultIsManager prop", () => {
    render(<AddedMemberRow {...defaultProps} defaultIsManager />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("shows confirmation dialog when showConfirmDelete prop is true", () => {
    const onCancelDelete = jest.fn();
    render(
      <AddedMemberRow
        {...defaultProps}
        showConfirmDelete={true}
        onCancelDelete={onCancelDelete}
      />,
    );

    expect(
      screen.getByText(/Êtes-vous sûr de vouloir supprimer/i),
    ).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Confirmer la suppression")).toBeInTheDocument();
    expect(screen.getByText("Annuler")).toBeInTheDocument();
  });

  it("calls onCancelDelete when canceling deletion from prop", () => {
    const onCancelDelete = jest.fn();
    render(
      <AddedMemberRow
        {...defaultProps}
        showConfirmDelete={true}
        onCancelDelete={onCancelDelete}
      />,
    );

    fireEvent.click(screen.getByText("Annuler"));
    expect(onCancelDelete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onRemove).not.toHaveBeenCalled();
  });

  it("calls onRemove and onCancelDelete when confirming deletion from prop", () => {
    const onCancelDelete = jest.fn();
    render(
      <AddedMemberRow
        {...defaultProps}
        showConfirmDelete={true}
        onCancelDelete={onCancelDelete}
      />,
    );

    fireEvent.click(screen.getByText("Confirmer la suppression"));
    expect(defaultProps.onRemove).toHaveBeenCalledTimes(1);
    expect(onCancelDelete).toHaveBeenCalledTimes(1);
  });

  it("updates confirmation dialog when showConfirmDelete prop changes", () => {
    const { rerender } = render(
      <AddedMemberRow {...defaultProps} showConfirmDelete={false} />,
    );

    expect(
      screen.queryByText(/Êtes-vous sûr de vouloir supprimer/i),
    ).not.toBeInTheDocument();

    rerender(<AddedMemberRow {...defaultProps} showConfirmDelete={true} />);

    expect(
      screen.getByText(/Êtes-vous sûr de vouloir supprimer/i),
    ).toBeInTheDocument();
  });
});
