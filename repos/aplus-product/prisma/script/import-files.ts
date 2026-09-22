import prisma from "@/lib/prisma";
import { fetchFiles } from "./source-queries";
import { slugifyFilename } from "@/utils/slugify";

interface ImportOptions {
  since?: Date;
  staging?: boolean;
}

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    csv: "text/csv",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
  };
  return types[ext ?? ""] ?? "application/octet-stream";
}

const CHUNK_SIZE = 1000;

export async function importFiles(options?: ImportOptions) {
  console.log("\n📁 Importing file metadata...");

  // Load existing report IDs
  const existingReports = await prisma.report.findMany({
    select: { id: true },
  });
  const existingReportIds = new Set(existingReports.map((r) => r.id));
  console.log(`  📋 Reports in target DB: ${existingReportIds.size}`);

  // Load existing answer IDs
  const existingAnswers = await prisma.answer.findMany({
    select: { id: true },
  });
  const existingAnswerIds = new Set(existingAnswers.map((a) => a.id));
  console.log(`  📋 Answers in target DB: ${existingAnswerIds.size}`);

  // Load existing file IDs
  const existingFiles = await prisma.file.findMany({
    select: { id: true },
  });
  const existingFileIds = new Set(existingFiles.map((f) => f.id));
  console.log(`  📋 Files already in target DB: ${existingFileIds.size}`);

  // Fetch files from source DB
  const allFiles = await fetchFiles(undefined, options?.since);
  console.log(`  📋 Files in source DB: ${allFiles.length}`);

  // Filter: only files whose report exists in the new DB
  const filesToImport = allFiles.filter(
    (f) => existingReportIds.has(f.application_id) && f.filename,
  );
  console.log(`  📋 Files to import (report exists): ${filesToImport.length}`);
  console.log(
    `  📋 Files skipped (no report): ${allFiles.length - filesToImport.length}`,
  );

  // Build file entries
  interface FileEntry {
    id: string;
    name: string;
    type: string;
    size: number;
    lastModified: Date;
    reportId: string;
    answerId: string | null;
  }

  const fileEntries: FileEntry[] = [];
  let skipped = 0;

  for (const file of filesToImport) {
    const slugified = slugifyFilename(file.filename);
    const newFileId = `${file.id}-${slugified}`;

    // Already imported?
    if (existingFileIds.has(newFileId) || existingFileIds.has(file.id)) {
      skipped++;
      continue;
    }

    const contentType = guessContentType(file.filename);

    fileEntries.push({
      id: newFileId,
      name: file.filename,
      type: contentType,
      size: file.filesize,
      lastModified: file.upload_date ?? new Date(),
      reportId: file.application_id,
      answerId:
        file.answer_id && existingAnswerIds.has(file.answer_id)
          ? file.answer_id
          : null,
    });
  }

  console.log(`  📋 New files to create: ${fileEntries.length}`);
  console.log(`  📋 Already imported (skipped): ${skipped}`);

  // Bulk insert files
  let imported = 0;

  for (let i = 0; i < fileEntries.length; i += CHUNK_SIZE) {
    const chunk = fileEntries.slice(i, i + CHUNK_SIZE);

    const values: unknown[] = [];
    const rows: string[] = [];
    let p = 1;
    for (const f of chunk) {
      rows.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}::timestamp, $${p++})`,
      );
      values.push(f.id, f.name, f.type, f.size, f.lastModified, f.reportId);
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "File" (id, name, type, size, "lastModified", "reportId")
       VALUES ${rows.join(", ")}
       ON CONFLICT (id) DO NOTHING`,
      ...values,
    );

    imported += chunk.length;
    if (imported % 5000 < CHUNK_SIZE || imported === fileEntries.length) {
      console.log(`  ... ${imported}/${fileEntries.length} files created`);
    }
  }

  // Connect files to answers
  const filesWithAnswers = fileEntries.filter((f) => f.answerId);
  if (filesWithAnswers.length > 0) {
    console.log(`  Connecting ${filesWithAnswers.length} files to answers...`);

    for (let i = 0; i < filesWithAnswers.length; i += CHUNK_SIZE) {
      const chunk = filesWithAnswers.slice(i, i + CHUNK_SIZE);
      const values: unknown[] = [];
      const rows: string[] = [];
      let p = 1;
      for (const f of chunk) {
        rows.push(`($${p++}, $${p++})`);
        values.push(f.answerId, f.id);
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "_AnswerToFile" ("A", "B") VALUES ${rows.join(", ")}
         ON CONFLICT DO NOTHING`,
        ...values,
      );
    }

    console.log(`  ✅ File-answer relations created`);
  }

  console.log(
    `\n✅ Files import complete: ${imported} created, ${skipped} skipped`,
  );

  return {
    sourceTotal: allFiles.length,
    imported,
    skipped,
    withAnswers: filesWithAnswers.length,
  };
}

// Run standalone
if (require.main === module) {
  importFiles()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error importing files:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
