import { Context } from "grammy";

// 1. Defining the interface for the Payment Worker (Worker A)
// This enables strict typing when we call env.PAYMENT_RPC
export interface PaymentRPCService {
  createOrder(payload: { userId: number; amount: number; currency: string }): Promise<{
    orderId: string;
    address: string;
    amount: number;
  }>;
  
  getStatus(userId: number): Promise<{
    isPaid: boolean;
    txHash?: string;
  }>;
}

// 2. Cloudflare Environment Bindings
export interface Env {
  BOT_TOKEN: string;      // Set via `wrangler secret put BOT_TOKEN`
  WEBHOOK_SECRET: string; // Set via `wrangler secret put WEBHOOK_SECRET`
  DB: D1Database;
  
  // RPC Service Binding. Cloudflare passes methods as structured clones.
  PAYMENT_RPC: Service<PaymentRPCService>;
}

// 3. Custom Bot Context
export interface BotContext extends Context {
  env: Env;
}

// 4. Constants mirroring your marketing screenshots
export const CONFIG = {
  CHANNEL_ID: "@your_channel_username", 
  REQUIRED_REFERRALS: 3,
  REWARD_USDC: 45.0000,
  GAS_FEE_TRX: 4.0000,
};
