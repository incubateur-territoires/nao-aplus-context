import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrintButton } from "./print-button";

describe("PrintButton", () => {
  const originalPrint = window.print;

  beforeEach(() => {
    window.print = jest.fn();
  });

  afterEach(() => {
    window.print = originalPrint;
    jest.clearAllMocks();
  });

  it("renders with the correct label", () => {
    render(<PrintButton />);

    expect(
      screen.getByRole("button", { name: /Imprimer le signalement/i }),
    ).toBeInTheDocument();
  });

  it("renders with the printer icon", () => {
    render(<PrintButton />);

    const button = screen.getByRole("button", {
      name: /Imprimer le signalement/i,
    });
    expect(button).toHaveClass("ri-printer-line");
  });

  it("hides the button when printing via the print:hidden class", () => {
    render(<PrintButton />);

    const button = screen.getByRole("button", {
      name: /Imprimer le signalement/i,
    });
    expect(button).toHaveClass("print:hidden");
  });

  it("calls window.print when clicked", async () => {
    const user = userEvent.setup();
    render(<PrintButton />);

    const button = screen.getByRole("button", {
      name: /Imprimer le signalement/i,
    });
    await user.click(button);

    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
