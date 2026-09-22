import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env") });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  HeadObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";

const CONCURRENCY = 10;

const CREDS: S3ClientConfig = {
  credentials: {
    accessKeyId: process.env.SCALEWAY_BUCKET_ACCES as string,
    secretAccessKey: process.env.SCALEWAY_BUCKET_SECRET as string,
  },
  region: process.env.SCALEWAY_REGION as string,
  endpoint: process.env.SCALEWAY_ENDPOINT as string,
};

const SSE_PARAMS = {
  SSECustomerAlgorithm: "AES256" as const,
  SSECustomerKey: process.env.SCALEWAY_SSE_ENCRYPTION_KEY as string,
  SSECustomerKeyMD5: process.env.SCALEWAY_SSE_KEY_DIGEST as string,
};

interface FileInfo {
  id: string;
  name: string;
  reportId: string;
  lastModified: Date;
  contentLength: number;
}

async function main() {
  const DB_TARGET_MAP: Record<string, string> = {
    local: "LOCAL_DATABASE_URL",
    staging: "STAGING_DATABASE_URL",
    prod: "PROD_DATABASE_URL",
  };

  const dbTarget = process.env.DB_TARGET;
  const envVar = dbTarget ? DB_TARGET_MAP[dbTarget] : undefined;
  let connectionString = envVar
    ? process.env[envVar]
    : process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      envVar
        ? `${envVar} environment variable is not set (DB_TARGET=${dbTarget})`
        : "DATABASE_URL environment variable is not set",
    );
  }

  console.log(`Connecting to ${dbTarget || "default"} database...`);

  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, "");
  connectionString = connectionString.replace(/[?&]$/, "");

  const isTunnel = !!dbTarget && dbTarget !== "local";
  const isLocalDatabase =
    !isTunnel &&
    (connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1"));

  const pool = new Pool({
    connectionString,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const s3Client = new S3Client(CREDS);

  try {
    const files = await prisma.file.findMany({
      select: {
        id: true,
        name: true,
        reportId: true,
        lastModified: true,
      },
      orderBy: { lastModified: "desc" },
    });

    console.log(`Found ${files.length} files in database\n`);

    const emptyFiles: FileInfo[] = [];
    const missingFiles: FileInfo[] = [];
    let checked = 0;
    let index = 0;

    async function worker() {
      while (index < files.length) {
        const currentIndex = index++;
        const file = files[currentIndex];

        try {
          const head = await s3Client.send(
            new HeadObjectCommand({
              Bucket: process.env.SCALEWAY_BUCKET_NAME as string,
              Key: file.id,
              ...SSE_PARAMS,
            }),
          );

          if (!head.ContentLength || head.ContentLength === 0) {
            emptyFiles.push({
              ...file,
              contentLength: head.ContentLength ?? 0,
            });
          }
        } catch {
          missingFiles.push({ ...file, contentLength: -1 });
        }

        checked++;
        if (checked % 100 === 0 || checked === files.length) {
          const pct = ((checked / files.length) * 100).toFixed(1);
          console.log(
            `  ${pct}% | checked: ${checked}/${files.length} | empty: ${emptyFiles.length} | missing: ${missingFiles.length}`,
          );
        }
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    console.log(`\n--- Results ---`);
    console.log(`Total files in DB: ${files.length}`);
    console.log(`Empty files (0 bytes): ${emptyFiles.length}`);
    console.log(`Missing from S3: ${missingFiles.length}`);

    if (emptyFiles.length > 0) {
      console.log(`\nEmpty files (ContentLength = 0):`);
      for (const file of emptyFiles) {
        console.log(
          `  - ID: ${file.id} | Report: ${file.reportId} | Date: ${file.lastModified.toISOString()} | Name: ${file.name} | Size: ${file.contentLength}`,
        );
      }
    }

    if (missingFiles.length > 0) {
      console.log(`\nMissing files:`);
      for (const file of missingFiles) {
        console.log(
          `  - ID: ${file.id} | Report: ${file.reportId} | Date: ${file.lastModified.toISOString()} | Name: ${file.name}`,
        );
      }
    }

    if (emptyFiles.length > 0 || missingFiles.length > 0) {
      const fs = await import("node:fs/promises");
      const reportPath = "empty-files-report.json";
      await fs.writeFile(
        reportPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            totalFiles: files.length,
            emptyCount: emptyFiles.length,
            missingCount: missingFiles.length,
            emptyFiles: emptyFiles.map((f) => ({
              id: f.id,
              name: f.name,
              reportId: f.reportId,
              lastModified: f.lastModified.toISOString(),
              contentLength: f.contentLength,
            })),
            missingFiles: missingFiles.map((f) => ({
              id: f.id,
              name: f.name,
              reportId: f.reportId,
              lastModified: f.lastModified.toISOString(),
            })),
          },
          null,
          2,
        ),
      );
      console.log(`\nReport saved to ${reportPath}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
