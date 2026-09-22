import { render, screen } from "@testing-library/react";
import { InviteSectionHeader } from "./invite-section-header";

describe("InviteSectionHeader", () => {
  it("renders with 'd'autres utilisateurs' ", () => {
    render(<InviteSectionHeader showColleaguesToInvite={true} />);
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Inviter d'autres utilisateurs",
    );
  });

  it("has correct heading level", () => {
    render(<InviteSectionHeader showColleaguesToInvite={true} />);
    const heading = screen.getByRole("heading");
    expect(heading.tagName).toBe("H2");
  });

  it("has correct styling classes", () => {
    render(<InviteSectionHeader showColleaguesToInvite={true} />);
    const heading = screen.getByRole("heading");
    expect(heading).toHaveClass(
      "text-[32px]",
      "font-bold",
      "leading-[40px]",
      "text-[#161616]",
      "m-0",
    );
  });
});
