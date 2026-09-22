import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createDecipheriv } from "crypto";
import prisma from "@/lib/prisma";
import { fetchFiles, type FileRow } from "./source-queries";
import { disconnectSource } from "./source-db";
import { slugifyFilename } from "@/utils/slugify";

// ============================================
// Configuration
// ============================================

// Dans ton .env :
// DB_TARGET=prod
// PROD_DATABASE_URL=postgres://<user_cible>:<mdp_cible>@127.0.0.1:10000/<db_cible>?sslmode=prefer
// SOURCE_DATABASE_URL=postgres://<user_source>:<mdp_source>@127.0.0.1:10001/<db_source>?sslmode=prefer
// Les valeurs réelles se lisent dans le tableau de bord Scalingo. Ne pas les
// écrire ici : le dépôt est public.

// Vérifie que :
// 1. Les deux tunnels sont bien ouverts (dans deux terminaux séparés)
// 2. PROD_DATABASE_URL → port 10000
// 3. SOURCE_DATABASE_URL → port 10001
// 4. Les credentials correspondent à ce que Scalingo donne pour chaque app

const BATCH_SIZE = 100; // fichiers traités en parallèle
const DRY_RUN = process.argv.includes("--dry-run");
const TEST_ONE = process.argv.includes("--test-one");

// --since=YYYY-MM-DD : ne migrer que les fichiers uploadés depuis cette date
function parseSinceDate(): Date | undefined {
  const arg = process.argv.find((a) => a.startsWith("--since="));
  if (!arg) return undefined;
  const value = arg.split("=")[1];
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    console.error(
      `❌ Date invalide pour --since: ${value} (format attendu: YYYY-MM-DD)`,
    );
    process.exit(1);
  }
  return date;
}
const SINCE_DATE = parseSinceDate();

// OVH S3 config
const ovhClient = new S3Client({
  credentials: {
    accessKeyId: process.env.FILES_OVH_S3_ACCESS_KEY as string,
    secretAccessKey: process.env.FILES_OVH_S3_SECRET_KEY as string,
  },
  region: process.env.FILES_OVH_S3_REGION as string,
  endpoint: process.env.FILES_OVH_S3_ENDPOINT as string,
});
const OVH_BUCKET = process.env.FILES_OVH_S3_BUCKET as string;

// Scaleway S3 config
const scalewayClient = new S3Client({
  credentials: {
    accessKeyId: process.env.SCALEWAY_BUCKET_ACCES as string,
    secretAccessKey: process.env.SCALEWAY_BUCKET_SECRET as string,
  },
  region: process.env.SCALEWAY_REGION as string,
  endpoint: process.env.SCALEWAY_ENDPOINT as string,
});
const SCALEWAY_BUCKET = process.env.SCALEWAY_BUCKET_NAME as string;
const SCALEWAY_SSE_KEY = process.env.SCALEWAY_SSE_ENCRYPTION_KEY as string;
const SCALEWAY_SSE_KEY_MD5 = process.env.SCALEWAY_SSE_KEY_DIGEST as string;

// Parse OVH encryption keys: "prod-key-1:base64key,prod-key-2:base64key"
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
// ChaCha20-Poly1305 decryption
// (matches Scala Crypto.decryptBytes from aplus v1)
// ============================================

const NONCE_SIZE = 12; // 96-bit nonce

function decryptFile(
  encrypted: Buffer,
  fileId: string,
  encryptionKeyId: string,
): Buffer {
  const key = encryptionKeys.get(encryptionKeyId);
  if (!key) {
    throw new Error(`Clé de chiffrement inconnue: ${encryptionKeyId}`);
  }

  // Structure: nonce (12 bytes) || ciphertext + auth tag
  const nonce = encrypted.subarray(0, NONCE_SIZE);
  const ciphertextWithTag = encrypted.subarray(NONCE_SIZE);

  // AAD = "File_<fileId>" (matches Scala: s"File_$fileId")
  const aad = `File_${fileId}`;

  const decipher = createDecipheriv("chacha20-poly1305", key, nonce, {
    authTagLength: 16,
  });
  decipher.setAAD(Buffer.from(aad, "utf-8"));

  // In ChaCha20-Poly1305, the auth tag is the last 16 bytes
  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const ciphertext = ciphertextWithTag.subarray(
    0,
    ciphertextWithTag.length - 16,
  );

  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted;
}

// ============================================
// Download from OVH + decrypt
// ============================================

async function downloadAndDecrypt(
  fileId: string,
  encryptionKeyId: string,
): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: OVH_BUCKET,
    Key: fileId,
  });

  const response = await ovhClient.send(command);
  if (!response.Body) {
    throw new Error(`Fichier vide: ${fileId}`);
  }

  const encrypted = Buffer.from(await response.Body.transformToByteArray());
  return decryptFile(encrypted, fileId, encryptionKeyId);
}

// ============================================
// Upload to Scaleway
// ============================================

async function uploadToScaleway(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: SCALEWAY_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    SSECustomerAlgorithm: "AES256",
    SSECustomerKey: SCALEWAY_SSE_KEY,
    SSECustomerKeyMD5: SCALEWAY_SSE_KEY_MD5,
  });
  await scalewayClient.send(command);
}

// ============================================
// Guess content type from filename
// ============================================

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

// ============================================
// Migrate a single file
// ============================================

async function migrateFile(
  file: FileRow,
  existingFileIds: Set<string>,
): Promise<{ success: boolean; skipped: boolean; error?: string }> {
  // L'ID dans la nouvelle DB : oldUUID-slugifiedFilename
  const slugified = slugifyFilename(file.filename);
  const newFileId = `${file.id}-${slugified}`;

  // Déjà migré ?
  if (existingFileIds.has(newFileId) || existingFileIds.has(file.id)) {
    return { success: true, skipped: true };
  }

  if (DRY_RUN) {
    console.log(
      `  [DRY-RUN] ${file.id} → ${newFileId} (${file.filename}, ${(file.filesize / 1024).toFixed(0)} Ko)`,
    );
    return { success: true, skipped: false };
  }

  try {
    // 1. Download depuis OVH + déchiffrement ChaCha20-Poly1305
    const buffer = await downloadAndDecrypt(file.id, file.encryption_key_id);

    // 2. Upload vers Scaleway
    const contentType = guessContentType(file.filename);
    await uploadToScaleway(newFileId, buffer, contentType);

    // 3. Créer l'entrée File dans la DB
    await prisma.file.create({
      data: {
        id: newFileId,
        name: file.filename,
        type: contentType,
        size: file.filesize,
        lastModified: file.upload_date ?? new Date(),
        reportId: file.application_id,
      },
    });

    // 4. Lier à la réponse si applicable
    if (file.answer_id) {
      try {
        await prisma.answer.update({
          where: { id: file.answer_id },
          data: {
            files: { connect: { id: newFileId } },
          },
        });
      } catch {
        // L'answer n'existe peut-être pas dans la nouvelle DB, on continue
      }
    }

    return { success: true, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, skipped: false, error: message };
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("📁 Migration des fichiers OVH → Scaleway");
  console.log(`   Mode: ${DRY_RUN ? "DRY-RUN" : "PRODUCTION"}`);
  if (SINCE_DATE) {
    console.log(`   Depuis: ${SINCE_DATE.toISOString().split("T")[0]}`);
  }
  console.log(`   Bucket source: ${OVH_BUCKET}`);
  console.log(`   Bucket destination: ${SCALEWAY_BUCKET}`);
  console.log(
    `   Clés de chiffrement OVH: ${[...encryptionKeys.keys()].join(", ") || "aucune"}`,
  );

  // Vérifier les variables d'environnement requises
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
  ];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(
      `❌ Variables d'environnement manquantes: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  // Récupérer les report IDs existants dans la nouvelle DB
  const existingReports = await prisma.report.findMany({
    select: { id: true },
  });
  const existingReportIds = new Set(existingReports.map((r) => r.id));
  console.log(`   Reports dans la nouvelle DB: ${existingReportIds.size}`);

  // Récupérer les fichiers déjà migrés
  const existingFiles = await prisma.file.findMany({
    select: { id: true },
  });
  const existingFileIds = new Set(existingFiles.map((f) => f.id));
  console.log(`   Fichiers déjà dans la nouvelle DB: ${existingFileIds.size}`);

  // Récupérer les fichiers depuis l'ancienne DB
  console.log("\n📋 Récupération des fichiers depuis l'ancienne DB...");
  const allFiles = await fetchFiles(undefined, SINCE_DATE);
  console.log(`   Fichiers disponibles dans l'ancienne DB: ${allFiles.length}`);

  // Filtrer : ne garder que ceux dont le report existe
  const filesToMigrate = allFiles.filter((f) =>
    existingReportIds.has(f.application_id),
  );
  console.log(
    `   Fichiers à migrer (report existant): ${filesToMigrate.length}`,
  );
  console.log(
    `   Fichiers ignorés (report inexistant): ${allFiles.length - filesToMigrate.length}`,
  );

  if (TEST_ONE) {
    const testFile = filesToMigrate[0];
    if (!testFile) {
      console.log("❌ Aucun fichier à tester");
      return;
    }
    console.log(`\n🧪 Test avec un seul fichier: ${testFile.id}`);
    console.log(`   Filename: ${testFile.filename}`);
    console.log(`   Size: ${(testFile.filesize / 1024).toFixed(0)} Ko`);
    console.log(`   Report: ${testFile.application_id}`);
    console.log(`   Encryption: ${testFile.encryption_key_id}`);

    const result = await migrateFile(testFile, existingFileIds);
    if (result.success) {
      console.log("✅ Test réussi ! Le fichier a été migré.");
    } else {
      console.error(`❌ Test échoué: ${result.error}`);
    }
    return;
  }

  // Migration par batch
  console.log(`\n🚀 Début de la migration (batch de ${BATCH_SIZE})...\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ fileId: string; error: string }> = [];

  for (let i = 0; i < filesToMigrate.length; i += BATCH_SIZE) {
    const batch = filesToMigrate.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((file) => migrateFile(file, existingFileIds)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const file = batch[j];

      if (result.status === "fulfilled") {
        if (result.value.skipped) {
          skipped++;
        } else if (result.value.success) {
          migrated++;
        } else {
          failed++;
          errors.push({
            fileId: file.id,
            error: result.value.error ?? "Unknown error",
          });
        }
      } else {
        failed++;
        errors.push({
          fileId: file.id,
          error: result.reason?.message ?? String(result.reason),
        });
      }
    }

    const total = migrated + skipped + failed;
    const pct = ((total / filesToMigrate.length) * 100).toFixed(1);
    console.log(
      `  ${pct}% | migrated: ${migrated} | skipped: ${skipped} | failed: ${failed} | total: ${total}/${filesToMigrate.length}`,
    );
  }

  // Résumé
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`   ✅ Migrés:   ${migrated}`);
  console.log(`   ⏭  Ignorés:  ${skipped}`);
  console.log(`   ❌ Échoués:  ${failed}`);

  if (errors.length > 0) {
    console.log(`\n❌ Erreurs (${errors.length} premiers) :`);
    for (const err of errors.slice(0, 20)) {
      console.log(`   ${err.fileId}: ${err.error}`);
    }
  }
}

main()
  .then(async () => {
    await disconnectSource();
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("Erreur fatale:", e);
    await disconnectSource();
    await prisma.$disconnect();
    process.exit(1);
  });
