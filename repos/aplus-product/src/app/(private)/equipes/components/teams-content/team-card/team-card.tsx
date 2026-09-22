"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import { ROUTE } from "@/app/constant/route";
import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";

interface TeamCardProps {
  team: inferRouterOutputs<AppRouter>["team"]["getMyTeams"]["items"][number];
  canEdit: boolean;
}

export function TeamCard({ team, canEdit }: TeamCardProps) {
  const teamUrl = `${ROUTE.TEAMS}/${team.id}`;

  return (
    <div className="border border-[#DDDDDD] border-solid flex flex-col md:flex-row gap-8 items-center p-10 bg-white">
      <div className="flex-1 flex flex-col gap-8 items-start ">
        <div className="flex flex-col gap-2 items-start">
          <h3 className="font-bold leading-[36px] text-[#161616] text-[28px] m-0">
            {team.name}
          </h3>
          {team.areas.length > 0 && (
            <div className="flex flex-col gap-2">
              {team.areas.map((area) => (
                <div className="flex gap-2 items-center" key={area.id}>
                  <i className="ri-map-pin-line text-blue-primary text-2xl" />
                  <p className="font-regular leading-[24px] text-[#3A3A3A] text-base m-0">
                    {area.name} ({area.inseeCode})
                  </p>
                </div>
              ))}
            </div>
          )}
          {team.registrationNumber && (
            <p className="font-regular leading-[24px] text-[#3A3A3A] text-sm m-0">
              <span>matricule : </span>
              <span className="font-bold">{team.registrationNumber}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-8 items-end">
          <div className="flex gap-2 items-center">
            <i className="ri-government-line text-blue-primary text-2xl" />
            <p className="font-regular leading-[24px] text-[#3A3A3A] text-sm m-0">
              {team.organization.shortName || team.organization.name}
            </p>
          </div>
          {team.email ? (
            <div className="flex gap-2 items-center">
              <i className="ri-at-line text-blue-primary text-2xl" />
              <p className="font-regular leading-[24px] text-[#3A3A3A] text-sm m-0">
                {team.email}
              </p>
            </div>
          ) : null}
          <div className="flex gap-2 items-center">
            <i className="ri-team-line text-blue-primary text-2xl" />
            <p className="font-regular leading-[24px] text-[#3A3A3A] text-sm m-0">
              {team._count.users} {team._count.users > 1 ? "membres" : "membre"}
            </p>
          </div>
        </div>
      </div>
      {canEdit ? (
        <div className="flex flex-col gap-2 items-start">
          <Button
            iconId="ri-edit-line"
            size="large"
            linkProps={{ href: teamUrl }}
            className="w-full sm:w-auto"
          >
            Modifier l&apos;équipe
          </Button>
          <div className="max-w-[250px]">
            <p className="font-regular leading-[20px]  text-[#3A3A3A] text-xs m-0">
              Ajouter ou supprimer des membres, changer le nom ou la description
              de l&apos;équipe...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 items-start">
          <Button
            size="large"
            linkProps={{ href: teamUrl }}
            className="w-full sm:w-auto"
          >
            Voir l&apos;équipe
          </Button>
        </div>
      )}
    </div>
  );
}
