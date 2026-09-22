import { ROUTE } from "@/app/constant/route";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
}

interface TeamsSectionProps {
  teams: Team[];
}

export function TeamsSection({ teams }: TeamsSectionProps) {
  if (!teams || teams.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-[32px] font-bold leading-[40px] text-[#161616]">
        Équipes
      </h2>
      <div className="flex flex-col ">
        <p className="text-base text-[#3a3a3a]">
          Vous faites partie des équipes :
        </p>
        <div className="flex flex-col gap-4">
          {teams.map((team) => (
            <div key={team.id}>
              <Link
                href={`${ROUTE.TEAMS}/${team.id}`}
                className="text-blue-primary"
              >
                {team.name}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
