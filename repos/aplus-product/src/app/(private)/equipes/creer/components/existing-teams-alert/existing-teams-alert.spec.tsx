import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExistingTeamsAlert, type ExistingTeam } from "./existing-teams-alert";

const mockTeams: ExistingTeam[] = [
  {
    id: "team-1",
    name: "Équipe Alpha",
    email: "alpha@example.com",
    areas: [{ id: "area-1", name: "Nord", inseeCode: "59" }],
    organization: { shortName: "CAF" },
  },
  {
    id: "team-2",
    name: "Équipe Beta",
    email: null,
    areas: [{ id: "area-2", name: "Pas-de-Calais", inseeCode: "62" }],
    organization: { shortName: "CPAM" },
  },
  {
    id: "team-3",
    name: "Équipe Gamma",
    email: "gamma@example.com",
    areas: [
      { id: "area-1", name: "Nord", inseeCode: "59" },
      { id: "area-2", name: "Pas-de-Calais", inseeCode: "62" },
      { id: "area-3", name: "Somme", inseeCode: "80" },
    ],
    organization: { shortName: "PREF" },
  },
];

describe("ExistingTeamsAlert", () => {
  describe("rendering", () => {
    it("renders the warning title and description", () => {
      render(<ExistingTeamsAlert teams={mockTeams} />);

      expect(screen.getByText("Équipes déjà existantes")).toBeInTheDocument();
      expect(
        screen.getByText(/Les équipes suivantes existent déjà/),
      ).toBeInTheDocument();
    });

    it("renders all team names in the table", () => {
      render(<ExistingTeamsAlert teams={mockTeams} />);

      expect(screen.getByText("Équipe Alpha")).toBeInTheDocument();
      expect(screen.getByText("Équipe Beta")).toBeInTheDocument();
      expect(screen.getByText("Équipe Gamma")).toBeInTheDocument();
    });

    it("renders organization short names", () => {
      render(<ExistingTeamsAlert teams={mockTeams} />);

      expect(screen.getByText("CAF")).toBeInTheDocument();
      expect(screen.getByText("CPAM")).toBeInTheDocument();
      expect(screen.getByText("PREF")).toBeInTheDocument();
    });

    it("renders email when available and dash when null", () => {
      render(<ExistingTeamsAlert teams={mockTeams} />);

      expect(screen.getByText("alpha@example.com")).toBeInTheDocument();
      expect(screen.getByText("gamma@example.com")).toBeInTheDocument();

      // Équipe Beta has no email, should show "-"
      const rows = screen.getAllByRole("row");
      const betaRow = rows.find((row) =>
        within(row).queryByText("Équipe Beta"),
      );
      expect(betaRow).toBeInTheDocument();
      expect(within(betaRow!).getByText("-")).toBeInTheDocument();
    });

    it("truncates areas when more than 2", () => {
      render(<ExistingTeamsAlert teams={mockTeams} />);

      // Équipe Gamma has 3 areas, should show first 2 with "..."
      expect(
        screen.getByText("Nord (59), Pas-de-Calais (62)..."),
      ).toBeInTheDocument();
    });

    it("shows all areas when 2 or fewer", () => {
      render(<ExistingTeamsAlert teams={mockTeams} />);

      expect(screen.getByText("Nord (59)")).toBeInTheDocument();
      expect(screen.getByText("Pas-de-Calais (62)")).toBeInTheDocument();
    });

    it("renders sort buttons in table headers", () => {
      render(<ExistingTeamsAlert teams={mockTeams} />);

      expect(screen.getByRole("button", { name: /Nom/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Territoire/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Organisation/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Adresse e-mail/i }),
      ).toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("sorts by name ascending by default", () => {
      render(<ExistingTeamsAlert teams={mockTeams} />);

      const rows = screen.getAllByRole("row");
      // First row is header, data rows start at index 1
      expect(within(rows[1]).getByText("Équipe Alpha")).toBeInTheDocument();
      expect(within(rows[2]).getByText("Équipe Beta")).toBeInTheDocument();
      expect(within(rows[3]).getByText("Équipe Gamma")).toBeInTheDocument();
    });

    it("toggles sort direction when clicking same column", async () => {
      const user = userEvent.setup();
      render(<ExistingTeamsAlert teams={mockTeams} />);

      const nameButton = screen.getByRole("button", { name: /Nom/i });
      await user.click(nameButton);

      const rows = screen.getAllByRole("row");
      // After clicking, should be descending: Gamma, Beta, Alpha
      expect(within(rows[1]).getByText("Équipe Gamma")).toBeInTheDocument();
      expect(within(rows[2]).getByText("Équipe Beta")).toBeInTheDocument();
      expect(within(rows[3]).getByText("Équipe Alpha")).toBeInTheDocument();
    });

    it("sorts by organization when clicking organization header", async () => {
      const user = userEvent.setup();
      render(<ExistingTeamsAlert teams={mockTeams} />);

      const orgButton = screen.getByRole("button", { name: /Organisation/i });
      await user.click(orgButton);

      const rows = screen.getAllByRole("row");
      // Ascending: CAF, CPAM, PREF
      expect(within(rows[1]).getByText("CAF")).toBeInTheDocument();
      expect(within(rows[2]).getByText("CPAM")).toBeInTheDocument();
      expect(within(rows[3]).getByText("PREF")).toBeInTheDocument();
    });

    it("sorts by territory when clicking territory header", async () => {
      const user = userEvent.setup();
      render(<ExistingTeamsAlert teams={mockTeams} />);

      const territoryButton = screen.getByRole("button", {
        name: /Territoire/i,
      });
      await user.click(territoryButton);

      const rows = screen.getAllByRole("row");
      // First area sorted: Nord (Alpha, Gamma), Pas-de-Calais (Beta)
      // Alpha and Gamma both have Nord as first, sorted by area name
      expect(within(rows[1]).getByText("Équipe Alpha")).toBeInTheDocument();
      expect(within(rows[2]).getByText("Équipe Gamma")).toBeInTheDocument();
      expect(within(rows[3]).getByText("Équipe Beta")).toBeInTheDocument();
    });

    it("sorts by email when clicking email header", async () => {
      const user = userEvent.setup();
      render(<ExistingTeamsAlert teams={mockTeams} />);

      const emailButton = screen.getByRole("button", {
        name: /Adresse e-mail/i,
      });
      await user.click(emailButton);

      const rows = screen.getAllByRole("row");
      // Empty emails sort first (empty string), then alphabetically
      // Beta (null/""), Alpha (alpha@), Gamma (gamma@)
      expect(within(rows[1]).getByText("Équipe Beta")).toBeInTheDocument();
      expect(within(rows[2]).getByText("Équipe Alpha")).toBeInTheDocument();
      expect(within(rows[3]).getByText("Équipe Gamma")).toBeInTheDocument();
    });

    it("resets to ascending when switching columns", async () => {
      const user = userEvent.setup();
      render(<ExistingTeamsAlert teams={mockTeams} />);

      // Click name to make it descending
      const nameButton = screen.getByRole("button", { name: /Nom/i });
      await user.click(nameButton);

      // Switch to organization column
      const orgButton = screen.getByRole("button", { name: /Organisation/i });
      await user.click(orgButton);

      const rows = screen.getAllByRole("row");
      // Should be ascending by organization
      expect(within(rows[1]).getByText("CAF")).toBeInTheDocument();
      expect(within(rows[2]).getByText("CPAM")).toBeInTheDocument();
      expect(within(rows[3]).getByText("PREF")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("renders correctly with a single team", () => {
      render(<ExistingTeamsAlert teams={[mockTeams[0]]} />);

      expect(screen.getByText("Équipe Alpha")).toBeInTheDocument();
      expect(screen.getAllByRole("row")).toHaveLength(2); // header + 1 data row
    });

    it("renders table structure with empty areas", () => {
      const teamWithNoAreas: ExistingTeam = {
        id: "team-empty",
        name: "Équipe Vide",
        email: null,
        areas: [],
        organization: { shortName: "TEST" },
      };

      render(<ExistingTeamsAlert teams={[teamWithNoAreas]} />);

      expect(screen.getByText("Équipe Vide")).toBeInTheDocument();
    });
  });
});
