import { render, screen } from "@testing-library/react";
import { LoadingState } from "./loading-state";

describe("LoadingState", () => {
  it("renders spinner component", () => {
    render(<LoadingState />);
    const spinner = screen.getByTestId("spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("has correct container styling", () => {
    const { container } = render(<LoadingState />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(
      "flex",
      "justify-center",
      "items-center",
      "min-h-md",
      "bg-white",
      "p-20",
      "rounded-md",
    );
  });
});
