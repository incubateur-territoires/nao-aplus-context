import { render, screen, within } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { AnonymizedReportDetail as Detail } from "@/types/anonymized-report";
import { AnonymizedReportDetail } from "./anonymized-report-detail";

jest.mock("@/trpc/client", () => ({ useTRPC: jest.fn() }));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

const REPORT: Detail = {
  id: "report-1",
  createdAt: new Date("2026-03-04T10:00:00.000Z"),
  subject: "Dossier bloqué à [ORG_1]",
  description: "Bonjour,\nj'accompagne [NOM_1].",
  requestedTeams: ["CAF Essonne", "CPAM Essonne"],
  procedureLabel: "demande rsa",
  blockageLabel: null,
  answers: [
    {
      id: "answer-1",
      createdAt: new Date("2026-03-06T10:00:00.000Z"),
      content: "Pouvez-vous renvoyer la pièce ?",
      side: "operator",
      operator: "CAF",
    },
    {
      id: "answer-2",
      createdAt: new Date("2026-03-07T10:00:00.000Z"),
      content: "C'est fait.",
      side: "applicant",
      operator: null,
    },
    {
      id: "answer-3",
      createdAt: new Date("2026-03-08T15:30:00.000Z"),
      content: "Dossier débloqué.",
      side: "operator",
      operator: null,
    },
  ],
};

function setup(result: { data?: Detail; error?: { message: string } | null }) {
  const queryOptions = jest.fn().mockReturnValue({});
  (useTRPC as jest.Mock).mockReturnValue({
    anonymizedReport: { getById: { queryOptions } },
  });
  (useQuery as jest.Mock).mockReturnValue({ error: null, ...result });
  render(<AnonymizedReportDetail id="report-1" />);
  return { queryOptions };
}

describe("AnonymizedReportDetail", () => {
  it("queries the selected report", () => {
    const { queryOptions } = setup({ data: REPORT });

    expect(queryOptions).toHaveBeenCalledWith({ id: "report-1" });
  });

  it("shows the date, subject, tags and description", () => {
    setup({ data: REPORT });

    expect(screen.getByText("Créé le 04 mars 2026, 11h00")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Dossier bloqué à [ORG_1]",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("demande rsa")).toHaveClass("fr-badge--blue-ecume");
    expect(screen.getByText(/j'accompagne \[NOM_1\]/)).toHaveClass(
      "whitespace-pre-line",
    );
  });

  it("lists the requested teams under the subject", () => {
    setup({ data: REPORT });

    expect(
      screen.getByText("Équipes destinataires : CAF Essonne, CPAM Essonne"),
    ).toBeInTheDocument();
  });

  it("hides the requested teams line when there is none", () => {
    setup({ data: { ...REPORT, requestedTeams: [] } });

    expect(screen.queryByText(/Équipes destinataires/)).not.toBeInTheDocument();
  });

  it("labels each answer with its operator or side, date and time, in order", () => {
    setup({ data: REPORT });

    const answers = within(
      screen.getByRole("list", { name: "Échanges" }),
    ).getAllByRole("listitem");
    expect(answers[0]).toHaveTextContent("CAF · 06 mars 2026, 11h00");
    expect(answers[0]).toHaveTextContent("Pouvez-vous renvoyer la pièce ?");
    expect(answers[1]).toHaveTextContent("Aidant · 07 mars 2026, 11h00");
    expect(answers[2]).toHaveTextContent(
      "Équipe opératrice · 08 mars 2026, 16h30",
    );
  });

  it("says when there is no exchange", () => {
    setup({ data: { ...REPORT, answers: [] } });

    expect(screen.getByText("Aucun échange.")).toBeInTheDocument();
  });

  it("shows the query error", () => {
    setup({ error: { message: "Signalement anonymisé introuvable." } });

    expect(
      screen.getByText("Signalement anonymisé introuvable."),
    ).toBeInTheDocument();
  });
});
