import { render, screen } from "@testing-library/react";
import { TeamCard } from "./team-card";
import { MOCK_IDS } from "@/test/mocks";
import { createMockTeamCard } from "@/test/utils/global-mocks";
import type { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import type { AppRouter } from "@/trpc/routers/_app";

type TeamCardTeam =
  inferRouterOutputs<AppRouter>["team"]["getMyTeams"]["items"][number];

describe("TeamCard", () => {
  const mockTeam = createMockTeamCard({
    registrationNumber: "4564556456456",
  });

  it("renders team information correctly", () => {
    render(<TeamCard team={mockTeam} canEdit={false} />);

    expect(screen.getByText("FS Arras")).toBeInTheDocument();
    expect(screen.getByText(/Pas-de-Calais \(62\)/)).toBeInTheDocument();
    expect(screen.getByText(/matricule/)).toBeInTheDocument();
    expect(screen.getByText("4564556456456")).toBeInTheDocument();
    expect(screen.getByText("FS - France services")).toBeInTheDocument();
  });

  it("displays member count in plural when team has multiple members", () => {
    render(<TeamCard team={mockTeam} canEdit={false} />);

    expect(screen.getByText(/4 membres/)).toBeInTheDocument();
  });

  it("displays member count in singular when team has one member", () => {
    const teamWithOneMember = { ...mockTeam, _count: { users: 1 } };
    render(<TeamCard team={teamWithOneMember} canEdit={false} />);

    expect(screen.getByText(/1 membre/)).toBeInTheDocument();
    expect(screen.queryByText(/membres/)).not.toBeInTheDocument();
  });

  it("displays member count of zero in singular", () => {
    const teamWithNoMembers = { ...mockTeam, _count: { users: 0 } };
    render(<TeamCard team={teamWithNoMembers} canEdit={false} />);

    expect(screen.getByText(/0 membre/)).toBeInTheDocument();
    expect(screen.queryByText(/membres/)).not.toBeInTheDocument();
  });

  it("displays email when present", () => {
    const teamWithEmail = {
      ...mockTeam,
      email: "fsarras@france-services.gouv.fr",
    };
    render(<TeamCard team={teamWithEmail} canEdit={false} />);

    expect(
      screen.getByText("fsarras@france-services.gouv.fr"),
    ).toBeInTheDocument();
  });

  it("does not display email section when email is null", () => {
    render(<TeamCard team={mockTeam} canEdit={false} />);

    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("renders edit link when canEdit is true", () => {
    render(<TeamCard team={mockTeam} canEdit={true} />);

    const editLink = screen.getByRole("link", { name: /Modifier l'équipe/ });
    expect(editLink).toBeInTheDocument();
    expect(editLink).toHaveAttribute("href", `/equipes/${MOCK_IDS.TEAM_1}`);
  });

  it("renders view button when canEdit is false", () => {
    render(<TeamCard team={mockTeam} canEdit={false} />);

    expect(screen.queryByText(/Modifier l'équipe/)).not.toBeInTheDocument();
    expect(screen.getByText(/Voir l'équipe/)).toBeInTheDocument();
  });

  it("renders description text when canEdit is true", () => {
    render(<TeamCard team={mockTeam} canEdit={true} />);

    expect(
      screen.getByText(
        /Ajouter ou supprimer des membres, changer le nom ou la description de l'équipe/,
      ),
    ).toBeInTheDocument();
  });

  it("handles team without area", () => {
    const teamWithoutArea = {
      ...mockTeam,
      areas: [],
    };

    render(<TeamCard team={teamWithoutArea} canEdit={false} />);

    expect(screen.getByText("FS Arras")).toBeInTheDocument();
    expect(screen.queryByText(/Pas-de-Calais/)).not.toBeInTheDocument();
  });

  it("displays all areas when team has multiple areas", () => {
    const teamWithMultipleAreas: TeamCardTeam = {
      ...mockTeam,
      areas: [
        {
          id: "area-1",
          name: "Pas-de-Calais",
          inseeCode: "62",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "area-2",
          name: "Nord",
          inseeCode: "59",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "area-3",
          name: "Somme",
          inseeCode: "80",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as TeamCardTeam;

    render(<TeamCard team={teamWithMultipleAreas} canEdit={false} />);

    expect(screen.getByText(/Pas-de-Calais \(62\)/)).toBeInTheDocument();
    expect(screen.getByText(/Nord \(59\)/)).toBeInTheDocument();
    expect(screen.getByText(/Somme \(80\)/)).toBeInTheDocument();
  });

  it("handles team without matricule", () => {
    const teamWithoutMatricule: TeamCardTeam = {
      ...mockTeam,
      registrationNumber: null,
    } as TeamCardTeam;

    render(<TeamCard team={teamWithoutMatricule} canEdit={false} />);

    expect(screen.getByText("FS Arras")).toBeInTheDocument();
    // Component doesn't render matricule when registrationNumber is null
    expect(screen.queryByText(/matricule/)).not.toBeInTheDocument();
    expect(screen.queryByText("4564556456456")).not.toBeInTheDocument();
  });

  it("uses organization name when shortName is not available", () => {
    const teamWithoutShortName = {
      ...mockTeam,
      organization: {
        ...mockTeam.organization,
        shortName: "",
      },
    };

    render(<TeamCard team={teamWithoutShortName} canEdit={false} />);

    expect(screen.getByText("France Services")).toBeInTheDocument();
  });

  it("renders edit link when canEdit is true (admin scenario)", () => {
    render(<TeamCard team={mockTeam} canEdit={true} />);

    const editLink = screen.getByRole("link", { name: /Modifier l'équipe/ });
    expect(editLink).toBeInTheDocument();
    expect(editLink).toHaveAttribute("href", `/equipes/${MOCK_IDS.TEAM_1}`);
  });

  it("renders view button when canEdit is false (non-manager scenario)", () => {
    render(<TeamCard team={mockTeam} canEdit={false} />);

    expect(screen.getByText(/Voir l'équipe/)).toBeInTheDocument();
    expect(screen.queryByText(/Modifier l'équipe/)).not.toBeInTheDocument();
  });
});
