import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env") });

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { createDecipheriv } from "crypto";
import { getSourcePool, disconnectSource } from "./source-db";

// ============================================
// Config
// ============================================

const CONCURRENCY = 150;
const MAX_RETRIES = 2;
const DRY_RUN = process.argv.includes("--dry-run");
const REPORT_PATH = resolve(__dirname, "../data/empty-files-report.json");

// Scaleway S3
const SCALEWAY_CREDS: S3ClientConfig = {
  credentials: {
    accessKeyId: process.env.SCALEWAY_BUCKET_ACCES as string,
    secretAccessKey: process.env.SCALEWAY_BUCKET_SECRET as string,
  },
  region: process.env.SCALEWAY_REGION as string,
  endpoint: process.env.SCALEWAY_ENDPOINT as string,
};

const SCALEWAY_BUCKET = process.env.SCALEWAY_BUCKET_NAME as string;
const SCALEWAY_SSE_KEY = process.env.SCALEWAY_SSE_ENCRYPTION_KEY as string;
const SCALEWAY_SSE_KEY_MD5 = process.env.SCALEWAY_SSE_KEY_DIGEST as string;

const SSE_PARAMS = {
  SSECustomerAlgorithm: "AES256" as const,
  SSECustomerKey: SCALEWAY_SSE_KEY,
  SSECustomerKeyMD5: SCALEWAY_SSE_KEY_MD5,
};

// OVH S3
const ovhClient = new S3Client({
  credentials: {
    accessKeyId: process.env.FILES_OVH_S3_ACCESS_KEY as string,
    secretAccessKey: process.env.FILES_OVH_S3_SECRET_KEY as string,
  },
  region: process.env.FILES_OVH_S3_REGION as string,
  endpoint: process.env.FILES_OVH_S3_ENDPOINT as string,
});
const OVH_BUCKET = process.env.FILES_OVH_S3_BUCKET as string;

// OVH encryption keys
function parseEncryptionKeys(): Map<string, Buffer> {
  const raw = process.env.FILES_ENCRYPTION_KEYS as string;
  const map = new Map<string, Buffer>();
  if (!raw) return map;

  for (const entry of raw.split(",")) {
    const colonIndex = entry.indexOf(":");
    if (colonIndex === -1) continue;
    const keyId = entry.slice(0, colonIndex).trim();
    const keyValue = entry.slice(colonIndex + 1).trim();
    map.set(keyId, Buffer.from(keyValue, "base64"));
  }
  return map;
}

const encryptionKeys = parseEncryptionKeys();

// ============================================
// ChaCha20-Poly1305 decryption (from migrate-files.ts)
// ============================================

const NONCE_SIZE = 12;

function decryptFile(
  encrypted: Buffer,
  fileId: string,
  encryptionKeyId: string,
): Buffer {
  const key = encryptionKeys.get(encryptionKeyId);
  if (!key) {
    throw new Error(`Clé de chiffrement inconnue: ${encryptionKeyId}`);
  }

  const nonce = encrypted.subarray(0, NONCE_SIZE);
  const ciphertextWithTag = encrypted.subarray(NONCE_SIZE);
  const aad = `File_${fileId}`;

  const decipher = createDecipheriv("chacha20-poly1305", key, nonce, {
    authTagLength: 16,
  });
  decipher.setAAD(Buffer.from(aad, "utf-8"), {
    plaintextLength: ciphertextWithTag.length - 16,
  });

  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const ciphertext = ciphertextWithTag.subarray(
    0,
    ciphertextWithTag.length - 16,
  );

  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ============================================
// Helpers
// ============================================

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
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

/** Extract the UUID prefix from a DB file ID like "uuid-slugified-name.pdf" */
function extractUuid(fileId: string): string | null {
  const match = fileId.match(
    /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
  );
  return match ? match[1] : null;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("=== Backfill missing files: OVH → Scaleway ===");
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "PRODUCTION"}`);
  console.log(`Bucket destination: ${SCALEWAY_BUCKET}`);
  console.log(`Bucket source OVH: ${OVH_BUCKET}`);
  console.log(
    `Clés de chiffrement OVH: ${[...encryptionKeys.keys()].join(", ") || "aucune"}`,
  );

  // Check required env vars
  const requiredVars = [
    "FILES_OVH_S3_ACCESS_KEY",
    "FILES_OVH_S3_SECRET_KEY",
    "FILES_OVH_S3_BUCKET",
    "FILES_OVH_S3_ENDPOINT",
    "FILES_OVH_S3_REGION",
    "FILES_ENCRYPTION_KEYS",
    "SCALEWAY_BUCKET_ACCES",
    "SCALEWAY_BUCKET_SECRET",
    "SCALEWAY_BUCKET_NAME",
    "SCALEWAY_ENDPOINT",
    "SCALEWAY_REGION",
    "SCALEWAY_SSE_ENCRYPTION_KEY",
    "SCALEWAY_SSE_KEY_DIGEST",
    "SOURCE_DATABASE_URL",
  ];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(
      `Variables d'environnement manquantes: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  // ---- Step 1: Read missing files from report ----
  console.log(`\n[1/3] Lecture du rapport: ${REPORT_PATH}`);
  const fs = await import("node:fs/promises");

  let reportRaw: string;
  try {
    reportRaw = await fs.readFile(REPORT_PATH, "utf-8");
  } catch {
    console.error(`Fichier introuvable: ${REPORT_PATH}`);
    console.error(
      "Lancer d'abord: DB_TARGET=prod bunx tsx prisma/script/check-empty-files.ts",
    );
    process.exit(1);
  }

  const report = JSON.parse(reportRaw) as {
    totalFiles: number;
    missingCount: number;
    missingFiles: Array<{
      id: string;
      name: string;
      reportId: string;
      lastModified: string;
    }>;
  };

  const missingFiles = report.missingFiles;
  console.log(`  ${report.totalFiles} fichiers en DB au moment du rapport`);
  console.log(`  ${missingFiles.length} fichiers manquants sur Scaleway`);

  if (missingFiles.length === 0) {
    console.log("\nRien à migrer !");
    return;
  }

  // ---- Step 2: Look up missing files in source (legacy) DB ----
  console.log(
    `\n[2/3] Recherche des ${missingFiles.length} fichiers dans l'ancienne DB...`,
  );
  const sourcePool = getSourcePool();

  const missingUuids = missingFiles
    .map((f) => extractUuid(f.id))
    .filter((uuid): uuid is string => uuid !== null);

  const QUERY_BATCH = 5000;
  const sourceFileMap = new Map<
    string,
    { id: string; encryption_key_id: string; filename: string }
  >();

  for (let i = 0; i < missingUuids.length; i += QUERY_BATCH) {
    const batch = missingUuids.slice(i, i + QUERY_BATCH);
    const { rows } = await sourcePool.query(
      `SELECT id, encryption_key_id, filename
       FROM file_metadata
       WHERE id = ANY($1) AND status = 'available'`,
      [batch],
    );
    for (const row of rows) {
      sourceFileMap.set(row.id, row);
    }
    const pct = (
      (Math.min(i + QUERY_BATCH, missingUuids.length) / missingUuids.length) *
      100
    ).toFixed(1);
    console.log(
      `  ${pct}% | ${sourceFileMap.size} fichiers trouvés dans l'ancienne DB`,
    );
  }

  const migratable = missingFiles.filter((f) => {
    const uuid = extractUuid(f.id);
    return uuid && sourceFileMap.has(uuid);
  });
  const notInSource = missingFiles.length - migratable.length;

  console.log(
    `\n  Migrables (trouvés dans l'ancienne DB): ${migratable.length}`,
  );
  console.log(`  Non trouvés dans l'ancienne DB: ${notInSource}`);

  if (migratable.length === 0) {
    console.log("\nAucun fichier à migrer.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Arrêt ici. Relancer sans --dry-run pour migrer.");
    console.log(`  ${migratable.length} fichiers seraient migrés.`);
    return;
  }

  // ---- Step 3: Migrate files OVH → Scaleway ----
  const scalewayClient = new S3Client(SCALEWAY_CREDS);
  console.log(
    `\n[3/3] Migration de ${migratable.length} fichiers OVH → Scaleway...`,
  );

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let migrateIndex = 0;
  const errors: Array<{ fileId: string; error: string }> = [];

  async function migrateWorker() {
    while (migrateIndex < migratable.length) {
      const currentIndex = migrateIndex++;
      const file = migratable[currentIndex];
      const uuid = extractUuid(file.id)!;
      const sourceFile = sourceFileMap.get(uuid)!;

      // Skip files already present on Scaleway (resume support)
      // But re-upload if the file is empty (0 bytes)
      try {
        const headResult = await scalewayClient.send(
          new HeadObjectCommand({
            Bucket: SCALEWAY_BUCKET,
            Key: file.id,
            ...SSE_PARAMS,
          }),
        );
        if (headResult.ContentLength && headResult.ContentLength > 0) {
          skipped++;
          const total = migrated + failed + skipped;
          if (total % 100 === 0) {
            const pct = ((total / migratable.length) * 100).toFixed(1);
            console.log(
              `  ${pct}% | migrated: ${migrated} | skipped: ${skipped} | failed: ${failed} | ${total}/${migratable.length}`,
            );
          }
          continue;
        }
        // File exists but is empty → proceed with migration
      } catch {
        // File not found on Scaleway → proceed with migration
      }

      let lastError = "";
      let success = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }

          // Download from OVH
          const getResponse = await ovhClient.send(
            new GetObjectCommand({
              Bucket: OVH_BUCKET,
              Key: sourceFile.id,
            }),
          );

          if (!getResponse.Body) {
            throw new Error(`Empty body from OVH for ${sourceFile.id}`);
          }

          const encrypted = Buffer.from(
            await getResponse.Body.transformToByteArray(),
          );

          // Decrypt
          const decrypted = decryptFile(
            encrypted,
            sourceFile.id,
            sourceFile.encryption_key_id,
          );

          if (decrypted.byteLength === 0) {
            throw new Error(`Decrypted file is empty: ${sourceFile.id}`);
          }

          // Upload to Scaleway with SSE-C
          const contentType = guessContentType(file.name);
          await scalewayClient.send(
            new PutObjectCommand({
              Bucket: SCALEWAY_BUCKET,
              Key: file.id,
              Body: decrypted,
              ContentLength: decrypted.byteLength,
              ContentType: contentType,
              ...SSE_PARAMS,
            }),
          );

          success = true;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      if (success) {
        migrated++;
      } else {
        failed++;
        errors.push({ fileId: file.id, error: lastError });
        if (failed <= 10) {
          console.error(`  ❌ ${file.id}: ${lastError}`);
        }
        if (failed === 10) {
          console.error("  ... (erreurs suivantes dans backfill-errors.json)");
        }
      }

      const total = migrated + failed + skipped;
      if (total % 100 === 0 || total === migratable.length) {
        const pct = ((total / migratable.length) * 100).toFixed(1);
        console.log(
          `  ${pct}% | migrated: ${migrated} | skipped: ${skipped} | failed: ${failed} | ${total}/${migratable.length}`,
        );
      }
    }
  }

  const migrateWorkers = Array.from({ length: CONCURRENCY }, () =>
    migrateWorker(),
  );
  await Promise.all(migrateWorkers);

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log("RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`  Fichiers manquants (rapport): ${missingFiles.length}`);
  console.log(`  Trouvés dans ancienne DB:     ${migratable.length}`);
  console.log(`  Non trouvés:                  ${notInSource}`);
  console.log(`  Déjà présents (skipped):      ${skipped}`);
  console.log(`  Migrés avec succès:           ${migrated}`);
  console.log(`  Échoués:                      ${failed}`);

  if (errors.length > 0) {
    console.log(`\nErreurs (${Math.min(errors.length, 30)} premières):`);
    for (const err of errors.slice(0, 30)) {
      console.log(`  ${err.fileId}: ${err.error}`);
    }

    await fs.writeFile("backfill-errors.json", JSON.stringify(errors, null, 2));
    console.log(`\nToutes les erreurs: backfill-errors.json`);
  }
}

main()
  .then(async () => {
    await disconnectSource();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("Erreur fatale:", e);
    await disconnectSource();
    process.exit(1);
  });
