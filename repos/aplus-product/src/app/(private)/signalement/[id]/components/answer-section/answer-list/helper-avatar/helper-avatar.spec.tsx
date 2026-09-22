import { render } from "@testing-library/react";
import { HelperAvatar } from "./helper-avatar";

describe("HelperAvatar", () => {
  it("renders with author answer styling", () => {
    const { container } = render(
      <HelperAvatar isAuthorAnswer={true} isOperatorOnly={false} />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "64");
    expect(svg).toHaveAttribute("height", "64");
  });

  it("renders with instructor only styling", () => {
    const { container } = render(
      <HelperAvatar isAuthorAnswer={false} isOperatorOnly={true} />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders with helper styling", () => {
    const { container } = render(
      <HelperAvatar isAuthorAnswer={false} isOperatorOnly={false} />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
