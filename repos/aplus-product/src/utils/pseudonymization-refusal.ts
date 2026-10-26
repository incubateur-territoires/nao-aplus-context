import { ReportPseudonymizationRefusalKind } from "@/generated/prisma/enums";
import type { GuardViolation, PiiType } from "@/types/ai-pipeline";
import type { PseudonymizationRefusal } from "@/types/pseudonymized-report";

/**
 * Motif stocké d'un refus de caviardage. La valeur des violations n'en sort
 * jamais : seuls leur type et leur nombre servent à compter les causes.
 */

export function guardRefusal(
  violations: readonly GuardViolation[],
): PseudonymizationRefusal {
  const violationCounts: Partial<Record<PiiType, number>> = {};
  for (const { type } of violations) {
    violationCounts[type] = (violationCounts[type] ?? 0) + 1;
  }
  return { kind: ReportPseudonymizationRefusalKind.GUARD, violationCounts };
}

export function providerRefusal(
  providerStatus: number | undefined,
): PseudonymizationRefusal {
  return providerStatus === undefined
    ? { kind: ReportPseudonymizationRefusalKind.PROVIDER }
    : { kind: ReportPseudonymizationRefusalKind.PROVIDER, providerStatus };
}
