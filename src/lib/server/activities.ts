import { db } from './db.js';
import { recordAction } from './actions.js';
import type { Activity, ActivityType, ActivityTotals, Entry } from '../types.js';

export function listActivities(): Activity[] {
  return db.prepare(`SELECT * FROM activities ORDER BY name`).all() as unknown as Activity[];
}

export function getActivity(id: number): Activity | undefined {
  return db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id) as unknown as Activity | undefined;
}

interface ActivityInput {
  name: string;
  type: ActivityType;
  color: string;
  notes: string;
}

export function createActivity(input: ActivityInput): Activity {
  const result = db.prepare(`
    INSERT INTO activities (name, type, color, notes) VALUES (?, ?, ?, ?)
  `).run(input.name, input.type, input.color, input.notes);
  const id = Number(result.lastInsertRowid);
  const activity = getActivity(id)!;
  recordAction({
    kind: 'CREATE_ACTIVITY',
    summary: `Created activity "${activity.name}"`,
    forward: { id, input },
    reverse: { id }
  });
  return activity;
}

export function updateActivity(id: number, input: ActivityInput): Activity | undefined {
  const before = getActivity(id);
  if (!before) return undefined;
  db.prepare(`
    UPDATE activities SET name = ?, type = ?, color = ?, notes = ? WHERE id = ?
  `).run(input.name, input.type, input.color, input.notes, id);
  const after = getActivity(id)!;
  recordAction({
    kind: 'UPDATE_ACTIVITY',
    summary: `Updated activity "${after.name}"`,
    forward: { id, input },
    reverse: { id, input: { name: before.name, type: before.type, color: before.color, notes: before.notes } }
  });
  return after;
}

export function deleteActivity(id: number): boolean {
  const before = getActivity(id);
  if (!before) return false;
  const entries = db.prepare(`SELECT * FROM entries WHERE activity_id = ?`).all(id) as unknown as Entry[];
  db.prepare(`DELETE FROM activities WHERE id = ?`).run(id);
  recordAction({
    kind: 'DELETE_ACTIVITY',
    summary: `Deleted activity "${before.name}"`,
    forward: { id },
    reverse: { activity: before, entries }
  });
  return true;
}

export function applyActivityForward(kind: string, payload: { id?: number; input?: ActivityInput; activity?: Activity; entries?: unknown[] }) {
  switch (kind) {
    case 'CREATE_ACTIVITY': {
      if (payload.id == null || !payload.input) return;
      db.prepare(`
        INSERT INTO activities (id, name, type, color, notes) VALUES (?, ?, ?, ?, ?)
      `).run(payload.id, payload.input.name, payload.input.type, payload.input.color, payload.input.notes);
      return;
    }
    case 'UPDATE_ACTIVITY': {
      if (payload.id == null || !payload.input) return;
      db.prepare(`
        UPDATE activities SET name = ?, type = ?, color = ?, notes = ? WHERE id = ?
      `).run(payload.input.name, payload.input.type, payload.input.color, payload.input.notes, payload.id);
      return;
    }
    case 'DELETE_ACTIVITY': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM activities WHERE id = ?`).run(payload.id);
      return;
    }
  }
}

export function applyActivityReverse(kind: string, payload: { id?: number; input?: ActivityInput; activity?: Activity; entries?: Entry[] }) {
  switch (kind) {
    case 'CREATE_ACTIVITY': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM activities WHERE id = ?`).run(payload.id);
      return;
    }
    case 'UPDATE_ACTIVITY': {
      if (payload.id == null || !payload.input) return;
      db.prepare(`
        UPDATE activities SET name = ?, type = ?, color = ?, notes = ? WHERE id = ?
      `).run(payload.input.name, payload.input.type, payload.input.color, payload.input.notes, payload.id);
      return;
    }
    case 'DELETE_ACTIVITY': {
      if (!payload.activity) return;
      const a = payload.activity;
      db.prepare(`
        INSERT INTO activities (id, name, type, color, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(a.id, a.name, a.type, a.color, a.notes, a.created_at);
      if (payload.entries) {
        for (const e of payload.entries) {
          db.prepare(`
            INSERT INTO entries (id, activity_id, kind, amount_cents, date, category, note, recurrence_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(e.id, e.activity_id, e.kind, e.amount_cents, e.date, e.category, e.note, e.recurrence_id, e.created_at);
        }
      }
      return;
    }
  }
}

export function activityTotals(): ActivityTotals[] {
  return db.prepare(`
    SELECT
      a.id AS activity_id,
      COALESCE(SUM(CASE WHEN e.kind = 'EXPENSE' THEN e.amount_cents ELSE 0 END), 0) AS expense_cents,
      COALESCE(SUM(CASE WHEN e.kind = 'INCOME'  THEN e.amount_cents ELSE 0 END), 0) AS income_cents,
      COALESCE(SUM(CASE WHEN e.kind = 'INCOME'  THEN e.amount_cents
                        WHEN e.kind = 'EXPENSE' THEN -e.amount_cents ELSE 0 END), 0) AS net_cents
    FROM activities a
    LEFT JOIN entries e ON e.activity_id = a.id
    GROUP BY a.id
    ORDER BY a.name
  `).all() as unknown as ActivityTotals[];
}
