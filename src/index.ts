import { webhookCallback } from "grammy";
import { createBot } from "./bot";
import { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // This path handles incoming updates from Telegram
    if (url.pathname === "/bot-webhook") {
      // Security: verify the secret token set in Telegram webhook
      const secretToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secretToken !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 403 });
      }

      const bot = createBot(env);
      const handleUpdate = webhookCallback(bot, "cloudflare-mod");
      return handleUpdate(request);
    }

    // Default route to check if worker is alive
    return new Response("Referral Bot Server is running 🚀", { status: 200 });
  },
};
