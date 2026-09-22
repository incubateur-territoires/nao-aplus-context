import { createHash } from "crypto";
import prisma from "@/lib/prisma";
import {
  fetchReports as fetchReportsFromSource,
  fetchAnswers as fetchAnswersFromSource,
  type ReportRow,
  type AnswerRow,
} from "./source-queries";
import { anonymizeReportRow, generateAnswerContent } from "./anonymize-helpers";

function generateStatusHistoryId(
  reportId: string,
  status: string,
  answerId?: string,
): string {
  const key = `${reportId}:${status}:${answerId ?? "none"}`;
  const hash = createHash("sha256").update(key).digest("hex");
  // Format as UUID v4-like (deterministic)
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

interface ImportOptions {
  since?: Date;
  staging?: boolean;
}

function getDefaultMessageForAnswerType(answerType: string): string {
  switch (answerType) {
    case "applicationProcessed":
      return "Bonjour, j'ai fait le nécessaire. Je vous invite à fermer le signalement. Cordialement,";
    case "workInProgress":
      return "Bonjour, Je m'occupe de ce signalement. Cordialement,";
    case "wrongInstructor":
      return "Bonjour, notre équipe ne peut pas répondre à ce signalement. Nous transmettons le signalement à l'équipe opérateur concernée. Cordialement.";
    case "inviteByUser":
      return "Bonjour, ce signalement nécessite l'intervention d'une autre équipe opérateur. Nous l'avons donc ajoutée au signalement. Cordialement.";
    default:
      return "";
  }
}

function getStatusFromAnswerType(
  answerType: string,
): "IN_TREATMENT" | "COMPLETED" | null {
  switch (answerType) {
    case "applicationProcessed":
      return "COMPLETED";
    case "workInProgress":
      return "IN_TREATMENT";
    default:
      return null;
  }
}

function generateInviteMessageSync(
  answer: AnswerRow,
  teamDetailMap: Map<
    string,
    { id: string; name: string; organization: { shortName: string } }
  >,
  userMap: Map<
    string,
    {
      id: string;
      firstName: string | null;
      lastName: string | null;
      teams: { name: string }[];
    }
  >,
): string {
  // Récupérer les équipes invitées avec leurs organisations depuis le cache
  const invitedTeams = answer.invited_group_ids
    .map((id) => teamDetailMap.get(id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  // Récupérer l'auteur de l'invitation depuis le cache
  const author = userMap.get(answer.creator_user_id);

  const teamsText = invitedTeams
    .map(
      (team) =>
        `<strong>${team.name}</strong> (${team.organization.shortName})`,
    )
    .join(", ");

  const authorName =
    `${author?.firstName ?? ""} ${author?.lastName ?? ""}`.trim();
  const authorTeamName = author?.teams?.[0]?.name ?? "";

  return `${teamsText} ${invitedTeams.length > 1 ? "ont" : "a"} rejoint la conversation sur invitation de ${authorName}${authorTeamName ? ` (${authorTeamName})` : ""}`;
}

interface ValidReport {
  row: ReportRow;
  status: "PENDING_ASSIGNMENT" | "IN_TREATMENT" | "COMPLETED" | "CLOSED";
  organizationId: string;
  validRequestedTeamIds: string[];
  validCoAuthorIds: string[];
  answers: AnswerRow[];
}

function validateReportRow(
  row: ReportRow,
  answersByReportId: Map<string, AnswerRow[]>,
  userIds: Set<string>,
  areaIds: Set<string>,
  teamMap: Map<string, string>,
  userTeamsMap: Map<string, Set<string>>,
): ValidReport | null {
  if (!row.id) return null;
  if (!userIds.has(row.creator_user_id)) return null;
  if (!areaIds.has(row.area)) return null;
  if (!teamMap.has(row.creator_group_id)) return null;

  const validRequestedTeamIds = row.invited_group_ids.filter((id) =>
    teamMap.has(id),
  );
  // Only add as co-authors users who are members of the applicant team
  const validCoAuthorIds = row.invited_users.filter(
    (id) => userIds.has(id) && userTeamsMap.get(id)?.has(row.creator_group_id),
  );
  const organizationId = teamMap.get(row.creator_group_id)!;

  const reportAnswers = answersByReportId.get(row.id) || [];
  reportAnswers.sort((a, b) => a.answer_order - b.answer_order);

  // Collect requestedTeams from inviteByUser answers
  for (const answer of reportAnswers) {
    if (
      answer.answer_type === "inviteByUser" &&
      answer.invited_group_ids.length > 0
    ) {
      for (const groupId of answer.invited_group_ids) {
        if (teamMap.has(groupId) && !validRequestedTeamIds.includes(groupId)) {
          validRequestedTeamIds.push(groupId);
        }
      }
    }
  }

  let status: "PENDING_ASSIGNMENT" | "IN_TREATMENT" | "COMPLETED" | "CLOSED" =
    "PENDING_ASSIGNMENT";
  if (row.closed) {
    status = "CLOSED";
  } else if (reportAnswers.length > 0) {
    const lastAnswer = reportAnswers[reportAnswers.length - 1];
    const statusFromAnswer = getStatusFromAnswerType(lastAnswer.answer_type);
    if (statusFromAnswer) {
      status = statusFromAnswer;
    } else {
      status = "IN_TREATMENT";
    }
  }

  return {
    row,
    status,
    organizationId,
    validRequestedTeamIds,
    validCoAuthorIds,
    answers: reportAnswers,
  };
}

async function bulkUpsertReports(
  reports: Array<{
    id: string;
    createdAt: Date;
    subject: string;
    description: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    nir: string | null;
    nif: string | null;
    caf: string | null;
    phone: string | null;
    areaId: string;
    applicantTeamId: string;
    authorId: string;
    organizationId: string;
    status: string;
  }>,
) {
  if (reports.length === 0) return;
  const values: unknown[] = [];
  const rows: string[] = [];
  let p = 1;
  const batchNow = new Date();
  for (const r of reports) {
    rows.push(
      `($${p++}, $${p++}::timestamp, $${p++}::timestamp, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, true, $${p++}::"ReportStatus")`,
    );
    values.push(
      r.id,
      batchNow,
      r.createdAt,
      r.subject,
      r.description,
      r.firstName,
      r.lastName,
      r.birthDate,
      r.nir,
      r.nif,
      r.caf,
      r.phone,
      r.areaId,
      r.applicantTeamId,
      r.authorId,
      r.organizationId,
      r.status,
    );
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Report" (id, "updatedAt", "createdAt", subject, description, "firstName", "lastName", "birthDate", nir, nif, caf, phone, "areaId", "applicantTeamId", "authorId", "organizationId", "citizenPermissionConfirmed", status)
     VALUES ${rows.join(", ")}
     ON CONFLICT (id) DO UPDATE SET
       "updatedAt" = EXCLUDED."updatedAt",
       subject = EXCLUDED.subject,
       description = EXCLUDED.description,
       "firstName" = EXCLUDED."firstName",
       "lastName" = EXCLUDED."lastName",
       "birthDate" = EXCLUDED."birthDate",
       nir = EXCLUDED.nir,
       nif = EXCLUDED.nif,
       caf = EXCLUDED.caf,
       phone = EXCLUDED.phone,
       "areaId" = EXCLUDED."areaId",
       "applicantTeamId" = EXCLUDED."applicantTeamId",
       "authorId" = EXCLUDED."authorId",
       "organizationId" = EXCLUDED."organizationId",
       "citizenPermissionConfirmed" = EXCLUDED."citizenPermissionConfirmed",
       status = EXCLUDED.status`,
    ...values,
  );
}

async function bulkUpsertAnswers(
  answers: Array<{
    id: string;
    createdAt: Date;
    reportId: string;
    content: string;
    authorId: string;
    isOperatorOnly: boolean;
    isIrrelevant: boolean;
    isMetadataOnly: boolean;
  }>,
) {
  if (answers.length === 0) return;
  const values: unknown[] = [];
  const rows: string[] = [];
  let p = 1;
  for (const a of answers) {
    rows.push(
      `($${p++}, $${p++}::timestamp, $${p++}::timestamp, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, false)`,
    );
    values.push(
      a.id,
      a.createdAt,
      new Date(),
      a.reportId,
      a.content,
      a.authorId,
      a.isOperatorOnly,
      a.isIrrelevant,
      a.isMetadataOnly,
    );
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Answer" (id, "createdAt", "updatedAt", "reportId", content, "authorId", "isOperatorOnly", "isIrrelevant", "isMetadataOnly", "hasStandardProcedure")
     VALUES ${rows.join(", ")}
     ON CONFLICT (id) DO UPDATE SET
       "updatedAt" = EXCLUDED."updatedAt",
       content = EXCLUDED.content,
       "authorId" = EXCLUDED."authorId",
       "isOperatorOnly" = EXCLUDED."isOperatorOnly",
       "isIrrelevant" = EXCLUDED."isIrrelevant",
       "isMetadataOnly" = EXCLUDED."isMetadataOnly",
       "hasStandardProcedure" = EXCLUDED."hasStandardProcedure"`,
    ...values,
  );
}

async function bulkInsertRelations(
  tableName: string,
  pairs: Array<{ reportId: string; relatedId: string }>,
  chunkSize: number,
) {
  if (pairs.length === 0) return;
  // 1. Clear all existing relations for involved reports
  const reportIds = [...new Set(pairs.map((p) => p.reportId))];
  for (let i = 0; i < reportIds.length; i += chunkSize) {
    const chunk = reportIds.slice(i, i + chunkSize);
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(", ");
    await prisma.$executeRawUnsafe(
      `DELETE FROM "${tableName}" WHERE "A" IN (${placeholders})`,
      ...chunk,
    );
  }

  // 2. Bulk insert all pairs
  for (let i = 0; i < pairs.length; i += chunkSize) {
    const chunk = pairs.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const rows: string[] = [];
    let p = 1;
    for (const pair of chunk) {
      rows.push(`($${p++}, $${p++})`);
      values.push(pair.reportId, pair.relatedId);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tableName}" ("A", "B") VALUES ${rows.join(", ")} ON CONFLICT DO NOTHING`,
      ...values,
    );
  }
}

async function upsertReportsAndAnswers(
  validReports: ValidReport[],
  reportsSkipped: number,
  now: Date,
  userIds: Set<string>,
  userMap: Map<
    string,
    {
      id: string;
      firstName: string | null;
      lastName: string | null;
      teams: { name: string }[];
    }
  >,
  teamDetailMap: Map<
    string,
    { id: string; name: string; organization: { shortName: string } }
  >,
  staging = false,
) {
  console.log(`  Processing ${validReports.length} reports in batches...`);

  // Bulk upsert reports using raw SQL (1 query per chunk instead of N)
  const CHUNK_SIZE = 1000;
  let reportsImported = 0;

  for (let i = 0; i < validReports.length; i += CHUNK_SIZE) {
    const chunk = validReports.slice(i, i + CHUNK_SIZE);

    const prepared = chunk.map(({ row, status, organizationId }) => {
      let { subject, description } = row;
      let { firstName, lastName, birthDate } = row.user_infos;
      let nir = row.user_infos.nir || null;
      let nif = row.user_infos.nif || null;
      let caf = row.user_infos.caf || null;
      let phone = row.user_infos.phone || null;

      if (staging) {
        const anon = anonymizeReportRow({ birthDate, phone, nir, caf, nif });
        firstName = anon.firstName;
        lastName = anon.lastName;
        birthDate = anon.birthDate;
        phone = anon.phone;
        nir = anon.nir;
        caf = anon.caf;
        nif = anon.nif;
        subject = anon.subject;
        description = anon.description;
      }

      return {
        id: row.id,
        createdAt: row.creation_date ?? now,
        subject,
        description,
        firstName,
        lastName,
        birthDate,
        nir,
        nif,
        caf,
        phone,
        areaId: row.area,
        applicantTeamId: row.creator_group_id,
        authorId: row.creator_user_id,
        organizationId,
        status,
      };
    });

    await bulkUpsertReports(prepared);

    reportsImported += chunk.length;
    if (
      reportsImported % 5000 < CHUNK_SIZE ||
      reportsImported === validReports.length
    ) {
      console.log(
        `  ... ${reportsImported}/${validReports.length} reports created`,
      );
    }
  }

  // Bulk connect relations (requestedTeams, coAuthors) using raw SQL
  console.log(`  Connecting report relations...`);
  const requestedTeamPairs: Array<{ reportId: string; relatedId: string }> = [];
  const coAuthorPairs: Array<{ reportId: string; relatedId: string }> = [];

  for (const { row, validRequestedTeamIds, validCoAuthorIds } of validReports) {
    for (const teamId of validRequestedTeamIds) {
      requestedTeamPairs.push({ reportId: row.id, relatedId: teamId });
    }
    for (const userId of validCoAuthorIds) {
      coAuthorPairs.push({ reportId: row.id, relatedId: userId });
    }
  }

  await bulkInsertRelations(
    "_ReportToRequestedTeams",
    requestedTeamPairs,
    CHUNK_SIZE,
  );
  console.log(`  ... ${requestedTeamPairs.length} requestedTeams relations`);

  await bulkInsertRelations("_ReportCoAuthors", coAuthorPairs, CHUNK_SIZE);
  console.log(`  ... ${coAuthorPairs.length} coAuthors relations`);

  // Prepare all answers for batch insert
  console.log(`  Processing answers...`);
  interface PreparedAnswer {
    id: string;
    reportId: string;
    content: string;
    authorId: string;
    isOperatorOnly: boolean;
    isIrrelevant: boolean;
    isMetadataOnly: boolean;
    createdAt: Date;
  }
  const allAnswersToUpsert: PreparedAnswer[] = [];
  interface PreparedStatusHistory {
    reportId: string;
    status: "PENDING_ASSIGNMENT" | "IN_TREATMENT" | "COMPLETED" | "CLOSED";
    authorId: string;
    answerId?: string;
    createdAt: Date;
  }
  const allStatusHistoryToCreate: PreparedStatusHistory[] = [];

  for (const { row, answers, status } of validReports) {
    for (const answer of answers) {
      if (!userIds.has(answer.creator_user_id)) continue;
      if (answer.answer_type === "inviteThroughGroupPermission") continue;

      const isOperatorOnly = !answer.visible_by_helpers;

      if (
        answer.answer_type === "inviteByUser" &&
        answer.invited_group_ids.length > 0
      ) {
        const inviteContent = generateInviteMessageSync(
          answer,
          teamDetailMap,
          userMap,
        );
        allAnswersToUpsert.push({
          id: answer.id,
          reportId: row.id,
          content: inviteContent,
          authorId: answer.creator_user_id,
          isOperatorOnly,
          isIrrelevant: answer.declare_application_is_irrelevant,
          isMetadataOnly: true,
          createdAt: answer.creation_date ?? now,
        });

        const messageContent =
          answer.message?.trim() ||
          getDefaultMessageForAnswerType(answer.answer_type);
        if (messageContent) {
          allAnswersToUpsert.push({
            id: `${answer.id}-msg`,
            reportId: row.id,
            content: staging ? generateAnswerContent() : messageContent,
            authorId: answer.creator_user_id,
            isOperatorOnly,
            isIrrelevant: answer.declare_application_is_irrelevant,
            isMetadataOnly: false,
            createdAt: answer.creation_date
              ? new Date(answer.creation_date.getTime() + 1)
              : now,
          });
        }
        continue;
      }

      const isIrrelevant =
        answer.answer_type === "wrongInstructor" ||
        answer.declare_application_is_irrelevant;
      const content =
        answer.message?.trim() ||
        getDefaultMessageForAnswerType(answer.answer_type);

      allAnswersToUpsert.push({
        id: answer.id,
        reportId: row.id,
        content: staging ? generateAnswerContent() : content,
        authorId: answer.creator_user_id,
        isOperatorOnly,
        isIrrelevant,
        isMetadataOnly: false,
        createdAt: answer.creation_date ?? now,
      });

      const statusFromAnswer = getStatusFromAnswerType(answer.answer_type);
      if (statusFromAnswer) {
        allStatusHistoryToCreate.push({
          reportId: row.id,
          status: statusFromAnswer,
          authorId: answer.creator_user_id,
          answerId: answer.id,
          createdAt: answer.creation_date ?? now,
        });
      }
    }

    // Every imported report starts as PENDING_ASSIGNMENT
    allStatusHistoryToCreate.push({
      reportId: row.id,
      status: "PENDING_ASSIGNMENT",
      authorId: row.creator_user_id,
      createdAt: row.creation_date ?? now,
    });

    // Ensure IN_TREATMENT status history exists for reports with answers
    if (status === "IN_TREATMENT") {
      const hasInTreatmentHistory = allStatusHistoryToCreate.some(
        (h) => h.reportId === row.id && h.status === "IN_TREATMENT",
      );
      if (!hasInTreatmentHistory && answers.length > 0) {
        const firstValidAnswer = answers.find((a) =>
          userIds.has(a.creator_user_id),
        );
        const authorId =
          firstValidAnswer?.creator_user_id ?? row.creator_user_id;
        const firstAnswerDate =
          firstValidAnswer?.creation_date ?? answers[0].creation_date ?? now;
        allStatusHistoryToCreate.push({
          reportId: row.id,
          status: "IN_TREATMENT",
          authorId,
          createdAt: new Date(firstAnswerDate.getTime() - 1000),
        });
      }
    }

    // CLOSED status history
    if (row.closed) {
      allStatusHistoryToCreate.push({
        reportId: row.id,
        status: "CLOSED",
        authorId: row.creator_user_id,
        createdAt: row.closed_date ?? row.creation_date ?? now,
      });
    }
  }

  // Deduplicate answers by id (keep last occurrence)
  const answersMap = new Map<string, (typeof allAnswersToUpsert)[0]>();
  for (const a of allAnswersToUpsert) {
    answersMap.set(a.id, a);
  }
  const dedupedAnswers = [...answersMap.values()];
  console.log(
    `  Upserting ${dedupedAnswers.length} answers in batches (${allAnswersToUpsert.length - dedupedAnswers.length} duplicates removed)...`,
  );
  let answersImported = 0;

  for (let i = 0; i < dedupedAnswers.length; i += CHUNK_SIZE) {
    const chunk = dedupedAnswers.slice(i, i + CHUNK_SIZE);
    await bulkUpsertAnswers(chunk);

    answersImported += chunk.length;
    if (
      answersImported % 5000 < CHUNK_SIZE ||
      answersImported === dedupedAnswers.length
    ) {
      console.log(`  ... ${answersImported}/${dedupedAnswers.length} answers`);
    }
  }

  // Bulk create status history with deterministic IDs to avoid duplicates on re-import
  console.log(`  Creating status history entries...`);
  const HISTORY_CHUNK = 2000;
  let statusHistoryCreated = 0;

  for (let i = 0; i < allStatusHistoryToCreate.length; i += HISTORY_CHUNK) {
    const chunk = allStatusHistoryToCreate.slice(i, i + HISTORY_CHUNK);

    if (chunk.length === 0) continue;
    const values: unknown[] = [];
    const rows: string[] = [];
    let p = 1;
    for (const h of chunk) {
      const deterministicId = generateStatusHistoryId(
        h.reportId,
        h.status,
        h.answerId,
      );
      rows.push(
        `($${p++}, $${p++}::timestamp, $${p++}, $${p++}::"ReportStatus", $${p++}, $${p++})`,
      );
      values.push(
        deterministicId,
        h.createdAt,
        h.reportId,
        h.status,
        h.authorId,
        h.answerId ?? null,
      );
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ReportStatusHistory" (id, "createdAt", "reportId", status, "authorId", "answerId")
       VALUES ${rows.join(", ")}
       ON CONFLICT (id) DO NOTHING`,
      ...values,
    );

    statusHistoryCreated += chunk.length;
    if (
      statusHistoryCreated % 5000 < HISTORY_CHUNK ||
      statusHistoryCreated === allStatusHistoryToCreate.length
    ) {
      console.log(
        `  ... ${statusHistoryCreated}/${allStatusHistoryToCreate.length} history entries`,
      );
    }
  }

  console.log(
    `\n✅ Import complete: ${reportsImported} reports, ${answersImported} answers, ${statusHistoryCreated} status history entries (${reportsSkipped} reports skipped)`,
  );

  return { reportsImported, answersImported, reportsSkipped };
}

export async function importReports(options?: ImportOptions) {
  console.log("\n📋 Importing reports and answers...");

  // Pre-load users for validation
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      teams: { select: { id: true, name: true } },
    },
  });
  const userIds = new Set(allUsers.map((u) => u.id));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const userTeamsMap = new Map(
    allUsers.map((u) => [u.id, new Set(u.teams.map((t) => t.id))]),
  );
  console.log(`  📋 Loaded ${userIds.size} users`);

  // Pre-load areas for validation
  const allAreas = await prisma.area.findMany({ select: { id: true } });
  const areaIds = new Set(allAreas.map((a) => a.id));
  console.log(`  📋 Loaded ${areaIds.size} areas`);

  // Pre-load teams for validation and organization lookup
  const allTeams = await prisma.team.findMany({
    select: {
      id: true,
      organizationId: true,
      name: true,
      organization: { select: { shortName: true } },
    },
  });
  const teamMap = new Map(allTeams.map((t) => [t.id, t.organizationId]));
  const teamDetailMap = new Map(allTeams.map((t) => [t.id, t]));
  console.log(`  📋 Loaded ${teamMap.size} teams`);

  const now = new Date();
  const answersByReportId = new Map<string, AnswerRow[]>();
  const validReports: ValidReport[] = [];
  let reportsSkipped = 0;

  // Fetch reports first to know which answers to load
  const dbReportRows = await fetchReportsFromSource(options?.since);
  const reportIds = dbReportRows.map((r) => r.id).filter(Boolean);
  console.log(`  📋 Fetched ${dbReportRows.length} reports from source DB`);

  // Fetch answers for those reports (or all if full import)
  const dbAnswerRows =
    options?.since && reportIds.length > 0
      ? await fetchAnswersFromSource(reportIds)
      : await fetchAnswersFromSource();

  let answerCount = 0;
  for (const row of dbAnswerRows) {
    if (!row.id || !row.application_id) continue;
    const existing = answersByReportId.get(row.application_id) || [];
    existing.push(row);
    answersByReportId.set(row.application_id, existing);
    answerCount++;
  }
  console.log(
    `  📋 Loaded ${answerCount} answers for ${answersByReportId.size} reports`,
  );

  for (const row of dbReportRows) {
    try {
      const result = validateReportRow(
        row,
        answersByReportId,
        userIds,
        areaIds,
        teamMap,
        userTeamsMap,
      );
      if (result) {
        validReports.push(result);
      } else {
        reportsSkipped++;
      }
    } catch {
      reportsSkipped++;
    }
  }

  const result = await upsertReportsAndAnswers(
    validReports,
    reportsSkipped,
    now,
    userIds,
    userMap,
    teamDetailMap,
    options?.staging ?? false,
  );

  return { sourceTotal: dbReportRows.length, ...result };
}

// Run standalone
if (require.main === module) {
  importReports()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error importing reports:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
