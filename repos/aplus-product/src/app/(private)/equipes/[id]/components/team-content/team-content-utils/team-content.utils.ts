export function getActivityLabel(totalReports: number): string {
  if (totalReports === 0) {
    return "Aucune activité";
  }
  if (totalReports === 1) {
    return "1 signalement";
  }
  return `${totalReports} signalements`;
}

export function getLastActivityDate(dates: Date[]): Date | null {
  if (!dates.length) {
    return null;
  }
  const timestamps = dates.map((date) => date.getTime());
  const maxTimestamp = Math.max(...timestamps);
  return new Date(maxTimestamp);
}

export interface ActivityMetrics {
  signalements: number;
  sollicitations: number;
  participations: number;
}

export function getActivityLabels(
  metrics: ActivityMetrics | undefined,
): string[] {
  if (!metrics) {
    return [];
  }

  const labels: string[] = [];

  if (metrics.signalements > 0) {
    labels.push(
      metrics.signalements === 1
        ? "1 signalement"
        : `${metrics.signalements} signalements`,
    );
  }

  if (metrics.sollicitations > 0) {
    labels.push(
      metrics.sollicitations === 1
        ? "1 sollicitation"
        : `${metrics.sollicitations} sollicitations`,
    );
  }

  if (metrics.participations > 0) {
    labels.push(
      metrics.participations === 1
        ? "1 participation"
        : `${metrics.participations} participations`,
    );
  }

  return labels;
}
