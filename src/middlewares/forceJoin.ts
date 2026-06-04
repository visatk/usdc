import { NextFunction } from "grammy";
import { BotContext, CONFIG } from "../types";

export async function forceJoinMiddleware(ctx: BotContext, next: NextFunction) {
  // Allow 'check_membership' callback to bypass this middleware initially
  if (ctx.callbackQuery?.data === "check_membership") {
    return next();
  }

  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    // Check membership status in the configured channel
    const member = await ctx.api.getChatMember(CONFIG.CHANNEL_ID, userId);
    const isMember = ["member", "administrator", "creator"].includes(member.status);

    if (!isMember) {
      await ctx.reply(
        "⚠️ *Access Denied!*\n\nYou must join our official channel to unlock the Referral Dashboard and earn your 45 USDC bonus.",
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
      return; // Short-circuit, do not proceed to command
    }

    // User is a member, proceed to next handler
    await next();
  } catch (error) {
    console.error("Force join check failed. Is bot admin in the channel?", error);
    // If bot isn't admin yet, it will fail. Proceed to prevent locking users out during dev.
    await next(); 
  }
}
