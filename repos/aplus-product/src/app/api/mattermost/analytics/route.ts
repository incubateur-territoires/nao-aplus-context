import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function getStartOfTodayAt7() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(7, 0, 0, 0);
  if (now < start) {
    start.setDate(start.getDate() - 1);
  }
  return start;
}

function getOneHourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000);
}

async function getAnalytics(since: Date) {
  const [reportsCount, answersCount, activeUsersCount] = await Promise.all([
    prisma.report.count({
      where: { createdAt: { gte: since } },
    }),
    prisma.answer.count({
      where: { createdAt: { gte: since } },
    }),
    prisma.user.count({
      where: { lastActivityAt: { gte: since } },
    }),
  ]);

  return {
    reports: reportsCount,
    answers: answersCount,
    activeUsers: activeUsersCount,
  };
}

export async function GET(request: Request) {
  const token = process.env.MATTERMOST_SLASH_TOKEN;

  // Sans secret configuré, refuser de servir plutôt que de devenir public
  // (même modèle que validateCronAuth).
  if (!token) {
    console.error("MATTERMOST_SLASH_TOKEN is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Token accepté uniquement via l'en-tête Authorization (envoyé nativement
  // par Mattermost, format `Token xxx`) : un token en query string fuiterait
  // dans les logs d'accès.
  const authHeader = request.headers.get("authorization");
  const headerToken =
    authHeader?.replace(/^(Bearer|Token)\s+/i, "")?.trim() ?? "";

  if (
    headerToken.length !== token.length ||
    !crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(token))
  ) {
    return NextResponse.json({ text: "Token invalide." }, { status: 401 });
  }

  try {
    const [since7h, sinceLastHour] = await Promise.all([
      getAnalytics(getStartOfTodayAt7()),
      getAnalytics(getOneHourAgo()),
    ]);

    const text = [
      "#### 📊 Statistiques Administration+",
      "",
      "| Métrique | Depuis 7h | Dernière heure |",
      "|:--|--:|--:|",
      `| Signalements créés | ${since7h.reports} | ${sinceLastHour.reports} |`,
      `| Réponses créées | ${since7h.answers} | ${sinceLastHour.answers} |`,
      `| Utilisateurs actifs | ${since7h.activeUsers} | ${sinceLastHour.activeUsers} |`,
    ].join("\n");

    return NextResponse.json({
      response_type: "in_channel",
      text,
    });
  } catch (error) {
    console.error("Mattermost analytics error:", error);
    return NextResponse.json({
      response_type: "ephemeral",
      text: "❌ Erreur lors de la récupération des statistiques.",
    });
  }
}
