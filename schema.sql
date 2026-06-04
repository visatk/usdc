-- Users Table
CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    balance_usdc REAL DEFAULT 0.0,
    referred_by INTEGER,
    has_joined_channel BOOLEAN DEFAULT 0,
    trx_deposited REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Referrals Tracking Table
CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER,
    referee_id INTEGER UNIQUE,
    status TEXT DEFAULT 'pending', -- 'pending' or 'completed' (completed after force join)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(telegram_id),
    FOREIGN KEY (referee_id) REFERENCES users(telegram_id)
);
