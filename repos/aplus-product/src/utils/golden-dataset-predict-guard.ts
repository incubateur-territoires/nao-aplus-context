/**
 * Refus dur de la production pour le script de prédiction du golden dataset.
 *
 * Le script écrit en base et consomme le quota Albert : le lancer sur la
 * production abîmerait un corpus qu'aucune sauvegarde ne rend équivalent. La
 * décision vit ici, dans une fonction pure qui reçoit l'environnement en
 * paramètre, précisément pour qu'on puisse la prouver par un test au lieu de la
 * déclencher pour de vrai contre la production.
 *
 * Les deux voies d'accès à la production dans ce dépôt sont couvertes :
 * `DB_TARGET` sélectionne une URL nommée (cf. `src/lib/prisma.ts`), et
 * `DATABASE_URL` peut avoir été recopiée à la main depuis `PROD_DATABASE_URL`.
 */

export interface PredictTargetEnvironment {
  DB_TARGET?: string;
  DATABASE_URL?: string;
  PROD_DATABASE_URL?: string;
}

export type PredictTargetVerdict = { ok: true } | { ok: false; reason: string };

const PRODUCTION_TARGETS = new Set(["prod", "production"]);

export function checkPredictTarget(
  env: PredictTargetEnvironment,
): PredictTargetVerdict {
  const target = env.DB_TARGET?.trim().toLowerCase();
  if (target && PRODUCTION_TARGETS.has(target)) {
    return {
      ok: false,
      reason: `DB_TARGET=${env.DB_TARGET} vise la production. Ce script écrit en base : viser le staging.`,
    };
  }

  // Comparaison sur les valeurs détourées : une URL recopiée avec un espace ou
  // un retour à la ligne parasite reste la même base.
  const databaseUrl = env.DATABASE_URL?.trim();
  const productionUrl = env.PROD_DATABASE_URL?.trim();
  if (databaseUrl && productionUrl && databaseUrl === productionUrl) {
    return {
      ok: false,
      reason:
        "DATABASE_URL est identique à PROD_DATABASE_URL. Ce script écrit en base : viser le staging.",
    };
  }

  return { ok: true };
}
