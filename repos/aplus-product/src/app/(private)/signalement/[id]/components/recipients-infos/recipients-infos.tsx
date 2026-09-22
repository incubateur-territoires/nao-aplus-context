"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import { Row } from "../row/row";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { UserLink } from "../user-link/user-link";
import { OrgPicto } from "@/app/component/org-picto/org-picto";

export function RecipientsInfos({
  reportId,
}: {
  reportId: string | undefined;
}) {
  const trpc = useTRPC();
  const [showAll, setShowAll] = useState(false);
  const firstExpandedRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (showAll && firstExpandedRef.current) {
      firstExpandedRef.current.focus();
    }
  }, [showAll]);
  const { data: recipients } = useQuery(
    trpc.report.getRecipientsByReportId.queryOptions({
      reportId: reportId ?? "",
    }),
  );

  const allRecipients =
    recipients
      ?.flatMap((team) =>
        team.users.map((user) => ({
          user,
          teamName: team.name,
          orgName: team.organization.shortName || team.organization.name,
        })),
      )
      .sort((a, b) => {
        const teamCompare = a.teamName.localeCompare(b.teamName, "fr");
        if (teamCompare !== 0) return teamCompare;
        return a.user.lastName.localeCompare(b.user.lastName, "fr");
      }) ?? [];

  const recipientsCount = allRecipients.length;
  const displayedRecipients = showAll
    ? allRecipients
    : allRecipients.slice(0, 5);

  return (
    <div>
      <h5 className="mb-4">Destinataires ({recipientsCount})</h5>
      <hr />
      <div className="flex flex-col gap-4">
        {/* RGAA 9.3 : liste des destinataires structurée en <ul><li>. */}
        <ul className="flex flex-col gap-4 list-none p-0 m-0">
          {displayedRecipients.map(({ user, teamName, orgName }, index) => {
            const isFadedTeaser =
              !showAll &&
              recipientsCount > 5 &&
              index === displayedRecipients.length - 1;
            return (
              <li
                key={user.id}
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
                <OrgPicto orgName={orgName} />
                <div className="flex-1 flex items-center justify-between">
                  <Row
                    boldReversed
                    labelElement={
                      <UserLink
                        userId={user.id}
                        firstName={user.firstName}
                        lastName={user.lastName}
                      />
                    }
                    value={teamName}
                  />
                  {user.hasViewed ? (
                    <>
                      {/* RGAA 10.2 : icône décorative + texte restitué aux lecteurs d'écran. */}
                      <span
                        className="ri-eye-line text-blue-primary shrink-0"
                        aria-hidden="true"
                      />
                      <span className="sr-only">A consulté le signalement</span>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {recipientsCount > 5 ? (
          <Button
            className={!showAll ? "-mt-4" : ""}
            size="small"
            priority="tertiary"
            onClick={() => setShowAll(!showAll)}
            nativeButtonProps={{ "aria-expanded": showAll }}
          >
            {showAll ? "Voir moins" : "Voir tous les opérateurs"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
