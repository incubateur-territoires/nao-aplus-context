import { formatToLongDate } from "@/utils/format";
import { Row } from "../row/row";
import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@/trpc/routers/_app";

export function Informations({
  report,
  userTimezone,
}: {
  report: inferRouterOutputs<AppRouter>["report"]["getReportById"];
  userTimezone: string;
}) {
  if (!report) return null;

  return (
    <div>
      <h5 className="mb-4">Informations</h5>
      <hr />
      <div className="flex flex-col gap-4">
        <Row
          allXs
          label="Date de création"
          value={formatToLongDate(report.createdAt, userTimezone)}
        />
        <Row allXs label="Territoire" value={report.area.name} />

        <Row
          allXs
          label="Nombre de réponses"
          value={report.answers.length.toString()}
        />
      </div>
    </div>
  );
}
