import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { slugifyFilename } from "@/utils/slugify";
import { createS3Client } from "@/utils/s3";
import { trackServerEvent } from "@/lib/analytics/server-analytics";
import { canAccessReportFiles } from "@/trpc/middleware/authorization";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  try {
    // Decode URL-encoded characters in the file ID
    // Next.js may already decode it, but we handle both cases
    let id: string;
    try {
      id = decodeURIComponent(rawId);
    } catch {
      // If already decoded or invalid encoding, use as-is
      id = rawId;
    }

    // Authentification
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 },
      );
    }

    // Bloquer l'accès aux fichiers en mode impersonation
    const sessionRecord = session.session as
      | (Record<string, unknown> & { impersonatedBy?: string | null })
      | undefined;
    if (sessionRecord?.impersonatedBy) {
      return NextResponse.json(
        { error: "Accès aux fichiers non autorisé en mode impersonation" },
        { status: 403 },
      );
    }

    // Deux formats d'id coexistent :
    // - nouveau : UUID pur, sans nom de fichier (le nom peut contenir des
    //   données personnelles et l'URL fuite : historique navigateur, logs) ;
    // - historique : `<uuid>-<nom-du-fichier>`, le nom servant aussi de clé S3.
    const pureUuidMatch = id.match(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    );
    const legacyMatch = id.match(
      /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-(.+)$/i,
    );
    if (!pureUuidMatch && !legacyMatch) {
      return NextResponse.json(
        { error: "Invalid file ID format" },
        { status: 400 },
      );
    }

    // Recherche du fichier en DB pour obtenir le reportId et le nom d'affichage
    const candidateIds = [id];
    if (legacyMatch) {
      const [, uuid, legacyFilename] = legacyMatch;
      const slugifiedId = `${uuid}-${slugifyFilename(legacyFilename)}`;
      if (slugifiedId !== id) candidateIds.push(slugifiedId);
    }
    const file = await prisma.file.findFirst({
      where: {
        id: { in: candidateIds },
      },
      select: { reportId: true, name: true },
    });

    if (!file) {
      return NextResponse.json(
        { error: "Fichier non trouvé" },
        { status: 404 },
      );
    }

    const filename = legacyMatch ? legacyMatch[2] : file.name;

    // Autorisation
    const hasAccess = await canAccessReportFiles(
      session.user.id,
      file.reportId,
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé à ce fichier" },
        { status: 403 },
      );
    }

    const s3Client = createS3Client();

    // La clé S3 est l'un des ids candidats (id brut, ou variante slugifiée
    // pour les fichiers historiques) : tenter chaque variante.
    const keysToTry = candidateIds;

    let response;
    let lastError: Error | null = null;

    for (const key of keysToTry) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.SCALEWAY_BUCKET_NAME as string,
          Key: key,
          SSECustomerAlgorithm: "AES256",
          SSECustomerKey: process.env.SCALEWAY_SSE_ENCRYPTION_KEY as string,
          SSECustomerKeyMD5: process.env.SCALEWAY_SSE_KEY_DIGEST as string,
        });

        response = await s3Client.send(command);
        if (response.Body) {
          break; // Success, exit loop
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next key
      }
    }

    if (!response || !response.Body) {
      Sentry.captureMessage("File in DB but missing from S3", {
        level: "warning",
        extra: {
          fileId: id,
          keysAttempted: keysToTry,
          lastError: lastError?.message,
          reportId: file.reportId,
        },
      });
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = await response.Body.transformToByteArray();

    // Track file download (don't log filename — may contain PII)
    void trackServerEvent("file_downloaded", {
      fileId: id,
    });

    // Encode filename for Content-Disposition header (RFC 5987)
    // Headers must be ASCII, so we need to encode Unicode characters
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_"); // Replace non-ASCII with underscore
    const encodedFilename = encodeURIComponent(filename)
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29");
    const contentDisposition = `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": response.ContentType || "application/octet-stream",
        "Content-Disposition": contentDisposition,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: "files/[id]", fileId: rawId },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
