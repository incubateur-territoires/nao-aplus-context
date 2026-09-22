import { render, screen } from "@testing-library/react";
import { EmailSection } from "./email-section";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

describe("EmailSection", () => {
  it("renders the connection identifiers section", () => {
    render(<EmailSection email="test@example.com" />);

    expect(screen.getByText("Identifiants de connexion")).toBeInTheDocument();
    expect(screen.getByText("Adresse e-mail")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
  });

  it("displays email modification notice", () => {
    render(<EmailSection email="test@example.com" />);

    expect(
      screen.getByText(/Vous ne pouvez pas modifier votre adresse e-mail/),
    ).toBeInTheDocument();
  });

  it("contains a link to contact support", () => {
    render(<EmailSection email="test@example.com" />);

    const link = screen.getByRole("link", { name: /contactez notre support/i });
    expect(link).toHaveAttribute("href", "/contact");
  });

  it("renders password field and change button", () => {
    render(<EmailSection email="test@example.com" />);

    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Changer votre mot de passe" }),
    ).toBeInTheDocument();
  });
});
