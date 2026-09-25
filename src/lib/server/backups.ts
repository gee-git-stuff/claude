import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { db } from './db.js';

const DB_PATH = process.env.DB_PATH ?? './data/expenses.db';
const BACKUP_DIR = join(dirname(DB_PATH), 'backups');
const KEEP_MAX = Number(process.env.BACKUP_KEEP ?? 30);
const STARTUP_MIN_HOURS = Number(process.env.BACKUP_STARTUP_HOURS ?? 6);

export interface BackupFile {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) + 'T' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function ensureBackupDir() {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

export function listBackups(): BackupFile[] {
  if (!existsSync(BACKUP_DIR)) return [];
  const entries: BackupFile[] = [];
  for (const name of readdirSync(BACKUP_DIR)) {
    if (!name.startsWith('expenses-') || !name.endsWith('.db')) continue;
    const full = join(BACKUP_DIR, name);
    try {
      const s = statSync(full);
      if (!s.isFile()) continue;
      entries.push({
        filename: name,
        path: full,
        size_bytes: s.size,
        created_at: s.mtime.toISOString()
      });
    } catch { /* skip unreadable */ }
  }
  entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return entries;
}

export function pruneBackups(keep = KEEP_MAX): number {
  const all = listBackups();
  const excess = all.slice(keep);
  let removed = 0;
  for (const b of excess) {
    try { unlinkSync(b.path); removed++; } catch { /* ignore */ }
  }
  return removed;
}

export function backupNow(reason: 'startup' | 'manual'): BackupFile | null {
  if (!existsSync(DB_PATH)) return null;
  const dbStat = statSync(DB_PATH);
  if (dbStat.size === 0) return null;

  try { db.exec('PRAGMA wal_checkpoint(FULL)'); } catch { /* best effort */ }

  ensureBackupDir();
  const name = `expenses-${timestamp()}-${reason}.db`;
  const target = join(BACKUP_DIR, name);
  copyFileSync(DB_PATH, target);

  const s = statSync(target);
  pruneBackups();
  return {
    filename: basename(target),
    path: target,
    size_bytes: s.size,
    created_at: s.mtime.toISOString()
  };
}

export function maybeStartupBackup(): BackupFile | null {
  if (!existsSync(DB_PATH)) return null;
  const dbStat = statSync(DB_PATH);
  if (dbStat.size === 0) return null;

  const existing = listBackups();
  if (existing.length > 0) {
    const newest = new Date(existing[0].created_at).getTime();
    const cutoff = Date.now() - STARTUP_MIN_HOURS * 3600 * 1000;
    if (newest > cutoff) return null;
  }
  try {
    return backupNow('startup');
  } catch (e) {
    console.warn('[backup] startup backup failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
