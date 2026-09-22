import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { TeamsFilters } from "./teams-filters";

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    area: {
      getMyAreas: {
        queryOptions: () => ({ queryKey: ["area", "getMyAreas"] }),
      },
    },
    organization: {
      getMyOrganizations: {
        queryOptions: () => ({
          queryKey: ["organization", "getMyOrganizations"],
        }),
      },
    },
    user: {
      isSupervisor: {
        queryOptions: () => ({ queryKey: ["user", "isSupervisor"] }),
      },
    },
  }),
}));

interface MockArea {
  id: string;
  name: string;
  inseeCode: string;
}
interface MockOrg {
  id: string;
  name: string;
  shortName: string | null;
}

const AREAS: MockArea[] = [
  { id: "area-1", name: "Pas-de-Calais", inseeCode: "62" },
  { id: "area-2", name: "Bas-Rhin", inseeCode: "67" },
];

const ORGS: MockOrg[] = [
  { id: "org-1", name: "France Services", shortName: "FS" },
  { id: "org-2", name: "CAF", shortName: "CAF" },
  { id: "org-3", name: "Préfecture", shortName: null },
];

function setupMocks(
  areas: MockArea[] = AREAS,
  orgs: MockOrg[] = ORGS,
  isSupervisor = false,
) {
  (useQuery as jest.Mock).mockImplementation((opts: { queryKey: string[] }) => {
    const key = opts?.queryKey?.[0];
    if (key === "area") return { data: areas };
    if (key === "organization") return { data: orgs };
    if (key === "user") return { data: isSupervisor };
    return { data: undefined };
  });
}

describe("TeamsFilters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title, labels and both selectors", () => {
    setupMocks();
    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Filtrer")).toBeInTheDocument();
    expect(screen.getByText("Filtrer par territoire")).toBeInTheDocument();
    expect(screen.getByText("Filtrer par organisation")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Département(s)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Organisation(s)")).toBeInTheDocument();
  });

  it("hides the organization filter for supervisors", () => {
    setupMocks(AREAS, ORGS, true);
    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Filtrer par territoire")).toBeInTheDocument();
    expect(
      screen.queryByText("Filtrer par organisation"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Organisation(s)"),
    ).not.toBeInTheDocument();
  });

  it("does not render tag rows when no selection", () => {
    setupMocks();
    const { container } = render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(container.querySelectorAll(".fr-tag--dismiss").length).toBe(0);
  });

  it("handles empty data from queries without crashing", () => {
    setupMocks([], []);
    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Filtrer")).toBeInTheDocument();
  });

  it("tolerates undefined query data", () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined });
    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Filtrer")).toBeInTheDocument();
  });

  it("renders selected areas as dismissible tags", () => {
    setupMocks();
    render(
      <TeamsFilters
        areaIds={["area-1", "area-2"]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Pas-de-Calais")).toBeInTheDocument();
    expect(screen.getByText("Bas-Rhin")).toBeInTheDocument();
  });

  it("falls back to area id when area is unknown in the map", () => {
    setupMocks();
    render(
      <TeamsFilters
        areaIds={["unknown-area-id"]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("unknown-area-id")).toBeInTheDocument();
  });

  it("removes an area when its tag is clicked", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onAreaIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={["area-1", "area-2"]}
        organizationIds={[]}
        onAreaIdsChange={onAreaIdsChange}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    await user.click(screen.getByText("Pas-de-Calais"));

    expect(onAreaIdsChange).toHaveBeenCalledWith(["area-2"]);
  });

  it("renders an org with different shortName as 'name (shortName)'", () => {
    setupMocks();
    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={["org-1"]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("France Services (FS)")).toBeInTheDocument();
  });

  it("renders an org as 'name' when shortName equals name", () => {
    setupMocks();
    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={["org-2"]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("CAF")).toBeInTheDocument();
    expect(screen.queryByText("CAF (CAF)")).not.toBeInTheDocument();
  });

  it("renders an org as 'name' when shortName is null", () => {
    setupMocks();
    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={["org-3"]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Préfecture")).toBeInTheDocument();
  });

  it("falls back to org id when org is unknown", () => {
    setupMocks();
    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={["unknown-org"]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    expect(screen.getByText("unknown-org")).toBeInTheDocument();
  });

  it("removes an organization when its tag is clicked", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onOrganizationIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={["org-1", "org-2"]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={onOrganizationIdsChange}
      />,
    );

    await user.click(screen.getByText("France Services (FS)"));

    expect(onOrganizationIdsChange).toHaveBeenCalledWith(["org-2"]);
  });

  it("selects an area via the Autocomplete dropdown", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onAreaIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={onAreaIdsChange}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    const areaInput = screen.getByPlaceholderText("Département(s)");
    await user.click(areaInput);

    const option = await screen.findByRole("option", { name: /Pas-de-Calais/ });
    await user.click(option);

    expect(onAreaIdsChange).toHaveBeenCalledWith(["area-1"]);
  });

  it("selects an organization via the Autocomplete dropdown", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onOrganizationIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={onOrganizationIdsChange}
      />,
    );

    const orgInput = screen.getByPlaceholderText("Organisation(s)");
    await user.click(orgInput);

    const option = await screen.findByRole("option", { name: /CAF/ });
    await user.click(option);

    expect(onOrganizationIdsChange).toHaveBeenCalledWith(["org-2"]);
  });

  it("'Tout sélectionner' selects every area", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onAreaIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={onAreaIdsChange}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("Département(s)"));
    const toggle = await screen.findByRole("option", {
      name: /Tout sélectionner/,
    });
    await user.click(toggle);

    expect(onAreaIdsChange).toHaveBeenCalledWith(["area-1", "area-2"]);
  });

  it("'Tout désélectionner' clears all selected areas", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onAreaIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={["area-1", "area-2"]}
        organizationIds={[]}
        onAreaIdsChange={onAreaIdsChange}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("Département(s)"));
    const toggle = await screen.findByRole("option", {
      name: /Tout désélectionner/,
    });
    await user.click(toggle);

    expect(onAreaIdsChange).toHaveBeenCalledWith([]);
  });

  it("'Tout sélectionner' selects every organization", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onOrganizationIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={onOrganizationIdsChange}
      />,
    );

    await user.click(screen.getByPlaceholderText("Organisation(s)"));
    const toggle = await screen.findByRole("option", {
      name: /Tout sélectionner/,
    });
    await user.click(toggle);

    expect(onOrganizationIdsChange).toHaveBeenCalledWith([
      "org-1",
      "org-2",
      "org-3",
    ]);
  });

  it("'Tout désélectionner' clears all selected organizations", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onOrganizationIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={["org-1", "org-2", "org-3"]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={onOrganizationIdsChange}
      />,
    );

    await user.click(screen.getByPlaceholderText("Organisation(s)"));
    const toggle = await screen.findByRole("option", {
      name: /Tout désélectionner/,
    });
    await user.click(toggle);

    expect(onOrganizationIdsChange).toHaveBeenCalledWith([]);
  });

  it("shows 'aucun département trouvé' when no areas available", async () => {
    setupMocks([], ORGS);
    const user = userEvent.setup();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("Département(s)"));

    expect(
      await screen.findByText("Aucun département trouvé"),
    ).toBeInTheDocument();
  });

  it("shows 'aucune organisation trouvée' when no orgs available", async () => {
    setupMocks(AREAS, []);
    const user = userEvent.setup();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("Organisation(s)"));

    expect(
      await screen.findByText("Aucune organisation trouvée"),
    ).toBeInTheDocument();
  });

  it("unselects an area when its option is clicked again", async () => {
    setupMocks();
    const user = userEvent.setup();
    const onAreaIdsChange = jest.fn();

    render(
      <TeamsFilters
        areaIds={["area-1"]}
        organizationIds={[]}
        onAreaIdsChange={onAreaIdsChange}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("Département(s)"));
    const option = await screen.findByRole("option", { name: /Pas-de-Calais/ });
    await user.click(option);

    expect(onAreaIdsChange).toHaveBeenCalledWith([]);
  });

  it("renders org shortName suffix inside the dropdown option", async () => {
    setupMocks();
    const user = userEvent.setup();

    render(
      <TeamsFilters
        areaIds={[]}
        organizationIds={[]}
        onAreaIdsChange={jest.fn()}
        onOrganizationIdsChange={jest.fn()}
      />,
    );

    await user.click(screen.getByPlaceholderText("Organisation(s)"));
    const option = await screen.findByRole("option", {
      name: /France Services/,
    });

    expect(within(option).getByText("(FS)")).toBeInTheDocument();
  });
});
