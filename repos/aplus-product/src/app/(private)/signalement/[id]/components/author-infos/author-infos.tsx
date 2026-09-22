"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";
import { Row } from "../row/row";
import { UserLink } from "../user-link/user-link";
import { OrgPicto } from "@/app/component/org-picto/org-picto";

export function AuthorInfos({
  report,
}: {
  report: inferRouterOutputs<AppRouter>["report"]["getReportById"];
}) {
  const [showAllCoAuthors, setShowAllCoAuthors] = useState(false);
  const firstExpandedRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (showAllCoAuthors && firstExpandedRef.current) {
      firstExpandedRef.current.focus();
    }
  }, [showAllCoAuthors]);

  if (!report) return null;

  const sortedCoAuthors = report.coAuthors
    .slice()
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"));
  const coAuthorsCount = sortedCoAuthors.length;
  const displayedCoAuthors = showAllCoAuthors
    ? sortedCoAuthors
    : sortedCoAuthors.slice(0, 5);

  const orgName =
    report.applicantTeam.organization.shortName ||
    report.applicantTeam.organization.name;

  return (
    <div className="flex flex-col gap-12">
      <div>
        <h5 className="mb-4">Auteur</h5>
        <hr />
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <OrgPicto orgName={orgName} />
            <div className="flex-1">
              <Row
                disabled={!!report.author.isInactive}
                boldReversed
                labelElement={
                  <UserLink
                    userId={report.author.id}
                    firstName={report.author.firstName}
                    lastName={report.author.lastName}
                    isInactive={!!report.author.isInactive}
                  />
                }
                value={
                  report.applicantTeam.deletedAt
                    ? "Équipe supprimée"
                    : report.applicantTeam.name
                }
              />
            </div>
          </div>
        </div>
      </div>
      {coAuthorsCount > 0 ? (
        <div>
          <h5 className="mb-4">Co-auteurs</h5>
          <hr />
          <div className="flex flex-col gap-4">
            {/* RGAA 9.3 : liste des co-auteurs structurée en <ul><li>. */}
            <ul className="flex flex-col gap-4 list-none p-0 m-0">
              {displayedCoAuthors.map((coAuthor, index) => {
                const isMemberOfApplicantTeam = coAuthor.teams.some(
                  (team) => team.id === report.applicantTeamId,
                );
                const otherTeamNames = coAuthor.teams
                  .filter((team) => !team.deletedAt)
                  .map((team) => team.name)
                  .join(", ");
                const isFadedTeaser =
                  !showAllCoAuthors &&
                  coAuthorsCount > 5 &&
                  index === displayedCoAuthors.length - 1;
                return (
                  <li
                    key={coAuthor.id}
                    ref={index === 5 ? firstExpandedRef : undefined}
                    tabIndex={index === 5 ? -1 : undefined}
                    className="flex items-center gap-3"
                    style={
                      isFadedTeaser
                        ? {
                            maskImage:
                              "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 55%)",
                            WebkitMaskImage:
                              "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 55%)",
                          }
                        : undefined
                    }
                  >
                    {isMemberOfApplicantTeam && <OrgPicto orgName={orgName} />}
                    <div className="flex-1 flex items-center justify-between">
                      <Row
                        boldReversed
                        labelElement={
                          <UserLink
                            userId={coAuthor.id}
                            firstName={coAuthor.firstName}
                            lastName={coAuthor.lastName}
                            isInactive={!!coAuthor.isInactive}
                          />
                        }
                        value={
                          isMemberOfApplicantTeam
                            ? report.applicantTeam.deletedAt
                              ? "Équipe supprimée"
                              : report.applicantTeam.name
                            : otherTeamNames || undefined
                        }
                        disabled={!!coAuthor.isInactive}
                      />
                      {coAuthor.hasViewed ? (
                        <>
                          {/* RGAA 10.2 : icône décorative + texte restitué aux lecteurs d'écran. */}
                          <span
                            className="ri-eye-line text-blue-primary shrink-0"
                            aria-hidden="true"
                          />
                          <span className="sr-only">
                            A consulté le signalement
                          </span>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {coAuthorsCount > 5 ? (
              <Button
                className={!showAllCoAuthors ? "-mt-4" : ""}
                size="small"
                priority="tertiary"
                onClick={() => setShowAllCoAuthors(!showAllCoAuthors)}
                nativeButtonProps={{ "aria-expanded": showAllCoAuthors }}
              >
                {showAllCoAuthors ? "Voir moins" : "Voir tous les co-auteurs"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
