import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteTypeRadioButtonsAuthor } from "./invite-type-radio-buttons";
import { SelectedOptionEnum } from "../types";

describe("InviteTypeRadioButtonsAuthor", () => {
  const mockOnOptionChange = jest.fn();

  beforeEach(() => {
    mockOnOptionChange.mockClear();
  });

  it("renders both radio options", () => {
    render(
      <InviteTypeRadioButtonsAuthor
        showColleaguesToInvite={true}
        effectiveSelectedOption={null}
        onOptionChange={mockOnOptionChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);

    expect(
      screen.getByDisplayValue(SelectedOptionEnum.COLLEAGUES),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(SelectedOptionEnum.ORGANIZATIONS),
    ).toBeInTheDocument();
  });

  it("disables colleagues option when no colleagues to invite", () => {
    render(
      <InviteTypeRadioButtonsAuthor
        showColleaguesToInvite={false}
        effectiveSelectedOption={null}
        onOptionChange={mockOnOptionChange}
      />,
    );

    const colleaguesRadio = screen.getByDisplayValue(
      SelectedOptionEnum.COLLEAGUES,
    );
    expect(colleaguesRadio).toBeDisabled();
  });

  it("shows custom hint text when colleagues option is disabled", () => {
    render(
      <InviteTypeRadioButtonsAuthor
        showColleaguesToInvite={false}
        effectiveSelectedOption={null}
        onOptionChange={mockOnOptionChange}
      />,
    );

    expect(
      screen.getByText("Il n'y a pas d'autre membre de l'équipe à inviter"),
    ).toBeInTheDocument();
  });

  it("enables colleagues option when colleagues are available", () => {
    render(
      <InviteTypeRadioButtonsAuthor
        showColleaguesToInvite={true}
        effectiveSelectedOption={null}
        onOptionChange={mockOnOptionChange}
      />,
    );

    const colleaguesRadio = screen.getByDisplayValue(
      SelectedOptionEnum.COLLEAGUES,
    );
    expect(colleaguesRadio).not.toBeDisabled();
  });

  it("calls onOptionChange with COLLEAGUES when colleagues option is clicked", async () => {
    const user = userEvent.setup();
    render(
      <InviteTypeRadioButtonsAuthor
        showColleaguesToInvite={true}
        effectiveSelectedOption={null}
        onOptionChange={mockOnOptionChange}
      />,
    );

    const colleaguesRadio = screen.getByDisplayValue(
      SelectedOptionEnum.COLLEAGUES,
    );
    await user.click(colleaguesRadio);

    expect(mockOnOptionChange).toHaveBeenCalledWith(
      SelectedOptionEnum.COLLEAGUES,
    );
  });

  it("calls onOptionChange with ORGANIZATIONS when organizations option is clicked", async () => {
    const user = userEvent.setup();
    render(
      <InviteTypeRadioButtonsAuthor
        showColleaguesToInvite={true}
        effectiveSelectedOption={null}
        onOptionChange={mockOnOptionChange}
      />,
    );

    const organizationsRadio = screen.getByDisplayValue(
      SelectedOptionEnum.ORGANIZATIONS,
    );
    await user.click(organizationsRadio);

    expect(mockOnOptionChange).toHaveBeenCalledWith(
      SelectedOptionEnum.ORGANIZATIONS,
    );
  });

  it("checks the correct radio based on effectiveSelectedOption", () => {
    render(
      <InviteTypeRadioButtonsAuthor
        showColleaguesToInvite={true}
        effectiveSelectedOption={SelectedOptionEnum.COLLEAGUES}
        onOptionChange={mockOnOptionChange}
      />,
    );

    const colleaguesRadio = screen.getByDisplayValue(
      SelectedOptionEnum.COLLEAGUES,
    ) as HTMLInputElement;
    const organizationsRadio = screen.getByDisplayValue(
      SelectedOptionEnum.ORGANIZATIONS,
    ) as HTMLInputElement;

    expect(colleaguesRadio.checked).toBe(true);
    expect(organizationsRadio.checked).toBe(false);
  });

  it("displays hint text for both options", () => {
    render(
      <InviteTypeRadioButtonsAuthor
        showColleaguesToInvite={true}
        effectiveSelectedOption={null}
        onOptionChange={mockOnOptionChange}
      />,
    );

    const hintTexts = screen.getAllByText(
      "Le signalement conservera son statut actuel",
    );
    expect(hintTexts).toHaveLength(2);
  });
});
