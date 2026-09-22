import { render, screen } from "@testing-library/react";
import { UserLink } from "./user-link";
import { USER_ROLES } from "@/test/mocks";

const mockUseSession = jest.fn();

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => mockUseSession(),
}));

describe("UserLink", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
  });

  it("renders user name as plain text when user is not admin", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "current-user",
          email: "test@example.com",
          role: "user",
        },
      },
      isPending: false,
    });

    render(<UserLink userId="user-1" firstName="Jean" lastName="Dupont" />);

    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders user name as link when user is admin", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "admin-user",
          email: "admin@example.com",
          role: USER_ROLES.ADMIN,
        },
      },
      isPending: false,
    });

    render(<UserLink userId="user-1" firstName="Jean" lastName="Dupont" />);

    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/utilisateurs/modifier/user-1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("Jean Dupont");
  });

  it("displays inactive suffix when user is inactive (non-admin)", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "current-user",
          email: "test@example.com",
          role: "user",
        },
      },
      isPending: false,
    });

    render(
      <UserLink
        userId="user-1"
        firstName="Jean"
        lastName="Dupont"
        isInactive={true}
      />,
    );

    expect(screen.getByText(/Jean Dupont.*\(inactif\)/)).toBeInTheDocument();
  });

  it("displays inactive suffix when user is inactive (admin)", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "admin-user",
          email: "admin@example.com",
          role: USER_ROLES.ADMIN,
        },
      },
      isPending: false,
    });

    render(
      <UserLink
        userId="user-1"
        firstName="Jean"
        lastName="Dupont"
        isInactive={true}
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Jean Dupont");
    expect(link).toHaveTextContent("(inactif)");
  });

  it("applies custom className", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "current-user",
          email: "test@example.com",
          role: "user",
        },
      },
      isPending: false,
    });

    render(
      <UserLink
        userId="user-1"
        firstName="Jean"
        lastName="Dupont"
        className="custom-class"
      />,
    );

    expect(screen.getByText("Jean Dupont")).toHaveClass("custom-class");
  });

  it("renders plain text when session is not available", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
    });

    render(<UserLink userId="user-1" firstName="Jean" lastName="Dupont" />);

    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
