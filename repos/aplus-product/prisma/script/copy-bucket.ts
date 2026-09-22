import "dotenv/config";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent } from "node:https";

const CONCURRENCY = 20;
const MAX_RETRIES = 3;
const SOURCE_BUCKET = "administration-plus-staging";
const DEST_BUCKET = "administration-plus-prod";

const client = new S3Client({
  credentials: {
    accessKeyId: process.env.SCALEWAY_BUCKET_ACCES as string,
    secretAccessKey: process.env.SCALEWAY_BUCKET_SECRET as string,
  },
  region: process.env.SCALEWAY_REGION as string,
  endpoint: process.env.SCALEWAY_ENDPOINT as string,
  requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent({ maxSockets: 50, keepAlive: true }),
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
  }),
});

const SSE_KEY = process.env.SCALEWAY_SSE_ENCRYPTION_KEY as string;
const SSE_KEY_MD5 = process.env.SCALEWAY_SSE_KEY_DIGEST as string;

async function listAllObjects(bucket: string): Promise<Set<string>> {
  const keys = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of response.Contents ?? []) {
      if (obj.Key) keys.add(obj.Key);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function copyObject(key: string, attempt = 1): Promise<void> {
  try {
    const getResponse = await client.send(
      new GetObjectCommand({
        Bucket: SOURCE_BUCKET,
        Key: key,
        SSECustomerAlgorithm: "AES256",
        SSECustomerKey: SSE_KEY,
        SSECustomerKeyMD5: SSE_KEY_MD5,
      }),
    );

    if (!getResponse.Body) {
      throw new Error(`Empty body for ${key}`);
    }

    const body = Buffer.from(await getResponse.Body.transformToByteArray());

    await client.send(
      new PutObjectCommand({
        Bucket: DEST_BUCKET,
        Key: key,
        Body: body,
        ContentType: getResponse.ContentType ?? "application/octet-stream",
        SSECustomerAlgorithm: "AES256",
        SSECustomerKey: SSE_KEY,
        SSECustomerKeyMD5: SSE_KEY_MD5,
      }),
    );
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await sleep(1000 * 2 ** attempt);
      return copyObject(key, attempt + 1);
    }
    throw error;
  }
}

async function main() {
  console.log(`📦 Copie ${SOURCE_BUCKET} → ${DEST_BUCKET}`);

  console.log("   Listing source...");
  const sourceKeys = await listAllObjects(SOURCE_BUCKET);
  console.log(`   ${sourceKeys.size} objets dans source`);

  console.log("   Listing destination...");
  const destKeys = await listAllObjects(DEST_BUCKET);
  console.log(`   ${destKeys.size} objets déjà dans destination`);

  const toCopy = [...sourceKeys].filter((k) => !destKeys.has(k));
  console.log(`   ${toCopy.length} objets à copier\n`);

  if (toCopy.length === 0) {
    console.log("✅ Rien à copier, tout est déjà synchro !");
    return;
  }

  let copied = 0;
  let failed = 0;
  const failedKeys: string[] = [];

  // Pool de concurrence limité
  let index = 0;

  async function worker() {
    while (index < toCopy.length) {
      const currentIndex = index++;
      const key = toCopy[currentIndex];
      try {
        await copyObject(key);
        copied++;
      } catch (error) {
        failed++;
        failedKeys.push(key);
        console.error(`   ❌ ${key}: ${error}`);
      }

      const total = copied + failed;
      if (total % 100 === 0 || total === toCopy.length) {
        const pct = ((total / toCopy.length) * 100).toFixed(1);
        console.log(
          `   ${pct}% | copied: ${copied} | failed: ${failed} | ${total}/${toCopy.length}`,
        );
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n✅ Terminé: ${copied} copiés, ${failed} échoués`);

  if (failedKeys.length > 0) {
    console.log(
      `\n📋 ${failedKeys.length} clés en échec sauvegardées dans failed-keys.json`,
    );
    const fs = await import("node:fs/promises");
    await fs.writeFile("failed-keys.json", JSON.stringify(failedKeys, null, 2));
  }
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});
