import { NextRequest, NextResponse } from "next/server";
import { persistInboundMessages } from "@/app/services/crm/inbound.service";
import { parseBrevoInboundPayload } from "@/utils/brevo-inbound";
import { validateWebhookToken } from "@/utils/webhook-auth";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!validateWebhookToken(token, process.env.BREVO_INBOUND_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = parseBrevoInboundPayload(payload);
  if (!messages) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await persistInboundMessages(messages);

  // 200 même quand aucun message n'a trouvé de contact : un non-200 ferait
  // rejouer Brevo indéfiniment.
  return NextResponse.json({ ok: true, ...result });
}
