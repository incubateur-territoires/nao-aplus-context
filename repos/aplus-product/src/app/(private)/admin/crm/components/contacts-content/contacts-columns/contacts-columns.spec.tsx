import { render, screen } from "@testing-library/react";
import { DataTable } from "@/app/component/data-table/data-table";
import { getContactsColumns, type ContactRow } from "./contacts-columns";

function createContactRow(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: "contact-1",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
    firstName: "Camille",
    lastName: "Durand",
    email: "camille.durand@example.com",
    address: "12 rue des Lilas",
    areaId: "area-1",
    area: { id: "area-1", name: "Pas-de-Calais" },
    organizationId: "org-1",
    organization: {
      id: "org-1",
      name: "Caisse d'Allocations Familiales",
      shortName: "CAF",
    },
    deletedAt: null,
    ...overrides,
  };
}

function renderTable(contacts: ContactRow[]) {
  return render(<DataTable columns={getContactsColumns()} data={contacts} />);
}

describe("getContactsColumns", () => {
  it("affiche les en-têtes de colonnes attendus", () => {
    renderTable([createContactRow()]);

    for (const header of [
      "Nom",
      "Adresse e-mail",
      "Territoire",
      "Organisme",
      "Date de création",
      "Action",
    ]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeVisible();
    }
  });

  it("affiche le nom complet, l'e-mail et le territoire", () => {
    renderTable([createContactRow()]);

    expect(screen.getByText("Camille Durand")).toBeInTheDocument();
    expect(screen.getByText("camille.durand@example.com")).toBeInTheDocument();
    expect(screen.getByText("Pas-de-Calais")).toBeInTheDocument();
  });

  it("affiche l'organisme avec son sigle quand il diffère du nom", () => {
    renderTable([createContactRow()]);

    expect(
      screen.getByText("Caisse d'Allocations Familiales (CAF)"),
    ).toBeInTheDocument();
  });

  it("affiche l'organisme sans parenthèses quand le sigle égale le nom", () => {
    renderTable([
      createContactRow({
        organization: {
          id: "org-2",
          name: "France Travail",
          shortName: "France Travail",
        },
      }),
    ]);

    expect(screen.getByText("France Travail")).toBeInTheDocument();
    expect(
      screen.queryByText("France Travail (France Travail)"),
    ).not.toBeInTheDocument();
  });

  it("affiche un tiret quand le territoire et l'organisme sont vides", () => {
    renderTable([
      createContactRow({
        area: null,
        areaId: null,
        organization: null,
        organizationId: null,
      }),
    ]);

    expect(screen.getAllByText("-")).toHaveLength(2);
  });

  it("affiche la date de création au format court", () => {
    renderTable([createContactRow()]);

    expect(screen.getByText("15 janv. 2024")).toBeInTheDocument();
  });

  it("propose un lien vers la fiche du contact", () => {
    renderTable([createContactRow({ id: "contact-42" })]);

    expect(screen.getByRole("link", { name: "Voir la fiche" })).toHaveAttribute(
      "href",
      "/admin/crm/contact-42",
    );
  });
});
