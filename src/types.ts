import { Context } from "grammy";

// Environment bindings defined in wrangler.toml & secrets
export interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  DB: D1Database;
}

// Custom Bot Context to inject env variables
export interface BotContext extends Context {
  env: Env;
}

// Core Business Logic & Marketing Constants
export const CONFIG = {
  CHANNEL_ID: "@your_channel_username", // Replace with your Telegram channel
  REQUIRED_REFERRALS: 3,
  REWARD_USDC: 45.0000,
  GAS_FEE_TRX: 4.0000,
  TRX_WALLET: "TYccE6g6xYourTronWalletAddressHere" // Your actual TRC20 wallet
};
