import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InputFile } from "./input-file";

describe("InputFile", () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    onChange: mockOnChange,
    label: "Test Label",
    name: "test-input",
  };

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("renders with default props", () => {
    render(<InputFile onChange={mockOnChange} />);
    expect(
      screen.getByLabelText(/Ajouter un ou plusieurs fichier\(s\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Taille maximale : 5 Mo/)).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<InputFile {...defaultProps} />);
    expect(screen.getByLabelText("Test Label")).toBeInTheDocument();
  });

  it("handles valid file upload", async () => {
    const user = userEvent.setup();
    render(<InputFile {...defaultProps} />);

    const file = new File(["test"], "test.png", { type: "image/png" });
    const input = screen.getByLabelText("Test Label");

    await user.upload(input, file);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([file]);
    });
  });

  it("rejects invalid file type", async () => {
    const user = userEvent.setup();
    render(<InputFile {...defaultProps} />);

    const file = new File(["test"], "test.txt", { type: "text/plain" });
    const input = screen.getByLabelText("Test Label");

    await user.upload(input, file);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("rejects file larger than 5MB", async () => {
    const user = userEvent.setup();
    render(<InputFile {...defaultProps} />);

    // Create a file larger than 5MB
    const largeFile = new File(["x".repeat(6 * 1024 * 1024)], "large.png", {
      type: "image/png",
    });
    const input = screen.getByLabelText("Test Label");

    await user.upload(input, largeFile);

    expect(
      screen.getByText(/Formats supportés : jpg, png, pdf/),
    ).toBeInTheDocument();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("handles file deletion", async () => {
    const user = userEvent.setup();
    const initialFiles = [
      new File(["test1"], "test1.png", { type: "image/png" }),
      new File(["test2"], "test2.png", { type: "image/png" }),
    ];

    render(<InputFile {...defaultProps} value={initialFiles} />);

    const deleteButtons = screen.getAllByText("Supprimer");
    await user.click(deleteButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith([initialFiles[1]]);
  });

  it("prevents duplicate files", async () => {
    const user = userEvent.setup();
    const file = new File(["test"], "test.png", { type: "image/png" });
    render(<InputFile {...defaultProps} value={[file]} />);

    const input = screen.getByLabelText("Test Label");
    await user.upload(input, file);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([file]);
    });
    // Should only have one instance of the file
    expect(screen.getAllByText("test.png")).toHaveLength(1);
  });

  it("shows loading state", () => {
    render(<InputFile {...defaultProps} isLoading={true} />);

    const browseButton = screen.getByText("Parcourir...");
    expect(browseButton).toBeDisabled();
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
  });

  it("handles multiple file upload", async () => {
    const user = userEvent.setup();
    render(<InputFile {...defaultProps} />);

    const files = [
      new File(["test1"], "test1.png", { type: "image/png" }),
      new File(["test2"], "test2.pdf", { type: "application/pdf" }),
    ];

    const input = screen.getByLabelText("Test Label");
    await user.upload(input, files);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(files);
    });
  });
});
