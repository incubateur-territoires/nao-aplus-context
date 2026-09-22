import { createLogger } from "@/utils/logger";

const logger = createLogger("Mattermost");

interface MattermostMessage {
  text: string;
  channel?: string;
  username?: string;
  icon_url?: string;
}

interface MattermostResponse {
  success: boolean;
  error?: string;
}

export async function postToMattermost(
  message: string,
  options?: Omit<MattermostMessage, "text">,
): Promise<MattermostResponse> {
  if (process.env.APP_ENVIRONMENT !== "production") {
    logger.info("Message ignoré (environnement non-production)");
    return { success: true };
  }

  const webhookUrl = process.env.MATTERMOST_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.error("MATTERMOST_WEBHOOK_URL is not defined");
    return { success: false, error: "MATTERMOST_WEBHOOK_URL is not defined" };
  }

  const payload: MattermostMessage = {
    text: message,
    ...options,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Webhook error", { status: response.status, errorText });
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to post message", { error });
    return { success: false, error: errorMessage };
  }
}
