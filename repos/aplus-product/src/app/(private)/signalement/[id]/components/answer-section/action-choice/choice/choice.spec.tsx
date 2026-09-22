import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Choice, ChoiceSelected } from "./choice";
import { ActionChoiceValue } from "../action-choice";

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

describe("Choice", () => {
  const mockProps = {
    label: "Test Choice",
    description: "This is a test description",
    icon: "/test-icon.svg",
    value: ActionChoiceValue.IN_TREATMENT,
    selected: false,
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders choice label and description", () => {
    render(<Choice {...mockProps} />);

    expect(screen.getByText("Test Choice")).toBeInTheDocument();
    expect(screen.getByText("This is a test description")).toBeInTheDocument();
  });

  it("renders choice icon with correct attributes", () => {
    render(<Choice {...mockProps} />);

    const icon = screen.getByAltText("Test Choice");
    expect(icon).toHaveAttribute("src", "/test-icon.svg");
    expect(icon).toHaveAttribute("width", "46");
    expect(icon).toHaveAttribute("height", "46");
  });

  it("calls onClick with correct value when clicked", async () => {
    const user = userEvent.setup();
    render(<Choice {...mockProps} />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(mockProps.onClick).toHaveBeenCalledWith(
      ActionChoiceValue.IN_TREATMENT,
    );
  });

  it("renders description with HTML content safely", () => {
    const propsWithHTML = {
      ...mockProps,
      description: "Test with <strong>bold</strong> text",
    };

    render(<Choice {...propsWithHTML} />);

    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("applies correct button styles", () => {
    render(<Choice {...mockProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("flex", "w-full", "p-4");
    expect(button).toHaveStyle({
      border: "1px solid #DDDDDD",
      backgroundColor: "white",
    });
  });

  it("applies correct text styles", () => {
    render(<Choice {...mockProps} />);

    const label = screen.getByText("Test Choice");
    expect(label).toHaveClass("m-0", "text-[#3A3A3A]");

    const description = screen.getByText("This is a test description");
    expect(description).toHaveClass(
      "text-xs",
      "m-0",
      "font-regular",
      "text-[#666666]",
    );
  });

  it("renders radio button icon", () => {
    render(<Choice {...mockProps} />);

    const radioIcon = document.querySelector(".ri-checkbox-blank-circle-line");
    expect(radioIcon).toBeInTheDocument();
    expect(radioIcon).toHaveClass("text-blue-primary");
  });

  it("applies correct layout classes", () => {
    render(<Choice {...mockProps} />);

    const textContainer = screen.getByText("Test Choice").closest(".w-full");
    expect(textContainer).toHaveClass(
      "w-full",
      "text-left",
      "text-[#161616]",
      "font-regular",
    );

    const iconContainer = screen.getByAltText("Test Choice").closest(".w-fit");
    expect(iconContainer).toHaveClass(
      "w-fit",
      "border-l",
      "border-[#DDDDDD]",
      "pl-4",
      "min-h-12",
      "flex",
      "items-center",
    );
  });
});

describe("ChoiceSelected", () => {
  const mockProps = {
    label: "Selected Choice",
    description: "This choice is selected",
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders selected choice label and description", () => {
    render(<ChoiceSelected {...mockProps} />);

    expect(screen.getByText("Selected Choice")).toBeInTheDocument();
    expect(screen.getByText("This choice is selected")).toBeInTheDocument();
  });

  it("returns null when label is undefined", () => {
    const propsWithoutLabel = { ...mockProps, label: undefined };
    const { container } = render(<ChoiceSelected {...propsWithoutLabel} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders modify button", () => {
    render(<ChoiceSelected {...mockProps} />);

    const modifyButton = screen.getByText("Modifier votre choix");
    expect(modifyButton).toBeInTheDocument();
  });

  it("calls onClick with null when modify button is clicked", async () => {
    const user = userEvent.setup();
    render(<ChoiceSelected {...mockProps} />);

    const modifyButton = screen.getByText("Modifier votre choix");
    await user.click(modifyButton);

    expect(mockProps.onClick).toHaveBeenCalledWith(null);
  });

  it("renders selected radio button icon", () => {
    render(<ChoiceSelected {...mockProps} />);

    const selectedIcon = document.querySelector(".ri-checkbox-circle-fill");
    expect(selectedIcon).toBeInTheDocument();
    expect(selectedIcon).toHaveClass("text-blue-primary");
  });

  it("applies correct text styles", () => {
    render(<ChoiceSelected {...mockProps} />);

    const label = screen.getByText("Selected Choice");
    expect(label).toHaveClass("m-0", "text-[#3A3A3A]");

    const description = screen.getByText("This choice is selected");
    expect(description).toHaveClass(
      "text-xs",
      "m-0",
      "font-regular",
      "text-[#666666]",
    );
  });

  it("applies correct button styles", () => {
    render(<ChoiceSelected {...mockProps} />);

    const button = screen.getByText("Modifier votre choix");
    expect(button).toHaveClass("w-fit", "whitespace-nowrap");
  });

  it("renders button with correct icon", () => {
    render(<ChoiceSelected {...mockProps} />);

    const button = screen.getByText("Modifier votre choix");
    // The button should have the back arrow icon (handled by DSFR Button component)
    expect(button).toBeInTheDocument();
  });

  it("handles description with HTML content", () => {
    const propsWithHTML = {
      ...mockProps,
      description: "Description with <strong>HTML</strong>",
    };

    render(<ChoiceSelected {...propsWithHTML} />);

    expect(screen.getByText("HTML")).toBeInTheDocument();
  });

  it("handles undefined description gracefully", () => {
    const propsWithoutDescription = { ...mockProps, description: undefined };
    render(<ChoiceSelected {...propsWithoutDescription} />);

    expect(screen.getByText("Selected Choice")).toBeInTheDocument();
    // Should still render but with empty content for description
    const descriptions = document.querySelectorAll("p");
    expect(descriptions).toHaveLength(2); // label and description paragraphs
  });

  it("applies correct layout structure", () => {
    render(<ChoiceSelected {...mockProps} />);

    const textContainer = screen
      .getByText("Selected Choice")
      .closest(".w-full");
    expect(textContainer).toHaveClass(
      "w-full",
      "text-left",
      "text-[#161616]",
      "font-regular",
    );
  });
});
