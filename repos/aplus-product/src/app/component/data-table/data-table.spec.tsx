import { fireEvent, render, screen } from "@testing-library/react";
import { DataTable } from "./data-table";
import { ColumnDef } from "@tanstack/react-table";

interface TestData {
  id: string;
  name: string;
  value: number;
}

describe("DataTable", () => {
  const columns: ColumnDef<TestData>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "value",
      header: "Value",
    },
  ];

  const testData: TestData[] = [
    { id: "1", name: "Test 1", value: 10 },
    { id: "2", name: "Test 2", value: 20 },
  ];

  it("applies meta.cellClassName to th and td", () => {
    const columnsWithMeta: ColumnDef<TestData>[] = [
      {
        accessorKey: "name",
        header: "Name",
        meta: { cellClassName: "w-[40%]" },
      },
      { accessorKey: "value", header: "Value" },
    ];
    const { container } = render(
      <DataTable columns={columnsWithMeta} data={testData} />,
    );
    const th = container.querySelector("th");
    const td = container.querySelector("td");
    expect(th).toHaveClass("w-[40%]");
    expect(td).toHaveClass("w-[40%]");
  });

  it("handles placeholder header cells in grouped columns", () => {
    const groupedColumns: ColumnDef<TestData>[] = [
      {
        id: "group",
        header: "Group",
        columns: [{ accessorKey: "name", header: "Name" }],
      },
      { accessorKey: "value", header: "Value" },
    ];
    const { container } = render(
      <DataTable columns={groupedColumns} data={testData} />,
    );
    const headerRows = container.querySelectorAll("thead tr");
    expect(headerRows.length).toBe(2);
  });

  it("renders without filtering when enableFiltering is false", () => {
    const { container } = render(
      <DataTable columns={columns} data={testData} enableFiltering={false} />,
    );
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("renders down-pointing arrow when column is sorted ascending", () => {
    const sortableColumns: ColumnDef<TestData>[] = [
      { accessorKey: "name", header: "Name", enableSorting: true },
    ];
    const { container } = render(
      <DataTable
        columns={sortableColumns}
        data={testData}
        manualSorting
        sorting={[{ id: "name", desc: false }]}
        onSortingChange={jest.fn()}
      />,
    );
    expect(container.querySelector(".ri-arrow-down-line")).toBeInTheDocument();
  });

  it("renders up-pointing arrow when column is sorted descending", () => {
    const sortableColumns: ColumnDef<TestData>[] = [
      { accessorKey: "name", header: "Name", enableSorting: true },
    ];
    const { container } = render(
      <DataTable
        columns={sortableColumns}
        data={testData}
        manualSorting
        sorting={[{ id: "name", desc: true }]}
        onSortingChange={jest.fn()}
      />,
    );
    expect(container.querySelector(".ri-arrow-up-line")).toBeInTheDocument();
  });

  it("invokes onSortingChange with updater function on header sort click", () => {
    const onSortingChange = jest.fn();
    const sortableColumns: ColumnDef<TestData>[] = [
      {
        accessorKey: "name",
        header: "Name",
        enableSorting: true,
      },
    ];
    const { container } = render(
      <DataTable
        columns={sortableColumns}
        data={testData}
        manualSorting
        sorting={[]}
        onSortingChange={onSortingChange}
      />,
    );
    const sortButton = container.querySelector("th button");
    expect(sortButton).toBeInTheDocument();
    fireEvent.click(sortButton!);
    expect(onSortingChange).toHaveBeenCalled();
    const callArg = onSortingChange.mock.calls[0][0];
    expect(Array.isArray(callArg)).toBe(true);
  });

  it("renders table with data", () => {
    render(<DataTable columns={columns} data={testData} />);
    expect(screen.getByText("Test 1")).toBeInTheDocument();
    expect(screen.getByText("Test 2")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("Aucun signalement trouvé")).toBeInTheDocument();
  });

  it("renders headers correctly", () => {
    render(<DataTable columns={columns} data={testData} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
  });

  it("applies correct border styling to table", () => {
    const { container } = render(
      <DataTable columns={columns} data={testData} />,
    );
    const table = container.querySelector("table");
    expect(table).toHaveClass("border", "border-[#929292]");
  });

  it("applies correct border styling to table headers", () => {
    const { container } = render(
      <DataTable columns={columns} data={testData} />,
    );
    const headers = container.querySelectorAll("th");
    headers.forEach((header) => {
      expect(header).toHaveClass("border", "border-[#929292]");
    });
  });

  it("applies correct border styling to table rows", () => {
    const { container } = render(
      <DataTable columns={columns} data={testData} />,
    );
    const rows = container.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      expect(row).toHaveClass("border", "border-[#929292]");
    });
  });

  describe("client-side pagination", () => {
    function makeData(count: number): TestData[] {
      return Array.from({ length: count }, (_, i) => ({
        id: String(i + 1),
        name: `Item ${String(i + 1).padStart(3, "0")}`,
        value: i + 1,
      }));
    }

    it("does not render pagination when pageSize is not provided", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(25)} />,
      );
      expect(container.querySelector("nav.fr-pagination")).toBeNull();
    });

    it("does not render pagination when data fits in a single page", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(10)} pageSize={10} />,
      );
      expect(container.querySelector("nav.fr-pagination")).toBeNull();
      // All rows rendered
      expect(container.querySelectorAll("tbody tr").length).toBe(10);
    });

    it("renders pagination when data exceeds pageSize", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(25)} pageSize={10} />,
      );
      expect(container.querySelector("nav.fr-pagination")).toBeInTheDocument();
    });

    it("renders only pageSize rows on the first page", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(25)} pageSize={10} />,
      );
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(10);
      expect(screen.getByText("Item 001")).toBeInTheDocument();
      expect(screen.getByText("Item 010")).toBeInTheDocument();
      expect(screen.queryByText("Item 011")).not.toBeInTheDocument();
    });

    function findPageLink(container: HTMLElement, page: number) {
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          "nav.fr-pagination button.fr-pagination__link",
        ),
      ).find((el) => el.textContent?.trim() === String(page));
    }

    it("computes total page count based on data length and pageSize", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(25)} pageSize={10} />,
      );
      // 25 items / 10 per page = 3 pages
      const numbered = Array.from(
        container.querySelectorAll(
          "nav.fr-pagination button.fr-pagination__link",
        ),
      ).filter((el) => /^\d+$/.test(el.textContent?.trim() ?? ""));
      expect(numbered.length).toBe(3);
      expect(numbered[numbered.length - 1].textContent?.trim()).toBe("3");
    });

    it("marks the current page with aria-current", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(25)} pageSize={10} />,
      );
      const current = container.querySelector(
        "nav.fr-pagination button.fr-pagination__link[aria-current]",
      );
      expect(current?.textContent?.trim()).toBe("1");
    });

    it("displays the next batch of rows when navigating to page 2", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(25)} pageSize={10} />,
      );
      const page2 = findPageLink(container, 2);
      expect(page2).toBeDefined();
      fireEvent.click(page2!);
      expect(screen.queryByText("Item 010")).not.toBeInTheDocument();
      expect(screen.getByText("Item 011")).toBeInTheDocument();
      expect(screen.getByText("Item 020")).toBeInTheDocument();
      expect(screen.queryByText("Item 021")).not.toBeInTheDocument();
    });

    it("renders only the remaining rows on the last page", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(25)} pageSize={10} />,
      );
      const page3 = findPageLink(container, 3);
      expect(page3).toBeDefined();
      fireEvent.click(page3!);
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(5);
      expect(screen.getByText("Item 021")).toBeInTheDocument();
      expect(screen.getByText("Item 025")).toBeInTheDocument();
    });

    it("sorts across the entire dataset, not only the current page", () => {
      const sortableColumns: ColumnDef<TestData>[] = [
        { accessorKey: "name", header: "Name", enableSorting: true },
        { accessorKey: "value", header: "Value" },
      ];
      const { container } = render(
        <DataTable
          columns={sortableColumns}
          data={makeData(25)}
          pageSize={10}
        />,
      );
      // Click sort: starts ascending → toggle to descending
      const sortButton = container.querySelector("th button");
      fireEvent.click(sortButton!); // asc (already in order)
      fireEvent.click(sortButton!); // desc
      // After desc sort, first page should display 025 → 016
      expect(screen.getByText("Item 025")).toBeInTheDocument();
      expect(screen.getByText("Item 016")).toBeInTheDocument();
      expect(screen.queryByText("Item 015")).not.toBeInTheDocument();
    });

    it("resets to page 1 when sorting changes", () => {
      const sortableColumns: ColumnDef<TestData>[] = [
        { accessorKey: "name", header: "Name", enableSorting: true },
        { accessorKey: "value", header: "Value" },
      ];
      const { container } = render(
        <DataTable
          columns={sortableColumns}
          data={makeData(25)}
          pageSize={10}
        />,
      );
      // Navigate to page 3
      const page3 = findPageLink(container, 3);
      fireEvent.click(page3!);
      expect(screen.getByText("Item 021")).toBeInTheDocument();
      // Toggle sort (header sort button is the only <button> inside <th>)
      const sortButton = container.querySelector("th button");
      fireEvent.click(sortButton!);
      // Should be back to page 1: ascending shows 001 → 010
      expect(screen.getByText("Item 001")).toBeInTheDocument();
      expect(screen.getByText("Item 010")).toBeInTheDocument();
      expect(screen.queryByText("Item 021")).not.toBeInTheDocument();
      // aria-current should now point to page 1
      const current = container.querySelector(
        "nav.fr-pagination button.fr-pagination__link[aria-current]",
      );
      expect(current?.textContent?.trim()).toBe("1");
    });

    it("sorts alpha columns by French collation and ignores leading invisible characters", () => {
      const alphaColumns: ColumnDef<TestData>[] = [
        {
          accessorKey: "name",
          header: "Name",
          enableSorting: true,
          meta: { sortType: "alpha" },
        },
      ];
      // « ​Aaa » porte une espace de largeur nulle en tête : sans nettoyage
      // elle se trierait avant tout le reste. « Éa » (accentué) se range comme
      // « Ea » via la collation base (« Éa » avant « Eb »), pas en fin de liste
      // par son code-point brut.
      const rows: TestData[] = [
        { id: "1", name: "Zz", value: 1 },
        { id: "2", name: "​Aaa", value: 2 },
        { id: "3", name: "Éa", value: 3 },
        { id: "4", name: "Eb", value: 4 },
      ];
      const { container } = render(
        <DataTable columns={alphaColumns} data={rows} />,
      );
      // Tri ascendant par défaut au premier clic.
      fireEvent.click(container.querySelector("th button")!);
      // Le caractère invisible reste dans l'affichage (le nettoyage ne vaut que
      // pour le tri) : on le neutralise pour ne comparer que l'ordre des lignes.
      const cells = Array.from(
        container.querySelectorAll("tbody tr td:first-child"),
      ).map((td) => td.textContent?.replace(/​/g, ""));
      expect(cells).toEqual(["Aaa", "Éa", "Eb", "Zz"]);
    });

    it("handles edge case: empty data with pageSize set", () => {
      const { container } = render(
        <DataTable columns={columns} data={[]} pageSize={10} />,
      );
      expect(container.querySelector("nav.fr-pagination")).toBeNull();
      expect(screen.getByText("Aucun signalement trouvé")).toBeInTheDocument();
    });

    it("updates aria-current when navigating between pages", () => {
      const { container } = render(
        <DataTable columns={columns} data={makeData(25)} pageSize={10} />,
      );
      fireEvent.click(findPageLink(container, 2)!);
      let current = container.querySelector(
        "nav.fr-pagination button.fr-pagination__link[aria-current]",
      );
      expect(current?.textContent?.trim()).toBe("2");
      fireEvent.click(findPageLink(container, 3)!);
      current = container.querySelector(
        "nav.fr-pagination button.fr-pagination__link[aria-current]",
      );
      expect(current?.textContent?.trim()).toBe("3");
    });
  });
});
