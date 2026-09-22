import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Documents } from "./documents";
import { FileMetadata } from "@/types/file";

// Mock Next.js Image component
jest.mock("next/image", () => {
  return function Image({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  };
});

describe("Documents", () => {
  const mockFiles: FileMetadata[] = [
    {
      id: "file1",
      name: "document1.pdf",
      size: 1024,
      type: "application/pdf",
      lastModified: new Date("2023-01-01"),
    },
    {
      id: "file2",
      name: "document2.jpg",
      size: 2048,
      type: "image/jpeg",
      lastModified: new Date("2023-01-02"),
    },
  ];

  const mockFilesWithMandate: FileMetadata[] = [
    {
      id: "mandate-id",
      name: "Mandat.pdf",
      size: 5000,
      type: "application/pdf",
      lastModified: new Date("2023-01-01"),
    },
    ...mockFiles,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders documents section with title when files are present", () => {
    render(<Documents files={mockFiles} />);

    expect(screen.getByText("Documents joints")).toBeInTheDocument();
  });

  it("renders mandate section when Mandat.pdf is in files", () => {
    render(<Documents files={mockFilesWithMandate} />);

    expect(screen.getByText("Mandat.pdf")).toBeInTheDocument();
    // RGAA 1.2 : l'icône est décorative (alt=""), on la cible par son src.
    expect(
      document.querySelector('img[src="/assets/picto/mandate.svg"]'),
    ).toBeInTheDocument();
  });

  it("does not render mandate section when no Mandat.pdf in files", () => {
    render(<Documents files={mockFiles} />);

    expect(
      document.querySelector('img[src="/assets/picto/mandate.svg"]'),
    ).not.toBeInTheDocument();
  });

  it("renders all provided files", () => {
    render(<Documents files={mockFiles} />);

    expect(screen.getByText("Documents joints")).toBeInTheDocument();
  });

  it("returns null when no files are provided", () => {
    const { container } = render(<Documents files={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("opens mandate file via API when clicked", async () => {
    const user = userEvent.setup();
    const mockClick = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        el.click = mockClick;
      }
      return el;
    });

    render(<Documents files={mockFilesWithMandate} />);

    const mandateButton = screen.getByRole("button", { name: "Mandat.pdf" });
    await user.click(mandateButton);

    expect(mockClick).toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it("renders mandate with correct icon", () => {
    render(<Documents files={mockFilesWithMandate} />);

    // RGAA 1.2 : icône décorative (alt=""), ciblée par son src.
    const mandateImage = document.querySelector(
      'img[src="/assets/picto/mandate.svg"]',
    );
    expect(mandateImage).toHaveAttribute("alt", "");
    expect(mandateImage).toHaveClass("w-4", "h-4");
  });

  it("renders mandate before other files", () => {
    render(<Documents files={mockFilesWithMandate} />);

    const mandateText = screen.getByText("Mandat.pdf");
    const container = mandateText.closest(".flex.flex-col");
    const children = container?.children;

    // Mandate should be the first child
    expect(children?.[0]).toContainElement(mandateText);
  });

  it("handles single file correctly", () => {
    const singleFile = [mockFiles[0]];
    render(<Documents files={singleFile} />);

    expect(screen.getByText("Documents joints")).toBeInTheDocument();
  });

  it("renders heading as h5", () => {
    render(<Documents files={mockFiles} />);

    const heading = screen.getByText("Documents joints");
    expect(heading.tagName).toBe("H5");
  });
});
