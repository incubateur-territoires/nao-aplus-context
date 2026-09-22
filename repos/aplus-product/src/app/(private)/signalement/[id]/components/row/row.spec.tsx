import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Row } from "./row";

// Mock navigator.clipboard
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock console.error
const mockConsoleError = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});

describe("Row", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
  });

  it("renders label and value correctly", () => {
    render(<Row label="Test Label" value="Test Value" />);

    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Test Value")).toBeInTheDocument();
  });

  it("returns null when value is null", () => {
    const { container } = render(<Row label="Test Label" value={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when value is undefined", () => {
    const { container } = render(<Row label="Test Label" value={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when value is empty string", () => {
    const { container } = render(<Row label="Test Label" value="" />);
    expect(container.firstChild).toBeNull();
  });

  it("applies correct styles for normal layout", () => {
    render(<Row label="Test Label" value="Test Value" />);

    const label = screen.getByText("Test Label");
    const value = screen.getByText("Test Value");

    expect(label).toHaveClass("text-xs", "font-regular");
    expect(value).toHaveClass("font-bold");
  });

  it("applies correct styles for boldReversed layout", () => {
    render(<Row label="Test Label" value="Test Value" boldReversed />);

    const label = screen.getByText("Test Label");
    const value = screen.getByText("Test Value");

    expect(label).toHaveClass("font-bold");
    expect(value).toHaveClass("text-xs");
  });

  it("applies allXs class when specified", () => {
    render(<Row label="Test Label" value="Test Value" allXs />);

    const value = screen.getByText("Test Value");
    expect(value).toHaveClass("text-xs");
  });

  it("shows copy button when withCopyButton is true", () => {
    render(<Row label="Test Label" value="Test Value" withCopyButton />);

    const copyButton = screen.getByRole("button", { name: /Copier/i });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveClass("shrink-0");
  });

  it("does not show copy button by default", () => {
    render(<Row label="Test Label" value="Test Value" />);

    const copyButton = screen.queryByRole("button", { name: /Copier/i });
    expect(copyButton).not.toBeInTheDocument();
  });

  // it("copies text to clipboard when copy button is clicked", async () => {
  //   const user = userEvent.setup();
  //   render(<Row label="Test Label" value="Test Value" withCopyButton />);

  //   const copyButton = screen.getByRole("button", { name: /Copier/i });
  //   await user.click(copyButton);

  //   expect(mockWriteText).toHaveBeenCalledWith("Test Value");
  //   await screen.findByRole("button", { name: /Copié !/i });
  // });

  it("shows success state after copying", async () => {
    const user = userEvent.setup();
    render(<Row label="Test Label" value="Test Value" withCopyButton />);

    const copyButton = screen.getByRole("button", { name: /Copier/i });
    await user.click(copyButton);

    const copiedButton = await screen.findByRole("button", {
      name: /Copié !/i,
    });
    expect(copiedButton).toBeInTheDocument();
    expect(copiedButton).toBeDisabled();
  });

  it("resets copy state after 2 seconds", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<Row label="Test Label" value="Test Value" withCopyButton />);

    const copyButton = screen.getByRole("button", { name: /Copier/i });
    await user.click(copyButton);

    await screen.findByRole("button", { name: /Copié !/i });

    // Fast forward 2 seconds
    jest.advanceTimersByTime(2000);

    await screen.findByRole("button", { name: /Copier/i });
    expect(screen.getByRole("button")).not.toBeDisabled();

    jest.useRealTimers();
  });

  // it("handles clipboard write failure gracefully", async () => {
  //   mockWriteText.mockRejectedValueOnce(new Error("Clipboard error"));
  //   const user = userEvent.setup();

  //   render(<Row label="Test Label" value="Test Value" withCopyButton />);

  //   const copyButton = screen.getByRole("button", { name: /Copier/i });

  //   await user.click(copyButton);

  //   // Give it a moment for the promise to resolve and error handler to run
  //   await new Promise((resolve) => setTimeout(resolve, 0));

  //   expect(mockConsoleError).toHaveBeenCalledWith(
  //     "Failed to copy: ",
  //     expect.any(Error)
  //   );
  // });

  it("applies correct button icon based on state", () => {
    render(<Row label="Test Label" value="Test Value" withCopyButton />);

    const copyButton = screen.getByRole("button", { name: /Copier/i });
    expect(copyButton).toHaveClass("ri-file-copy-line");
  });

  it("applies correct button styling for copy state", async () => {
    const user = userEvent.setup();
    render(<Row label="Test Label" value="Test Value" withCopyButton />);

    const copyButton = screen.getByRole("button", { name: /Copier/i });
    await user.click(copyButton);

    const copiedButton = await screen.findByRole("button", {
      name: /Copié !/i,
    });
    expect(copiedButton).toHaveClass(
      "bg-green-100",
      "text-green-700",
      "border-green-200",
    );
  });

  it("applies correct spacing when copy button is present", () => {
    render(<Row label="Test Label" value="Test Value" withCopyButton />);

    const container = screen.getByText("Test Value").parentElement;
    expect(container).toHaveClass("mt-4");
  });

  it("handles long values with word breaking", () => {
    const longValue = "ThisIsAVeryLongValueThatShouldBreakCorrectly";
    render(<Row label="Test Label" value={longValue} />);

    const value = screen.getByText(longValue);
    expect(value).toHaveClass("break-all", "flex-1", "min-w-0");
  });
});
