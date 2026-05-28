import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH ?? './data/expenses.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS activities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('AIRBNB','TURO','PROPERTY','CUSTOM')),
    color       TEXT NOT NULL DEFAULT '#3b82f6',
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recurrences (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    frequency   TEXT NOT NULL CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY','ANNUAL')),
    interval    INTEGER NOT NULL DEFAULT 1,
    end_date    TEXT
  );

  CREATE TABLE IF NOT EXISTS entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id   INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('EXPENSE','INCOME')),
    amount_cents  INTEGER NOT NULL,
    date          TEXT NOT NULL,
    category      TEXT NOT NULL DEFAULT '',
    note          TEXT NOT NULL DEFAULT '',
    recurrence_id INTEGER REFERENCES recurrences(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_entries_activity ON entries(activity_id);
  CREATE INDEX IF NOT EXISTS idx_entries_date     ON entries(date);

  CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('CHECKING','SAVINGS','CREDIT','LOAN','CASH','OTHER')),
    balance_cents INTEGER NOT NULL DEFAULT 0,
    notes         TEXT NOT NULL DEFAULT '',
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bank_txns (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date         TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    raw_row      TEXT NOT NULL DEFAULT '',
    entry_id     INTEGER REFERENCES entries(id) ON DELETE SET NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_bank_txns_account ON bank_txns(account_id);
  CREATE INDEX IF NOT EXISTS idx_bank_txns_date    ON bank_txns(date);

  CREATE TABLE IF NOT EXISTS actions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    kind          TEXT NOT NULL,
    summary       TEXT NOT NULL,
    forward_json  TEXT NOT NULL,
    reverse_json  TEXT NOT NULL,
    undone        INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_actions_created ON actions(created_at DESC);
`);

function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn('accounts', 'csv_mapping_json', `csv_mapping_json TEXT NOT NULL DEFAULT '{}'`);
ensureColumn('entries',  'bank_txn_id',      `bank_txn_id INTEGER REFERENCES bank_txns(id) ON DELETE SET NULL`);
