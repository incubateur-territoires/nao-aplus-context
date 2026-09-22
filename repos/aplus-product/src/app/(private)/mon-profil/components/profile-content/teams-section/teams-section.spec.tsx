import { render, screen } from "@testing-library/react";
import { TeamsSection } from "./teams-section";
import { Team } from "better-auth/plugins";
import { MOCK_IDS } from "@/test/mocks";
import { ROUTE } from "@/app/constant/route";

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

describe("TeamsSection", () => {
  it("renders teams when provided", () => {
    const teams = [
      { id: MOCK_IDS.TEAM_1, name: "Team 1" },
      { id: MOCK_IDS.TEAM_2, name: "Team 2" },
    ];

    render(<TeamsSection teams={teams} />);

    expect(screen.getByText("Équipes")).toBeInTheDocument();
    expect(
      screen.getByText("Vous faites partie des équipes :"),
    ).toBeInTheDocument();
    expect(screen.getByText("Team 1")).toBeInTheDocument();
    expect(screen.getByText("Team 2")).toBeInTheDocument();
  });

  it("does not render when teams array is empty", () => {
    const { container } = render(<TeamsSection teams={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("does not render when teams is null", () => {
    const { container } = render(
      <TeamsSection teams={null as unknown as Team[]} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders team links", () => {
    const teams = [{ id: MOCK_IDS.TEAM_1, name: "Team 1" }];

    render(<TeamsSection teams={teams} />);

    const link = screen.getByRole("link", { name: "Team 1" });
    expect(link).toHaveAttribute("href", `${ROUTE.TEAMS}/${MOCK_IDS.TEAM_1}`);
  });
});
