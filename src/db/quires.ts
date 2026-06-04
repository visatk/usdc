import { Env } from "../types";

export async function createUser(env: Env, userId: number, username?: string) {
  const stmt = env.DB.prepare("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)").bind(userId, username || null);
  await stmt.run();
}

export async function addReferral(env: Env, referrerId: number, refereeId: number) {
  try {
    const stmt = env.DB.prepare("INSERT INTO referrals (referrer_id, referee_id) VALUES (?, ?)").bind(referrerId, refereeId);
    await stmt.run();
    return true;
  } catch (error) {
    return false; // Unique constraint hit (already referred)
  }
}

export async function getReferralCount(env: Env, userId: number): Promise<number> {
  const stmt = env.DB.prepare("SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?").bind(userId);
  const result = await stmt.first<{ count: number }>();
  return result?.count || 0;
}
