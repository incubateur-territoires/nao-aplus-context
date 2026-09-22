import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionMenu } from "./action-menu";

const ACTIONS = [
  { value: "a", label: "Action A" },
  { value: "b", label: "Action B" },
];

describe("ActionMenu", () => {
  it("renders the trigger and keeps actions hidden until opened", () => {
    render(
      <ActionMenu
        ariaLabel="Actions pour Jean"
        actions={ACTIONS}
        onSelect={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Actions pour Jean" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Action A")).not.toBeInTheDocument();
  });

  it("opens the menu and calls onSelect with the chosen value", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(
      <ActionMenu
        ariaLabel="Actions pour Jean"
        actions={ACTIONS}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions pour Jean" }));
    expect(screen.getByText("Action A")).toBeInTheDocument();

    await user.click(screen.getByText("Action B"));

    expect(onSelect).toHaveBeenCalledWith("b");
    // Menu closes after selection.
    expect(screen.queryByText("Action A")).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <ActionMenu
        ariaLabel="Actions pour Jean"
        actions={ACTIONS}
        onSelect={jest.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions pour Jean" });
    await user.click(trigger);
    expect(screen.getByText("Action A")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Action A")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("disables the trigger when disabled", () => {
    render(
      <ActionMenu
        ariaLabel="Actions pour Jean"
        actions={ACTIONS}
        onSelect={jest.fn()}
        disabled
      />,
    );

    expect(
      screen.getByRole("button", { name: "Actions pour Jean" }),
    ).toBeDisabled();
  });
});
