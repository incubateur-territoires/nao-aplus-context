import { render, screen } from "@testing-library/react";
import type { AnonymizedReportPage } from "@/types/anonymized-report";
import { AnonymizedReportList } from "./anonymized-report-list";

const PAGE: AnonymizedReportPage = {
  total: 45,
  pageSize: 20,
  items: [
    {
      id: "report-1",
      createdAt: new Date("2026-01-15T10:00:00.000Z"),
      subject: "Dossier de [NOM_1] bloqué",
      procedureLabel: "demande rsa",
      blockageLabel: "versement bloqué",
    },
    {
      id: "report-2",
      createdAt: new Date("2026-01-14T10:00:00.000Z"),
      subject: "Changement d'adresse",
      procedureLabel: null,
      blockageLabel: null,
    },
  ],
};

describe("AnonymizedReportList", () => {
  it("shows the count, subjects, tags and dates", () => {
    render(
      <AnonymizedReportList
        page={PAGE}
        search={{ page: 1 }}
        selectedId="report-1"
      />,
    );

    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("signalements")).toBeInTheDocument();
    expect(screen.getByText("Dossier de [NOM_1] bloqué")).toBeInTheDocument();
    expect(screen.getByText("demande rsa")).toHaveClass("fr-badge--sm");
    expect(screen.getByText("versement bloqué")).toHaveClass(
      "fr-badge--purple-glycine",
    );
    expect(screen.getByText("15/01/2026")).toBeInTheDocument();
  });

  it("links each row to its selection, keeping page and filters", () => {
    render(
      <AnonymizedReportList
        page={PAGE}
        search={{
          page: 2,
          operator: "CAF",
          procedureLabel: "demande rsa",
          blockageLabel: "dette",
        }}
        selectedId="report-1"
      />,
    );

    const row = screen.getByRole("link", { name: /Changement d'adresse/ });
    const url = new URL(row.getAttribute("href") ?? "", "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      operateur: "CAF",
      demarche: "demande rsa",
      blocage: "dette",
      id: "report-2",
    });
  });

  it("marks the selected row", () => {
    render(
      <AnonymizedReportList
        page={PAGE}
        search={{ page: 1 }}
        selectedId="report-1"
      />,
    );

    expect(
      screen.getByRole("link", { name: /Dossier de \[NOM_1\] bloqué/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("link", { name: /Changement d'adresse/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("paginates with the filters, without carrying the selection", () => {
    render(
      <AnonymizedReportList
        page={PAGE}
        search={{
          page: 1,
          operator: "CAF",
          includeUntagged: true,
          blockageLabel: "dette",
          id: "report-1",
        }}
        selectedId="report-1"
      />,
    );

    expect(screen.getByTitle("Page 3")).toHaveAttribute(
      "href",
      "/admin/signalements-anonymises?page=3&operateur=CAF&tous=1&blocage=dette",
    );
  });

  it("shows the empty state", () => {
    render(
      <AnonymizedReportList
        page={{ total: 0, pageSize: 20, items: [] }}
        search={{ page: 1 }}
        selectedId={undefined}
      />,
    );

    expect(
      screen.getByText("Aucun signalement anonymisé ne correspond."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
