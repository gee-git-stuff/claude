import { db } from './db.js';

export const DEFAULTS: Record<string, string> = {
  ollama_url:   'http://localhost:11434',
  ollama_model: 'llama3.2-vision'
};

export function getSetting(key: string): string {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? DEFAULTS[key] ?? '';
}

export function setSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as Array<{ key: string; value: string }>;
  const out: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
