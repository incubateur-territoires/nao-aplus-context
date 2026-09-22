import prisma from "@/lib/prisma";
import { getTimezoneFromInseeCode } from "@/types/timezone";
import { fetchAreas as fetchAreasFromSource } from "./source-queries";

export async function importAreas() {
  console.log("\n📍 Importing areas...");

  const rawRows = await fetchAreasFromSource();

  // Parse all lines first
  const areasData = rawRows.map((row) => ({
    ...row,
    timezone: getTimezoneFromInseeCode(row.inseeCode),
  }));

  // Batch upsert in a single transaction
  console.log(`  Processing ${areasData.length} areas in batch...`);
  await prisma.$transaction(
    areasData.map((area) =>
      prisma.area.upsert({
        where: { id: area.id },
        update: {
          name: area.name,
          inseeCode: area.inseeCode,
          timezone: area.timezone,
        },
        create: area,
      }),
    ),
  );

  console.log(`✅ ${areasData.length} areas imported`);

  return { total: areasData.length };
}

// Run standalone
if (require.main === module) {
  importAreas()
    .catch((e) => {
      console.error("Error importing areas:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
