import { fireEvent, render, screen } from "@testing-library/react";
import { mockUseRouter } from "@/test/utils/global-mocks";
import type { AnonymizedReportSearch } from "@/utils/anonymized-report";
import { AnonymizedReportFilters } from "./anonymized-report-filters";

const OPERATORS = [
  { shortName: "CAF", name: "Caisse d'allocations familiales" },
  { shortName: "CPAM", name: "Caisse primaire d'assurance maladie" },
];

const SEARCH: AnonymizedReportSearch = {
  page: 3,
  operator: "CPAM",
  blockageLabel: "détresse numérique",
  id: "report-1",
};

function setup(search = SEARCH) {
  const push = jest.fn();
  mockUseRouter.mockReturnValue({
    push,
    replace: jest.fn(),
    prefetch: jest.fn(),
  });
  render(<AnonymizedReportFilters search={search} operators={OPERATORS} />);
  return { push };
}

function topLevelOptions(select: HTMLElement) {
  return Array.from(select.querySelectorAll(":scope > option")).map(
    (option) => option.textContent,
  );
}

function optionsOfGroup(select: HTMLElement, label: string) {
  const group = Array.from(select.querySelectorAll("optgroup")).find(
    (optgroup) => optgroup.label === label,
  );
  return Array.from(group?.querySelectorAll("option") ?? []).map(
    (option) => option.value,
  );
}

function pushedParams(push: jest.Mock) {
  const url = new URL(push.mock.calls[0][0], "http://localhost");
  expect(url.pathname).toBe("/admin/signalements-anonymises");
  return Object.fromEntries(url.searchParams);
}

describe("AnonymizedReportFilters", () => {
  it("lists the team tags flat, then the « Autres » group", () => {
    setup();

    const procedure = screen.getByLabelText("Démarche");
    expect(topLevelOptions(procedure).slice(0, 4)).toEqual([
      "Toutes",
      "demande code provisoire",
      "compte en ligne",
      "demande rsa",
    ]);
    expect(optionsOfGroup(procedure, "Autres")).toContain("avis d'imposition");
    expect(topLevelOptions(procedure)).not.toContain("avis d'imposition");

    const blockage = screen.getByLabelText("Blocage");
    expect(topLevelOptions(blockage)).toContain("aucun");
    expect(optionsOfGroup(blockage, "Autres")).toEqual([
      "déménagement",
      "formulaire inadapté",
    ]);
    expect(blockage.querySelectorAll("optgroup")).toHaveLength(1);
  });

  it("offers no closed category as an option", () => {
    setup();

    expect(topLevelOptions(screen.getByLabelText("Démarche"))).not.toContain(
      "RSA",
    );
  });

  it("reflects the selected team tags", () => {
    setup({ page: 1, procedureLabel: "demande rsa", blockageLabel: "aucun" });

    expect(screen.getByLabelText("Démarche")).toHaveValue("demande rsa");
    expect(screen.getByLabelText("Blocage")).toHaveValue("aucun");
  });

  it("choosing a team tag keeps the other axis, resets the page and drops the selection", () => {
    const { push } = setup();

    fireEvent.change(screen.getByLabelText("Démarche"), {
      target: { value: "demande rsa" },
    });

    expect(pushedParams(push)).toEqual({
      operateur: "CPAM",
      demarche: "demande rsa",
      blocage: "détresse numérique",
    });
  });

  it("choosing a tag of the « Autres » group writes it under the axis key", () => {
    const { push } = setup();

    fireEvent.change(screen.getByLabelText("Blocage"), {
      target: { value: "déménagement" },
    });

    expect(pushedParams(push)).toEqual({
      operateur: "CPAM",
      blocage: "déménagement",
    });
  });

  it("lists the operators by short name and reflects the selected one", () => {
    setup();

    const operator = screen.getByLabelText("Opérateur");
    expect(topLevelOptions(operator)).toEqual(["Tous", "CAF", "CPAM"]);
    expect(operator).toHaveValue("CPAM");
  });

  it("choosing an operator keeps the tag filters, resets the page and drops the selection", () => {
    const { push } = setup();

    fireEvent.change(screen.getByLabelText("Opérateur"), {
      target: { value: "CAF" },
    });

    expect(pushedParams(push)).toEqual({
      operateur: "CAF",
      blocage: "détresse numérique",
    });
  });

  it("turning the tagged-only switch off keeps the other filters, resets the page and drops the selection", () => {
    const { push } = setup();

    const toggle = screen.getByLabelText(
      "Voir uniquement les signalements étiquetés",
    );
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);

    expect(pushedParams(push)).toEqual({
      operateur: "CPAM",
      tous: "1",
      blocage: "détresse numérique",
    });
  });

  it("turning the tagged-only switch back on removes the parameter from the URL", () => {
    const { push } = setup({ page: 2, includeUntagged: true });

    const toggle = screen.getByLabelText(
      "Voir uniquement les signalements étiquetés",
    );
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);

    expect(push).toHaveBeenCalledWith("/admin/signalements-anonymises");
  });

  it("clearing a filter removes it from the URL", () => {
    const { push } = setup({ page: 3, blockageLabel: "dette" });

    fireEvent.change(screen.getByLabelText("Blocage"), {
      target: { value: "" },
    });

    expect(push).toHaveBeenCalledWith("/admin/signalements-anonymises");
  });
});
