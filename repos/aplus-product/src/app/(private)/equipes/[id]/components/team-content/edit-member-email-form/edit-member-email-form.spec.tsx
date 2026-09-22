import { render, screen, fireEvent } from "@testing-library/react";
import { EditMemberEmailForm } from "./edit-member-email-form";

describe("EditMemberEmailForm", () => {
  const defaultProps = {
    currentEmail: "test@example.com",
    onValidate: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the form with current email", () => {
    render(<EditMemberEmailForm {...defaultProps} />);

    expect(
      screen.getByLabelText("Adresse e-mail du membre à ajouter"),
    ).toHaveValue("test@example.com");
  });

  it("calls onValidate with new email on submit", () => {
    render(<EditMemberEmailForm {...defaultProps} />);

    const input = screen.getByLabelText("Adresse e-mail du membre à ajouter");
    fireEvent.change(input, { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByText("Valider la modification"));

    expect(defaultProps.onValidate).toHaveBeenCalledWith("new@example.com");
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(<EditMemberEmailForm {...defaultProps} />);

    fireEvent.click(screen.getByText("Annuler"));

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });
});
