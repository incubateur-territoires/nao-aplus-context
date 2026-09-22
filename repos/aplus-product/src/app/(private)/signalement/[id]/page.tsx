import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { HydrateClient, getQueryClient } from "@/trpc/hydrate-client";
import { trpc, prefetch } from "@/trpc/server";
import { forbidden, notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { AnswerSection } from "./components/answer-section/answer-section";
import { InviteSection } from "./components/invite-section/invite-section";
import { ReportContent } from "./components/request-content/report-content";
import { BackToInTreatmentSection } from "./components/back-to-in-treatment-section/back-to-in-treatment-section";
import { CloseRequest } from "./components/close-request/close-request";

import { ReportViewTracker } from "./components/report-view-tracker/report-view-tracker";
import { trackServerEvent } from "@/lib/analytics/server-analytics";
import { getUserTimezone } from "@/utils/timezone";
import { formatDate } from "@/utils/format";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const queryClient = getQueryClient();

  // Utilise le cache partagé avec la page
  const report = await queryClient
    .fetchQuery(trpc.report.getReportById.queryOptions(id))
    .catch(() => null);

  const title = report
    ? `Signalement de ${report.firstName} ${report.lastName} le ${formatDate(report.createdAt, "Europe/Paris", { day: "2-digit", month: "long", year: "numeric" })}`
    : "Signalement";

  return {
    title,
  };
}

export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();

  let report;
  let answersData;
  let currentUser;

  try {
    [report, answersData, currentUser] = await Promise.all([
      queryClient.fetchQuery(trpc.report.getReportById.queryOptions(id)),
      queryClient.fetchQuery(
        trpc.answer.getAnswersWithStatusHistory.queryOptions(id),
      ),
      queryClient.fetchQuery(trpc.user.getCurrentUser.queryOptions()),
      prefetch(
        trpc.report.getRecipientsByReportId.queryOptions({ reportId: id }),
      ),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      forbidden();
    }
    // Signalement inexistant ou supprimé (soft delete)
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  if (!report) {
    notFound();
  }

  // Track report view
  void trackServerEvent("report_viewed", {
    reportId: id,
    status: report?.status ?? "unknown",
  });

  const userTimezone = getUserTimezone(currentUser);

  const authorsIds = [
    report?.authorId,
    ...(report?.coAuthors?.map((coAuthor) => coAuthor.id) ?? []),
  ];
  const isAuthor = authorsIds.includes(currentUser?.id ?? "");

  return (
    <HydrateClient>
      <div className="bg-blue-background min-h-screen">
        <StartDsfrOnHydration />
        <ReportViewTracker reportId={id} />
        <Container>
          <Breadcrumb
            currentPageLabel="Consultation d'un signalement"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[
              {
                label: "Tous les signalements",
                linkProps: {
                  href: ROUTE.ALL_REPORTS,
                },
              },
            ]}
          />
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="mb-0">
              Signalement de {report?.firstName} {report?.lastName} le{" "}
              {formatDate(report?.createdAt, userTimezone, {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </h1>
          </div>
          <ReportContent initialReport={report} userTimezone={userTimezone} />
          <AnswerSection
            initialReport={report}
            initialAnswersData={answersData}
            currentUserId={currentUser?.id ?? null}
            userTimezone={userTimezone}
          />
          <InviteSection initialReport={report} isAuthor={isAuthor} />
          <BackToInTreatmentSection initialReport={report} />
          <CloseRequest initialReport={report} />
        </Container>
      </div>
    </HydrateClient>
  );
}
