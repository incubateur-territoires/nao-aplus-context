import {
  DeleteObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { slugifyFilename } from "@/utils/slugify";

const CREDS: S3ClientConfig = {
  credentials: {
    accessKeyId: process.env.SCALEWAY_BUCKET_ACCES as string,
    secretAccessKey: process.env.SCALEWAY_BUCKET_SECRET as string,
  },
  region: process.env.SCALEWAY_REGION as string,
  endpoint: process.env.SCALEWAY_ENDPOINT as string,
};

/**
 * Client S3 Scaleway partagé (upload, download, suppression).
 */
export function createS3Client(): S3Client {
  return new S3Client(CREDS);
}

const FILE_ID_REGEX =
  /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-(.+)$/i;

/**
 * Construit les variantes de clé S3 à tenter pour un `File.id` : l'id brut
 * (format historique) et sa version re-slugifiée (nouveau format), comme le
 * fait la route de téléchargement (`files/[id]/route.ts`).
 */
function buildKeyVariants(fileId: string): string[] {
  const match = fileId.match(FILE_ID_REGEX);
  if (!match) return [fileId];

  const [, uuid, filename] = match;
  const slugified = `${uuid}-${slugifyFilename(filename)}`;
  return slugified === fileId ? [fileId] : [fileId, slugified];
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "NoSuchKey" || name === "NotFound";
}

/**
 * Supprime l'objet correspondant à un `File.id` du bucket Scaleway.
 *
 * Tente les deux variantes de clé (id brut + slugifié). Un objet déjà absent
 * (`NoSuchKey` / `NotFound`) est traité comme un succès — le bucket a déjà connu
 * des fichiers manquants et il ne faut pas bloquer l'effacement pour autant.
 * Toute autre erreur (credentials, réseau) est propagée à l'appelant.
 */
export async function deleteFileFromBucket(fileId: string): Promise<void> {
  const s3Client = createS3Client();
  const bucket = process.env.SCALEWAY_BUCKET_NAME as string;
  const keys = buildKeyVariants(fileId);

  let lastError: unknown = null;
  for (const key of keys) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
      return;
    } catch (error) {
      if (isNotFoundError(error)) return;
      lastError = error;
    }
  }

  if (lastError) throw lastError;
}
