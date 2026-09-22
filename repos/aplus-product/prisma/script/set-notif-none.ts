import * as fs from "fs";
import * as path from "path";
import prisma from "@/lib/prisma";

function parseUserIds(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .trim()
    .split("\n")
    .map((line) => line.replace(/\r$/, "").trim())
    .filter(Boolean);
}

export async function setNotifNone() {
  console.log("\n🔕 Setting notificationFrequency to NONE...");

  const csvPath = path.join(
    __dirname,
    "..",
    "data",
    "manager_set_notif_none.csv",
  );
  const userIds = parseUserIds(csvPath);
  console.log(`  📋 Parsed ${userIds.length} user IDs from CSV`);

  const CHUNK_SIZE = 1000;
  let updated = 0;

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(", ");
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "notificationFrequency" = 'NONE' WHERE id IN (${placeholders})`,
      ...chunk,
    );
    updated += result;
  }

  console.log(`\n✅ notificationFrequency mis à NONE pour ${updated} users`);

  return { total: userIds.length, updated };
}

// Run standalone
if (require.main === module) {
  setNotifNone()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error setting notif none:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
