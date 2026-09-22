import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { fileTypeFromBuffer } from "file-type";
import * as Sentry from "@sentry/nextjs";
import { createS3Client } from "@/utils/s3";
import { trackServerEvent } from "@/lib/analytics/server-analytics";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_REQUEST = 10;
const MAX_UPLOAD_RETRIES = 2;

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  // Texte
  "text/plain",
  "text/csv",
]);

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "Authentification requise" },
        { status: 401 },
      );
    }

    // Rate limit par userId
    const rateLimitResult = await checkRateLimit("upload", session.user.id, {
      max: 20,
      windowSeconds: 60,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { ok: false, message: "Trop de requêtes. Réessayez plus tard." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfterSeconds),
          },
        },
      );
    }

    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    // Validation du nombre de fichiers
    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Aucun fichier fourni" },
        { status: 400 },
      );
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          ok: false,
          message: `Maximum ${MAX_FILES_PER_REQUEST} fichiers par requête`,
        },
        { status: 400 },
      );
    }

    // Validation du type et de la taille de chaque fichier
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            ok: false,
            message: `Type de fichier non autorisé : ${file.type}. Types acceptés : PDF, images, documents Office, texte.`,
          },
          { status: 400 },
        );
      }
      if (file.size === 0) {
        return NextResponse.json(
          {
            ok: false,
            message: `Le fichier "${file.name}" est vide (0 octet). Veuillez vérifier le fichier et réessayer.`,
          },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            ok: false,
            message: `Le fichier "${file.name}" dépasse la taille maximale de 10 Mo`,
          },
          { status: 400 },
        );
      }
    }

    const s3Client = createS3Client();

    const results = await Promise.all(
      files.map(async (file) => {
        // L'id (clé S3 et URL de téléchargement) ne doit pas contenir le nom
        // du fichier : il peut porter des données personnelles et l'URL fuite
        // (historique navigateur, logs). Le nom d'origine reste en DB (File.name).
        const id = randomUUID();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate buffer is not empty (can happen with browser-generated PDFs)
        if (buffer.byteLength === 0) {
          throw new Error(
            `Le fichier "${file.name}" est vide (0 octet). Veuillez vérifier le fichier et réessayer.`,
          );
        }

        // Validate magic bytes match declared MIME type
        const detectedType = await fileTypeFromBuffer(buffer);
        if (detectedType && !ALLOWED_MIME_TYPES.has(detectedType.mime)) {
          throw new Error(
            `Type de fichier détecté non autorisé : ${detectedType.mime} (déclaré : ${file.type})`,
          );
        }

        const bucket = process.env.SCALEWAY_BUCKET_NAME as string;
        const sseParams = {
          SSECustomerAlgorithm: "AES256" as const,
          SSECustomerKey: process.env.SCALEWAY_SSE_ENCRYPTION_KEY as string,
          SSECustomerKeyMD5: process.env.SCALEWAY_SSE_KEY_DIGEST as string,
        };

        const headCommand = new HeadObjectCommand({
          Bucket: bucket,
          Key: id,
          ...sseParams,
        });

        // PUT + HEAD verification, retry the whole cycle if HEAD fails
        let uploadConfirmed = false;
        for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }

          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: id,
              Body: buffer,
              ContentLength: buffer.byteLength,
              ContentType: file.type,
              ...sseParams,
            }),
          );

          try {
            const headResponse = await s3Client.send(headCommand);
            if (headResponse.ContentLength && headResponse.ContentLength > 0) {
              uploadConfirmed = true;
              break;
            }
          } catch (headError) {
            Sentry.captureMessage(
              `HEAD verification failed (attempt ${attempt + 1}/${MAX_UPLOAD_RETRIES + 1}) for ${id}`,
              {
                level: attempt === MAX_UPLOAD_RETRIES ? "error" : "warning",
                extra: {
                  fileId: id,
                  filename: file.name,
                  fileSize: file.size,
                  attempt: attempt + 1,
                  maxAttempts: MAX_UPLOAD_RETRIES + 1,
                  errorName:
                    headError instanceof Error ? headError.name : "Unknown",
                  errorMessage:
                    headError instanceof Error
                      ? headError.message
                      : String(headError),
                },
              },
            );
          }
        }

        if (!uploadConfirmed) {
          throw new Error(
            `Upload verification failed after ${MAX_UPLOAD_RETRIES + 1} attempts for ${id}`,
          );
        }

        return {
          id, // unique key to save in DB (with slugified filename)
          name: file.name, // Original filename for display
          size: file.size,
          type: file.type,
          lastModified: new Date(file.lastModified),
        };
      }),
    );
    if (results.length !== files.length) {
      Sentry.captureMessage("Failed to upload some files", {
        level: "error",
        extra: {
          expected: files.length,
          received: results.length,
          userId: session.user.id,
        },
      });
      return NextResponse.json(
        { ok: false, message: "Failed to upload some files" },
        { status: 500 },
      );
    } else {
      // Track file uploads
      for (const file of results) {
        void trackServerEvent("file_uploaded", {
          fileId: file.id,
          fileSize: file.size,
          fileType: file.type,
        });
      }
      return NextResponse.json({ ok: true, data: results });
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: "upload-files" },
    });
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
