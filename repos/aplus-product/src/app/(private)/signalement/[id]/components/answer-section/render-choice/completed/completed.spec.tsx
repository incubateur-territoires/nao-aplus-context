import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { InTreatment } from "./completed";

describe("InTreatment", () => {
  it("renders the input field with correct label", () => {
    render(<InTreatment />);

    expect(screen.getByText("Ajouter un message")).toBeInTheDocument();
  });

  it("renders the hint text", () => {
    render(<InTreatment />);

    expect(
      screen.getByText(
        "Vous pouvez personnaliser le message ci-dessous si vous le souhaitez.",
      ),
    ).toBeInTheDocument();
  });

  it("renders textarea with default value", () => {
    render(<InTreatment />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue(
      "Bonjour,\nJe m'occupe de ce signalement.\nCordialement,",
    );
  });

  it("renders textarea with correct number of rows", () => {
    render(<InTreatment />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("rows", "5");
  });

  it("applies correct CSS classes", () => {
    render(<InTreatment />);

    const input = screen
      .getByText("Ajouter un message")
      .closest(".fr-input-group");
    expect(input).toHaveClass("mt-10");
  });

  it("handles textarea change events", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    render(<InTreatment />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "New message content" } });

    expect(consoleSpy).toHaveBeenCalledWith("New message content");

    consoleSpy.mockRestore();
  });

  it("textarea is configured as textArea type", () => {
    render(<InTreatment />);

    // The Input component should have textArea prop set to true
    // We can test this by checking the rendered element is a textarea
    const textarea = screen.getByRole("textbox");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("renders with proper structure", () => {
    render(<InTreatment />);

    const container = screen.getByText("Ajouter un message").closest("div");
    expect(container).toBeInTheDocument();
  });

  it("maintains default message formatting", () => {
    render(<InTreatment />);

    const textarea = screen.getByRole("textbox");
    const expectedMessage =
      "Bonjour,\nJe m'occupe de ce signalement.\nCordialement,";

    expect((textarea as HTMLTextAreaElement).value).toBe(expectedMessage);
    expect((textarea as HTMLTextAreaElement).value).toContain("Bonjour,");
    expect((textarea as HTMLTextAreaElement).value).toContain(
      "Je m'occupe de ce signalement.",
    );
    expect((textarea as HTMLTextAreaElement).value).toContain("Cordialement,");
  });

  it("preserves line breaks in default message", () => {
    render(<InTreatment />);

    const textarea = screen.getByRole("textbox");
    const lines = (textarea as HTMLTextAreaElement).value.split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Bonjour,");
    expect(lines[1]).toBe("Je m'occupe de ce signalement.");
    expect(lines[2]).toBe("Cordialement,");
  });
});
