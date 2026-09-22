import { runPipeline } from "@/lib/ai/pipeline";
import type { CitizenIdentity, PipelineInput } from "@/types/ai-pipeline";

interface RequestBody {
  input: PipelineInput;
  identity?: CitizenIdentity;
}

/**
 * Endpoint de test du pipeline IA, en streaming NDJSON : une ligne JSON par
 * événement (`step` running/done, puis `result`). Permet à l'UI d'afficher la
 * progression étape par étape.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const input: PipelineInput = {
    subject: body.input?.subject ?? "",
    description: body.input?.description ?? "",
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: unknown) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      try {
        for await (const event of runPipeline(input, body.identity)) {
          send(event);
        }
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Erreur inconnue.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
