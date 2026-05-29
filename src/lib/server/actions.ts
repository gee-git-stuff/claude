import { db } from './db.js';
import type { ActionKind, ActionRecord } from '../types.js';

const RING_BUFFER_SIZE = 200;

interface ActionPayload {
  kind: ActionKind;
  summary: string;
  forward: unknown;
  reverse: unknown;
}

export function recordAction(payload: ActionPayload): number {
  db.prepare(`DELETE FROM actions WHERE undone = 1`).run();

  const result = db.prepare(`
    INSERT INTO actions (kind, summary, forward_json, reverse_json, undone)
    VALUES (?, ?, ?, ?, 0)
  `).run(
    payload.kind,
    payload.summary,
    JSON.stringify(payload.forward),
    JSON.stringify(payload.reverse)
  );

  db.prepare(`
    DELETE FROM actions
    WHERE id IN (
      SELECT id FROM actions ORDER BY id DESC LIMIT -1 OFFSET ?
    )
  `).run(RING_BUFFER_SIZE);

  return Number(result.lastInsertRowid);
}

export function listActions(limit = 50): ActionRecord[] {
  return db.prepare(`
    SELECT * FROM actions ORDER BY id DESC LIMIT ?
  `).all(limit) as unknown as ActionRecord[];
}

export function peekUndo(): ActionRecord | undefined {
  return db.prepare(`
    SELECT * FROM actions WHERE undone = 0 ORDER BY id DESC LIMIT 1
  `).get() as unknown as ActionRecord | undefined;
}

export function peekRedo(): ActionRecord | undefined {
  return db.prepare(`
    SELECT * FROM actions WHERE undone = 1 ORDER BY id ASC LIMIT 1
  `).get() as unknown as ActionRecord | undefined;
}

export function markUndone(id: number): void {
  db.prepare(`UPDATE actions SET undone = 1 WHERE id = ?`).run(id);
}

export function markRedone(id: number): void {
  db.prepare(`UPDATE actions SET undone = 0 WHERE id = ?`).run(id);
}

export function getAction(id: number): ActionRecord | undefined {
  return db.prepare(`SELECT * FROM actions WHERE id = ?`).get(id) as unknown as ActionRecord | undefined;
}
