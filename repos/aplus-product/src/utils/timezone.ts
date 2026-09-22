interface TeamWithAreas {
  areas: { timezone: string }[];
}

export function getTeamTimezone(team: TeamWithAreas): string {
  return team.areas[0]?.timezone ?? "Europe/Paris";
}

interface UserWithTeams {
  teams: TeamWithAreas[];
}

export function getUserTimezone(
  user: UserWithTeams | null | undefined,
): string {
  return user?.teams[0] ? getTeamTimezone(user.teams[0]) : "Europe/Paris";
}
