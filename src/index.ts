import { webhookCallback } from "grammy";
import { createBot } from "./bot";
import { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/bot-webhook") {
      const secretToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      
      // Zero Exposure / Security: Validate Telegram Secret
      if (secretToken !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 403 });
      }

      // Initialize Bot and pass Cloudflare execution context
      const bot = createBot(env);
      const handleUpdate = webhookCallback(bot, "cloudflare-mod");
      return handleUpdate(request);
    }

    return new Response("Telegram Bot Worker B is running smoothly with RPC 🚀", { status: 200 });
  },
};
