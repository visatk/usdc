import { NextFunction } from "grammy";
import { BotContext, CONFIG } from "../types";

export async function forceJoinMiddleware(ctx: BotContext, next: NextFunction) {
  // Allow these callbacks to bypass to prevent infinite loops during check
  if (ctx.callbackQuery?.data === "check_membership" || ctx.callbackQuery?.data === "get_link") {
    return next();
  }

  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const member = await ctx.api.getChatMember(CONFIG.CHANNEL_ID, userId);
    const isMember = ["member", "administrator", "creator"].includes(member.status);

    if (!isMember) {
      await ctx.reply(
        "⚠️ **Access Denied!**\n\nYou must join our official channel to unlock the Referral Lite Dashboard and claim your USDC rewards.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📢 Join Official Channel", url: `https://t.me/${CONFIG.CHANNEL_ID.replace('@', '')}` }],
              [{ text: "🔄 Verify Membership", callback_data: "check_membership" }]
            ]
          }
        }
      );
      return; 
    }
    await next();
  } catch (error) {
    console.error("Force join check error:", error);
    await next(); // Fallback for dev mode if bot is not admin
  }
}
