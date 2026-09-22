import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockUseQuery, mockUseMutation } from "@/test/utils/global-mocks";
import { ReportStatus } from "@/generated/prisma/enums";
import {
  ExportReports,
  durationToDays,
  getClosingDate,
  getFirstTreatmentDate,
  buildRows,
  generateXlsx,
} from "./export-reports";

// ─── Helpers ────────────────────────────────────────────────

function createMockReportRow(overrides = {}) {
  return {
    id: "report-1",
    createdAt: new Date("2024-06-15T10:00:00Z"),
    status: ReportStatus.IN_TREATMENT,
    overdueAt: null,
    area: { name: "Aisne" },
    author: { firstName: "Jean", lastName: "DUPONT" },
    coAuthors: [],
    applicantTeam: {
      name: "FS Laon",
      organization: { shortName: "FS" },
    },
    requestedTeams: [
      { name: "CPAM Aisne", _count: { users: 3 } },
      { name: "CAF 02", _count: { users: 2 } },
    ],
    _count: { answers: 4 },
    answers: [
      { isIrrelevant: false, createdAt: new Date("2024-06-16T08:00:00Z") },
    ],
    statusHistory: [
      {
        status: ReportStatus.PENDING_ASSIGNMENT,
        createdAt: new Date("2024-06-15T10:00:00Z"),
      },
      {
        status: ReportStatus.IN_TREATMENT,
        createdAt: new Date("2024-06-16T09:00:00Z"),
      },
    ],
    ...overrides,
  };
}

function setupAreas(areas: { id: string; name: string }[]) {
  mockUseQuery.mockImplementation((options: { queryKey: string[] }) => {
    const queryKey = JSON.stringify(options.queryKey);
    if (queryKey.includes("area")) {
      return { data: areas, isLoading: false, error: null };
    }
    return { data: null, isLoading: false, error: null };
  });
}

// ─── durationToDays ─────────────────────────────────────────

describe("durationToDays", () => {
  it("returns a fraction of a day for less than 24h", () => {
    expect(durationToDays(6 * 60 * 60 * 1000)).toBe(0.25);
  });

  it("returns whole days for exact days", () => {
    expect(durationToDays(3 * 24 * 60 * 60 * 1000)).toBe(3);
  });

  it("rounds to two decimals", () => {
    expect(durationToDays((2 * 24 + 5) * 60 * 60 * 1000)).toBe(2.21);
  });

  it("returns 0 for 0ms", () => {
    expect(durationToDays(0)).toBe(0);
  });
});

// ─── getClosingDate ─────────────────────────────────────────

describe("getClosingDate", () => {
  it("returns null when no closing status in history", () => {
    const history = [
      {
        status: ReportStatus.PENDING_ASSIGNMENT,
        createdAt: new Date("2024-01-01"),
      },
      { status: ReportStatus.IN_TREATMENT, createdAt: new Date("2024-01-02") },
    ];
    expect(getClosingDate(history)).toBeNull();
  });

  it("returns date of COMPLETED status", () => {
    const history = [
      {
        status: ReportStatus.PENDING_ASSIGNMENT,
        createdAt: new Date("2024-01-01"),
      },
      { status: ReportStatus.COMPLETED, createdAt: new Date("2024-01-10") },
    ];
    expect(getClosingDate(history)).toEqual(new Date("2024-01-10"));
  });

  it("returns date of CLOSED status", () => {
    const history = [
      {
        status: ReportStatus.PENDING_ASSIGNMENT,
        createdAt: new Date("2024-01-01"),
      },
      { status: ReportStatus.CLOSED, createdAt: new Date("2024-01-15") },
    ];
    expect(getClosingDate(history)).toEqual(new Date("2024-01-15"));
  });

  it("returns the last closing date when multiple closings", () => {
    const history = [
      { status: ReportStatus.COMPLETED, createdAt: new Date("2024-01-05") },
      { status: ReportStatus.IN_TREATMENT, createdAt: new Date("2024-01-06") },
      { status: ReportStatus.CLOSED, createdAt: new Date("2024-01-20") },
    ];
    expect(getClosingDate(history)).toEqual(new Date("2024-01-20"));
  });
});

// ─── getFirstTreatmentDate ──────────────────────────────────

describe("getFirstTreatmentDate", () => {
  it("returns IN_TREATMENT date when present in history", () => {
    const history = [
      {
        status: ReportStatus.PENDING_ASSIGNMENT,
        createdAt: new Date("2024-01-01"),
      },
      { status: ReportStatus.IN_TREATMENT, createdAt: new Date("2024-01-03") },
    ];
    expect(getFirstTreatmentDate(history, undefined)).toEqual(
      new Date("2024-01-03"),
    );
  });

  it("falls back to first answer date when no IN_TREATMENT in history", () => {
    const history = [
      {
        status: ReportStatus.PENDING_ASSIGNMENT,
        createdAt: new Date("2024-01-01"),
      },
    ];
    const firstAnswer = { createdAt: new Date("2024-01-05") };
    expect(getFirstTreatmentDate(history, firstAnswer)).toEqual(
      new Date("2024-01-05"),
    );
  });

  it("prefers IN_TREATMENT over first answer", () => {
    const history = [
      { status: ReportStatus.IN_TREATMENT, createdAt: new Date("2024-01-03") },
    ];
    const firstAnswer = { createdAt: new Date("2024-01-02") };
    expect(getFirstTreatmentDate(history, firstAnswer)).toEqual(
      new Date("2024-01-03"),
    );
  });

  it("returns null when no IN_TREATMENT and no answer", () => {
    const history = [
      {
        status: ReportStatus.PENDING_ASSIGNMENT,
        createdAt: new Date("2024-01-01"),
      },
    ];
    expect(getFirstTreatmentDate(history, undefined)).toBeNull();
  });
});

// ─── buildRows ──────────────────────────────────────────────

describe("buildRows", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://aplus.gouv.fr",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns headers as first row with all expected columns", () => {
    const [headers] = buildRows([]);
    expect(headers).toContain("Lien du signalement");
    expect(headers).toContain("Délais de prise en charge (jours)");
    expect(headers).toContain("Délais de clôture (jours)");
    expect(headers).toHaveLength(16);
  });

  it("generates correct row data", () => {
    const report = createMockReportRow();
    const [, row] = buildRows([report]);

    expect(row[0]).toContain("https://aplus.gouv.fr/signalement/report-1");
    expect(row[2]).toBe("Aisne");
    expect(row[3]).toContain("En cours");
    expect(row[5]).toBe("DUPONT Jean");
    expect(row[7]).toBe("FS Laon");
    expect(row[8]).toBe("FS");
    expect(row[9]).toBe("5"); // 3 + 2 recipients
    expect(row[10]).toBe("4"); // answer count
    expect(row[11]).toBe("Oui"); // relevant
  });

  it("shows empty relevance when no answers", () => {
    const report = createMockReportRow({ answers: [] });
    const [, row] = buildRows([report]);
    expect(row[11]).toBe("");
  });

  it("shows 'Non' for irrelevant reports", () => {
    const report = createMockReportRow({
      answers: [{ isIrrelevant: true, createdAt: new Date("2024-06-16") }],
    });
    const [, row] = buildRows([report]);
    expect(row[11]).toBe("Non");
  });

  it("includes co-authors separated by commas", () => {
    const report = createMockReportRow({
      coAuthors: [
        { firstName: "Marie", lastName: "MARTIN" },
        { firstName: "Luc", lastName: "BERNARD" },
      ],
    });
    const [, row] = buildRows([report]);
    expect(row[6]).toContain("MARTIN Marie");
    expect(row[6]).toContain("BERNARD Luc");
  });

  it("handles null author names", () => {
    const report = createMockReportRow({
      author: { firstName: null, lastName: null },
    });
    expect(() => buildRows([report])).not.toThrow();
  });

  it("handles null organization", () => {
    const report = createMockReportRow({
      applicantTeam: { name: "Equipe test", organization: null },
    });
    const [, row] = buildRows([report]);
    expect(row[8]).toBe("");
  });

  it("marks report as 'Oui' when overdue", () => {
    const report = createMockReportRow({ overdueAt: new Date("2024-07-01") });
    const [, row] = buildRows([report]);
    expect(row[4]).toBe("Oui");
  });

  it("handles null first name and last name in coAuthors", () => {
    const report = createMockReportRow({
      coAuthors: [{ firstName: null, lastName: null }],
    });
    expect(() => buildRows([report])).not.toThrow();
  });

  it("formats closing date and duration when present", () => {
    const report = createMockReportRow({
      status: ReportStatus.COMPLETED,
      statusHistory: [
        {
          status: ReportStatus.PENDING_ASSIGNMENT,
          createdAt: new Date("2024-06-15T10:00:00Z"),
        },
        {
          status: ReportStatus.IN_TREATMENT,
          createdAt: new Date("2024-06-16T09:00:00Z"),
        },
        {
          status: ReportStatus.COMPLETED,
          createdAt: new Date("2024-06-20T10:00:00Z"),
        },
      ],
    });
    const [, row] = buildRows([report]);
    expect(row[12]).toBe("20/06/2024");
    // Du 15/06 10:00 au 20/06 10:00 = 5 jours, en nombre pour les stats
    expect(row[15]).toBe(5);
  });

  it("leaves treatment and closing durations empty when missing", () => {
    const report = createMockReportRow({
      answers: [],
      statusHistory: [
        {
          status: ReportStatus.PENDING_ASSIGNMENT,
          createdAt: new Date("2024-06-15T10:00:00Z"),
        },
      ],
    });
    const [, row] = buildRows([report]);
    expect(row[14]).toBe(""); // treatment duration
    expect(row[15]).toBe(""); // closing duration
  });
});

// ─── generateXlsx ───────────────────────────────────────────

describe("generateXlsx", () => {
  it("returns an ArrayBuffer", () => {
    const result = generateXlsx([]);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("does not throw with multiple reports", () => {
    const reports = [
      createMockReportRow(),
      createMockReportRow({ id: "report-2" }),
    ];
    expect(() => generateXlsx(reports)).not.toThrow();
  });
});

// ─── ExportReports component ────────────────────────────────

describe("ExportReports", () => {
  it("renders nothing while areas are loading", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<ExportReports />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title and export button", () => {
    setupAreas([
      { id: "area-1", name: "Aisne" },
      { id: "area-2", name: "Oise" },
    ]);

    render(<ExportReports />);

    expect(screen.getByText("Exporter les signalements")).toBeInTheDocument();
    expect(
      screen.getByText("Exporter les signalements au format *.xlsx"),
    ).toBeInTheDocument();
  });

  it("shows territory name as text when single area", () => {
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    render(<ExportReports />);

    expect(screen.getByText("Aisne")).toBeInTheDocument();
    // No autocomplete
    expect(
      screen.queryByPlaceholderText("Département(s)"),
    ).not.toBeInTheDocument();
  });

  it("shows autocomplete dropdown when multiple areas", () => {
    setupAreas([
      { id: "area-1", name: "Aisne" },
      { id: "area-2", name: "Oise" },
    ]);

    render(<ExportReports />);

    expect(screen.getByPlaceholderText("Département(s)")).toBeInTheDocument();
  });

  it("disables export button when no area selected (multiple areas)", () => {
    setupAreas([
      { id: "area-1", name: "Aisne" },
      { id: "area-2", name: "Oise" },
    ]);

    render(<ExportReports />);

    const button = screen.getByText(
      "Exporter les signalements au format *.xlsx",
    );
    expect(button.closest("button")).toBeDisabled();
  });

  it("enables export button when single area (auto-selected)", () => {
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    render(<ExportReports />);

    const button = screen.getByText(
      "Exporter les signalements au format *.xlsx",
    );
    expect(button.closest("button")).not.toBeDisabled();
  });

  it("shows error alert when both initial call and retry fail", async () => {
    const user = userEvent.setup();
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    const mockMutateAsync = jest
      .fn()
      .mockRejectedValue(new Error("Server error"));
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    render(<ExportReports />);

    const button = screen.getByText(
      "Exporter les signalements au format *.xlsx",
    );
    await user.click(button.closest("button")!);

    await waitFor(
      () => {
        expect(
          screen.getByText(
            "Une erreur est survenue lors de l'export. Veuillez réessayer.",
          ),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });

  it("retries once when first call fails (pool timeout) and succeeds on retry", async () => {
    const user = userEvent.setup();
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    const mockMutateAsync = jest
      .fn()
      .mockRejectedValueOnce(
        new Error("timeout exceeded when trying to connect"),
      )
      .mockResolvedValueOnce({
        reports: [createMockReportRow()],
        totalCount: 1,
        limit: 5000,
      });
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    global.URL.createObjectURL = jest.fn(() => "blob:test");
    global.URL.revokeObjectURL = jest.fn();

    render(<ExportReports />);

    await user.click(
      screen
        .getByText("Exporter les signalements au format *.xlsx")
        .closest("button")!,
    );

    await waitFor(
      () => {
        expect(mockMutateAsync).toHaveBeenCalledTimes(2);
      },
      { timeout: 3000 },
    );
    expect(
      screen.queryByText(
        "Une erreur est survenue lors de l'export. Veuillez réessayer.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows truncation warning when results exceed limit", async () => {
    const user = userEvent.setup();
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    const mockMutateAsync = jest.fn().mockResolvedValue({
      reports: [createMockReportRow()],
      totalCount: 7500,
      limit: 5000,
    });
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    global.URL.createObjectURL = jest.fn(() => "blob:test");
    global.URL.revokeObjectURL = jest.fn();

    render(<ExportReports />);

    const button = screen.getByText(
      "Exporter les signalements au format *.xlsx",
    );
    await user.click(button.closest("button")!);

    await waitFor(() => {
      expect(
        screen.getByText(/signalements n.ont pas été exportés/),
      ).toBeInTheDocument();
    });
  });

  it("calls mutateAsync with correct parameters", async () => {
    const user = userEvent.setup();
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    const mockMutateAsync = jest.fn().mockResolvedValue({
      reports: [],
      totalCount: 0,
      limit: 5000,
    });
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    render(<ExportReports />);

    const button = screen.getByText(
      "Exporter les signalements au format *.xlsx",
    );
    await user.click(button.closest("button")!);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        areaIds: ["area-1"],
        startDate: undefined,
        endDate: undefined,
      });
    });
  });

  it("renders date inputs", () => {
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    render(<ExportReports />);

    expect(screen.getByText("Date de début (jj/mm/aaaa)")).toBeInTheDocument();
    expect(screen.getByText("Date de fin (jj/mm/aaaa)")).toBeInTheDocument();
  });

  it("selects an area via autocomplete and renders dismissible tag", async () => {
    const user = userEvent.setup();
    setupAreas([
      { id: "area-1", name: "Aisne" },
      { id: "area-2", name: "Oise" },
    ]);

    render(<ExportReports />);

    await user.click(screen.getByPlaceholderText("Département(s)"));
    await user.click(await screen.findByRole("option", { name: /Aisne/ }));

    const tagsList = await screen.findByRole("list", {
      name: "Territoires sélectionnés",
    });
    expect(
      within(tagsList).getByRole("button", { name: /Aisne/ }),
    ).toBeInTheDocument();
  });

  it("removes a selected area via the dismissible tag", async () => {
    const user = userEvent.setup();
    setupAreas([
      { id: "area-1", name: "Aisne" },
      { id: "area-2", name: "Oise" },
    ]);

    render(<ExportReports />);

    await user.click(screen.getByPlaceholderText("Département(s)"));
    await user.click(await screen.findByRole("option", { name: /Aisne/ }));

    const tagsList = await screen.findByRole("list", {
      name: "Territoires sélectionnés",
    });
    await user.click(within(tagsList).getByRole("button", { name: /Aisne/ }));

    await waitFor(() => {
      expect(
        screen.queryByRole("list", { name: "Territoires sélectionnés" }),
      ).not.toBeInTheDocument();
    });
  });

  it("selects all areas via 'Tout sélectionner'", async () => {
    const user = userEvent.setup();
    setupAreas([
      { id: "area-1", name: "Aisne" },
      { id: "area-2", name: "Oise" },
    ]);

    render(<ExportReports />);

    await user.click(screen.getByPlaceholderText("Département(s)"));
    await user.click(await screen.findByText("Tout sélectionner"));

    const tagsList = await screen.findByRole("list", {
      name: "Territoires sélectionnés",
    });
    expect(
      within(tagsList).getByRole("button", { name: /Aisne/ }),
    ).toBeInTheDocument();
    expect(
      within(tagsList).getByRole("button", { name: /Oise/ }),
    ).toBeInTheDocument();
  });

  it("deselects all areas via 'Tout désélectionner'", async () => {
    const user = userEvent.setup();
    setupAreas([
      { id: "area-1", name: "Aisne" },
      { id: "area-2", name: "Oise" },
    ]);

    render(<ExportReports />);

    await user.click(screen.getByPlaceholderText("Département(s)"));
    await user.click(await screen.findByText("Tout sélectionner"));
    await user.click(await screen.findByText("Tout désélectionner"));

    await waitFor(() => {
      expect(
        screen.queryByRole("list", { name: "Territoires sélectionnés" }),
      ).not.toBeInTheDocument();
    });
  });

  it("updates start and end date inputs", () => {
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    render(<ExportReports />);

    const startInput = screen.getByLabelText(
      "Date de début (jj/mm/aaaa)",
    ) as HTMLInputElement;
    const endInput = screen.getByLabelText(
      "Date de fin (jj/mm/aaaa)",
    ) as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: "2024-01-01" } });
    fireEvent.change(endInput, { target: { value: "2024-12-31" } });

    expect(startInput.value).toBe("2024-01-01");
    expect(endInput.value).toBe("2024-12-31");
    // Cross-bound min/max wiring
    expect(endInput.min).toBe("2024-01-01");
    expect(startInput.max).toBe("2024-12-31");
  });

  it("does not show truncation warning when total count fits within limit", async () => {
    const user = userEvent.setup();
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    const mockMutateAsync = jest.fn().mockResolvedValue({
      reports: [createMockReportRow()],
      totalCount: 100,
      limit: 5000,
    });
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    global.URL.createObjectURL = jest.fn(() => "blob:test");
    global.URL.revokeObjectURL = jest.fn();

    render(<ExportReports />);

    await user.click(
      screen
        .getByText("Exporter les signalements au format *.xlsx")
        .closest("button")!,
    );

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    expect(
      screen.queryByText(/signalements n.ont pas été exportés/),
    ).not.toBeInTheDocument();
  });

  it("shows info alert when no signalement matches the criteria", async () => {
    const user = userEvent.setup();
    setupAreas([{ id: "area-1", name: "Aisne" }]);

    const mockMutateAsync = jest.fn().mockResolvedValue({
      reports: [],
      totalCount: 0,
      limit: 5000,
    });
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    render(<ExportReports />);

    await user.click(
      screen
        .getByText("Exporter les signalements au format *.xlsx")
        .closest("button")!,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Aucun signalement ne correspond à vos critères."),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/signalements n.ont pas été exportés/),
    ).not.toBeInTheDocument();
  });
});
