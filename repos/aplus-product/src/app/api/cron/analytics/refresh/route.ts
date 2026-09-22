import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Analytics Refresh CRON");

// Vue matérialisée alimentant la page /statistiques via le routeur `stats`
// (1 ligne = 1 signalement).
// CONCURRENTLY évite de verrouiller la vue pendant le refresh : les lectures
// continuent sur l'ancienne version jusqu'à ce que la nouvelle soit prête.
// Requiert un index UNIQUE sur la vue (cf. migration: UNIQUE sur "reportId").
const MATERIALIZED_VIEW = "analytics.v_report_fact";

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  logger.info("Started", { view: MATERIALIZED_VIEW });

  const startedAt = Date.now();

  try {
    // REFRESH ... CONCURRENTLY ne peut pas s'exécuter dans une transaction,
    // donc on utilise $executeRawUnsafe (statement unique, hors transaction).
    // Le nom de la vue est une constante figée, pas une entrée utilisateur.
    await prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY ${MATERIALIZED_VIEW}`,
    );

    const durationMs = Date.now() - startedAt;
    logger.info("Vue matérialisée rafraîchie", {
      view: MATERIALIZED_VIEW,
      durationMs,
    });

    return NextResponse.json({
      message: "Materialized view refreshed",
      view: MATERIALIZED_VIEW,
      durationMs,
    });
  } catch (error) {
    logger.error("Error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
