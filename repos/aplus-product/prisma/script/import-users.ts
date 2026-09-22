import prisma from "../../src/lib/prisma";
import * as argon2 from "argon2";
import {
  fetchUsers as fetchUsersFromSource,
  fetchPasswords as fetchPasswordsFromSource,
  fetchUserSessions as fetchUserSessionsFromSource,
  type UserRow,
} from "./source-queries";
import { getDefaultPassword, generatePhone } from "./anonymize-helpers";

interface ImportOptions {
  since?: Date;
  staging?: boolean;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  return digits || "";
}

export async function importUsers(options?: ImportOptions) {
  console.log("\n👤 Importing users...");

  const staging = options?.staging ?? false;
  let stagingPasswordHash: string | undefined;
  const pseudonymizedEmailByUserId = new Map<string, string>();

  if (staging) {
    console.log("  🔒 Mode staging: pseudonymisation inline activée");
    stagingPasswordHash = await argon2.hash(getDefaultPassword());
  }

  const now = new Date();
  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
  const sixMonthsAgo = new Date(now.getTime() - SIX_MONTHS_MS);
  const validRows: {
    row: UserRow;
    role: string;
    lastActivity: Date | null;
  }[] = [];
  let skipped = 0;

  const dbRows = await fetchUsersFromSource(options?.since);
  const passwordMap = await fetchPasswordsFromSource();
  const sessionMap = await fetchUserSessionsFromSource();
  console.log(`  📋 Loaded ${sessionMap.size} user sessions`);

  for (const row of dbRows) {
    if (!row.id || !row.email) {
      skipped++;
      continue;
    }
    const lastActivity = sessionMap.get(row.id) ?? null;

    // Skip disabled users without session data (unknown last activity)
    if (row.disabled && !lastActivity) {
      skipped++;
      continue;
    }

    validRows.push({
      row,
      role: row.admin ? "admin" : "user",
      lastActivity,
    });
  }

  console.log(`  Processing ${validRows.length} users in batches...`);

  // Bulk upsert users using raw SQL (1 query per chunk instead of N)
  const CHUNK_SIZE = 500;
  let imported = 0;

  // Pre-process all rows
  const preparedUsers = validRows.map(({ row, role, lastActivity }) => {
    let email = row.email;
    const name = row.name || "Non renseigné";
    let firstName = row.first_name || "";
    let lastName = row.last_name || "";

    // Si firstName/lastName sont vides, tenter de les extraire du name (format "Nom Prénom")
    if (!firstName && !lastName && row.name) {
      const parts = row.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        lastName = parts[0];
        firstName = parts.slice(1).join(" ");
      }
    }
    let phone = normalizePhone(row.phone_number) || null;

    if (staging) {
      const stagingEmail = `${row.id}@test.mail`;
      email = stagingEmail;
      pseudonymizedEmailByUserId.set(row.id, stagingEmail);

      phone = row.phone_number ? generatePhone() : null;
    }

    const shouldBeInactive = row.disabled
      ? true
      : lastActivity !== null && lastActivity < sixMonthsAgo;

    const isInactive = shouldBeInactive ? (lastActivity ?? now) : null;
    const lastActivityAt = lastActivity ?? row.first_login_date;

    return {
      id: row.id,
      email,
      name,
      firstName,
      lastName,
      phone,
      profession: row.qualite || null,
      role,
      emailVerified: true,
      createdAt: row.creation_date ?? now,
      updatedAt: new Date(),
      cguAcceptedAt: row.cgu_acceptation_date,
      newsLetterAcceptedAt: row.newsletter_acceptation_date,
      isInactive,
      lastActivityAt,
      internalSupportComment: row.internal_support_comment || null,
    };
  });

  for (let i = 0; i < preparedUsers.length; i += CHUNK_SIZE) {
    const chunk = preparedUsers.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const rows: string[] = [];
    let p = 1;

    for (const u of chunk) {
      rows.push(
        `($${p++}, $${p++}, $${p++}::timestamp, $${p++}::timestamp, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::boolean, $${p++}::timestamp, $${p++}::timestamp, $${p++}::timestamp, $${p++}::timestamp, $${p++})`,
      );
      values.push(
        u.id,
        u.email,
        u.createdAt,
        u.updatedAt,
        u.name,
        u.firstName,
        u.lastName,
        u.phone,
        u.profession,
        u.role,
        u.emailVerified,
        u.cguAcceptedAt,
        u.newsLetterAcceptedAt,
        u.isInactive,
        u.lastActivityAt,
        u.internalSupportComment,
      );
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" (id, email, "createdAt", "updatedAt", name, "firstName", "lastName", phone, profession, role, "emailVerified", "cguAcceptedAt", "newsLetterAcceptedAt", "isInactive", "lastActivityAt", "internalSupportComment")
       VALUES ${rows.join(", ")}
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         "updatedAt" = EXCLUDED."updatedAt",
         name = EXCLUDED.name,
         "firstName" = EXCLUDED."firstName",
         "lastName" = EXCLUDED."lastName",
         phone = EXCLUDED.phone,
         profession = EXCLUDED.profession,
         role = EXCLUDED.role,
         "emailVerified" = EXCLUDED."emailVerified",
         "cguAcceptedAt" = EXCLUDED."cguAcceptedAt",
         "newsLetterAcceptedAt" = EXCLUDED."newsLetterAcceptedAt",
         "isInactive" = EXCLUDED."isInactive",
         "lastActivityAt" = EXCLUDED."lastActivityAt",
         "internalSupportComment" = EXCLUDED."internalSupportComment"`,
      ...values,
    );

    imported += chunk.length;
    if (imported % 2000 < CHUNK_SIZE || imported === preparedUsers.length) {
      console.log(`  ... ${imported}/${preparedUsers.length} users`);
    }
  }

  // Batch upsert accounts
  console.log(`  Processing accounts in batches...`);

  if (staging && stagingPasswordHash) {
    // En staging : deleteMany + createMany car l'accountId change (email pseudonymisé)
    const userIds = validRows.map(({ row }) => row.id);
    await prisma.account.deleteMany({
      where: {
        userId: { in: userIds },
        providerId: "credential",
      },
    });

    const accountsData = validRows.map(({ row }) => {
      const accountId = pseudonymizedEmailByUserId.get(row.id) ?? row.email;
      return {
        id: crypto.randomUUID(),
        accountId,
        providerId: "credential",
        userId: row.id,
        password: stagingPasswordHash,
      };
    });

    const ACCOUNT_CHUNK = 1000;
    let accountsCreated = 0;
    for (let i = 0; i < accountsData.length; i += ACCOUNT_CHUNK) {
      const chunk = accountsData.slice(i, i + ACCOUNT_CHUNK);
      await prisma.account.createMany({ data: chunk, skipDuplicates: true });
      accountsCreated += chunk.length;
      if (
        accountsCreated % 5000 < ACCOUNT_CHUNK ||
        accountsCreated === accountsData.length
      ) {
        console.log(`  ... ${accountsCreated}/${accountsData.length} accounts`);
      }
    }

    console.log(
      `\n✅ Users imported: ${imported} imported, ${accountsCreated} accounts created (staging), ${skipped} skipped`,
    );
    console.log(`  🔑 Mot de passe commun: ${getDefaultPassword()}`);

    const inactiveCount = preparedUsers.filter(
      (u) => u.isInactive !== null,
    ).length;
    return { sourceTotal: dbRows.length, imported, skipped, inactiveCount };
  } else {
    const accountsToCreate = validRows
      .filter(({ row }) => passwordMap.has(row.id))
      .map(({ row }) => ({
        id: row.id,
        passwordHash: passwordMap.get(row.id)!,
      }));

    const ACCOUNT_CHUNK = 500;
    let accountsCreated = 0;
    for (let i = 0; i < accountsToCreate.length; i += ACCOUNT_CHUNK) {
      const chunk = accountsToCreate.slice(i, i + ACCOUNT_CHUNK);
      const values: unknown[] = [];
      const rows: string[] = [];
      let p = 1;

      const batchNow = new Date();
      for (const a of chunk) {
        rows.push(
          `($${p++}, $${p++}, 'credential', $${p++}, $${p++}, $${p++}::timestamp, $${p++}::timestamp)`,
        );
        values.push(
          crypto.randomUUID(),
          a.id,
          a.id,
          a.passwordHash,
          batchNow,
          batchNow,
        );
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "Account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ${rows.join(", ")}
         ON CONFLICT ("accountId", "providerId") DO UPDATE SET
           password = EXCLUDED.password,
           "updatedAt" = EXCLUDED."updatedAt"`,
        ...values,
      );

      accountsCreated += chunk.length;
      if (
        accountsCreated % 2000 < ACCOUNT_CHUNK ||
        accountsCreated === accountsToCreate.length
      ) {
        console.log(
          `  ... ${accountsCreated}/${accountsToCreate.length} accounts`,
        );
      }
    }

    const missingPasswords = validRows.length - accountsToCreate.length;
    if (missingPasswords > 0) {
      console.warn(`  ⚠ ${missingPasswords} users without password`);
    }

    console.log(
      `\n✅ Users imported: ${imported} imported, ${accountsCreated} accounts created, ${skipped} skipped`,
    );

    const inactiveCount = preparedUsers.filter(
      (u) => u.isInactive !== null,
    ).length;
    return { sourceTotal: dbRows.length, imported, skipped, inactiveCount };
  }
}

// Run standalone
if (require.main === module) {
  importUsers()
    .catch((e) => {
      console.error("Error importing users:", e);
      process.exit(1);
    })
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error importing users:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
