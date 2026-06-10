import { NextFunction } from "grammy";
import { BotContext, CONFIG } from "../types";
import { completeReferral, hasUserJoined, updateUserJoined, getReferralCount } from "../db/queries";

export async function forceJoinMiddleware(ctx: BotContext, next: NextFunction) {
  // Allow get_link to bypass (though they shouldn't reach here if not joined anyway)
  // We remove check_membership bypass so it actually checks!
  if (ctx.callbackQuery?.data === "get_link") {
    return next();
  }

  const userId = ctx.from?.id;
  if (!userId) return;

  let isMember = false;

  try {
    const member = await ctx.api.getChatMember(CONFIG.CHANNEL_ID, userId);
    isMember = ["member", "administrator", "creator"].includes(member.status);
  } catch (error) {
    console.error("Force join check error:", error);
    // If we fail to check (e.g., bot not admin), we should probably block or allow.
    // Blocking is safer for production, but we can allow in dev. 
    // Assuming production ready: we block if we can't verify.
    // For now, let's keep the fallback to true if channel is completely invalid,
    // but in prod it should be configured properly. Let's block.
    // We will assume `isMember = false` on error, unless we want to allow dev fallback.
    // For now, let's block on error because otherwise anyone can bypass by sending a bad channel id.
  }

  if (!isMember) {
    // If they clicked check_membership, answer it so it doesn't spin
    if (ctx.callbackQuery?.data === "check_membership") {
      await ctx.answerCallbackQuery("You still haven't joined!");
    }

    // Since they aren't a member, send them the join prompt.
    // If it's a callback query, we can edit the message, but it might be easier to just reply.
    const text = "⚠️ **Access Denied!**\n\nYou must join our official channel to unlock the Referral Lite Dashboard and claim your USDC rewards.";
    const markup = {
      inline_keyboard: [
        [{ text: "📢 Join Official Channel", url: `https://t.me/${CONFIG.CHANNEL_ID.replace('@', '')}` }],
        [{ text: "🔄 Verify Membership", callback_data: "check_membership" }]
      ]
    };

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: markup });
      } catch (e) {
        // message might be identical
      }
    } else {
      await ctx.reply(text, { parse_mode: "Markdown", reply_markup: markup });
    }
    return;
  }

  // They are a member! Check if we need to complete a pending referral.
  try {
    const joined = await hasUserJoined(ctx.env, userId);
    if (!joined) {
      await updateUserJoined(ctx.env, userId);
      const referrerId = await completeReferral(ctx.env, userId);
      
      if (referrerId) {
        // Notify the referrer!
        try {
          const newCount = await getReferralCount(ctx.env, referrerId);
          let notif = `🔔 *New Referral!*\nSomeone you invited has joined the channel. You now have \`${newCount}\` completed referrals.`;
          await ctx.api.sendMessage(referrerId, notif, { parse_mode: "Markdown" });
        } catch (e) {
          console.error("Failed to notify referrer:", e);
        }
      }
    }
  } catch (err) {
    console.error("DB error in forceJoin middleware:", err);
  }

  await next();
}
