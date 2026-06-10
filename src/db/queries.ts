import { Env } from "../types";

export async function createUser(env: Env, userId: number, username?: string) {
  const stmt = env.DB.prepare("INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)").bind(userId, username || null);
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

export async function completeReferral(env: Env, refereeId: number): Promise<number | null> {
  // Update status to completed and return the referrer_id so we can notify them
  const stmt = env.DB.prepare(
    "UPDATE referrals SET status = 'completed' WHERE referee_id = ? AND status = 'pending' RETURNING referrer_id"
  ).bind(refereeId);
  
  const result = await stmt.first<{ referrer_id: number }>();
  return result?.referrer_id || null;
}

export async function getReferralCount(env: Env, userId: number): Promise<number> {
  const stmt = env.DB.prepare("SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND status = 'completed'").bind(userId);
  const result = await stmt.first<{ count: number }>();
  return result?.count || 0;
}

export async function hasUserJoined(env: Env, userId: number): Promise<boolean> {
  const stmt = env.DB.prepare("SELECT has_joined_channel FROM users WHERE telegram_id = ?").bind(userId);
  const result = await stmt.first<{ has_joined_channel: number }>();
  return result?.has_joined_channel === 1;
}

export async function updateUserJoined(env: Env, userId: number) {
  const stmt = env.DB.prepare("UPDATE users SET has_joined_channel = 1 WHERE telegram_id = ?").bind(userId);
  await stmt.run();
}
