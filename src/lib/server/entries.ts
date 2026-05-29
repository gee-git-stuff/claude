import { db } from './db.js';
import { recordAction } from './actions.js';
import type { Entry, EntryKind, EntryWithRecurrence, RecurrenceFrequency } from '../types.js';

interface EntryInput {
  activity_id: number;
  kind: EntryKind;
  amount_cents: number;
  date: string;
  category: string;
  note: string;
  recurrence?: {
    frequency: RecurrenceFrequency;
    interval: number;
    end_date: string | null;
  } | null;
}

export function listEntries(activityId?: number): EntryWithRecurrence[] {
  const where = activityId != null ? `WHERE e.activity_id = ?` : ``;
  const args = activityId != null ? [activityId] : [];
  const rows = db.prepare(`
    SELECT e.*,
           r.id AS r_id, r.frequency AS r_frequency, r.interval AS r_interval, r.end_date AS r_end_date
    FROM entries e
    LEFT JOIN recurrences r ON r.id = e.recurrence_id
    ${where}
    ORDER BY e.date DESC, e.id DESC
  `).all(...args) as unknown as Array<Entry & { r_id: number | null; r_frequency: RecurrenceFrequency | null; r_interval: number | null; r_end_date: string | null }>;

  return rows.map((r) => ({
    id: r.id,
    activity_id: r.activity_id,
    kind: r.kind,
    amount_cents: r.amount_cents,
    date: r.date,
    category: r.category,
    note: r.note,
    recurrence_id: r.recurrence_id,
    created_at: r.created_at,
    recurrence: r.r_id != null && r.r_frequency != null && r.r_interval != null
      ? { id: r.r_id, frequency: r.r_frequency, interval: r.r_interval, end_date: r.r_end_date }
      : null
  }));
}

export function getEntry(id: number): Entry | undefined {
  return db.prepare(`SELECT * FROM entries WHERE id = ?`).get(id) as unknown as Entry | undefined;
}

function createRecurrence(rec: NonNullable<EntryInput['recurrence']>): number {
  const r = db.prepare(`
    INSERT INTO recurrences (frequency, interval, end_date) VALUES (?, ?, ?)
  `).run(rec.frequency, rec.interval, rec.end_date);
  return Number(r.lastInsertRowid);
}

export function createEntry(input: EntryInput): Entry {
  const recurrenceId = input.recurrence ? createRecurrence(input.recurrence) : null;
  const result = db.prepare(`
    INSERT INTO entries (activity_id, kind, amount_cents, date, category, note, recurrence_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(input.activity_id, input.kind, input.amount_cents, input.date, input.category, input.note, recurrenceId);
  const id = Number(result.lastInsertRowid);
  const entry = getEntry(id)!;
  recordAction({
    kind: 'CREATE_ENTRY',
    summary: `${input.kind === 'EXPENSE' ? 'Added expense' : 'Added income'}: ${input.category || 'Uncategorized'}`,
    forward: { id, recurrenceId, input },
    reverse: { id, recurrenceId }
  });
  return entry;
}

export function updateEntry(id: number, input: EntryInput): Entry | undefined {
  const before = getEntry(id);
  if (!before) return undefined;
  const beforeRec = before.recurrence_id != null
    ? db.prepare(`SELECT * FROM recurrences WHERE id = ?`).get(before.recurrence_id)
    : null;

  if (before.recurrence_id != null) {
    db.prepare(`DELETE FROM recurrences WHERE id = ?`).run(before.recurrence_id);
  }
  const recurrenceId = input.recurrence ? createRecurrence(input.recurrence) : null;

  db.prepare(`
    UPDATE entries SET activity_id = ?, kind = ?, amount_cents = ?, date = ?, category = ?, note = ?, recurrence_id = ?
    WHERE id = ?
  `).run(input.activity_id, input.kind, input.amount_cents, input.date, input.category, input.note, recurrenceId, id);

  const after = getEntry(id)!;
  recordAction({
    kind: 'UPDATE_ENTRY',
    summary: `Updated ${input.kind === 'EXPENSE' ? 'expense' : 'income'}: ${input.category || 'Uncategorized'}`,
    forward: { id, recurrenceId, input },
    reverse: { id, before, beforeRec }
  });
  return after;
}

export function deleteEntry(id: number): boolean {
  const before = getEntry(id);
  if (!before) return false;
  const beforeRec = before.recurrence_id != null
    ? db.prepare(`SELECT * FROM recurrences WHERE id = ?`).get(before.recurrence_id)
    : null;
  db.prepare(`DELETE FROM entries WHERE id = ?`).run(id);
  if (before.recurrence_id != null) {
    db.prepare(`DELETE FROM recurrences WHERE id = ?`).run(before.recurrence_id);
  }
  recordAction({
    kind: 'DELETE_ENTRY',
    summary: `Deleted ${before.kind === 'EXPENSE' ? 'expense' : 'income'}: ${before.category || 'Uncategorized'}`,
    forward: { id },
    reverse: { entry: before, recurrence: beforeRec }
  });
  return true;
}

type RecurrenceRow = { id: number; frequency: RecurrenceFrequency; interval: number; end_date: string | null };

export function applyEntryForward(kind: string, payload: { id?: number; recurrenceId?: number | null; input?: EntryInput }) {
  switch (kind) {
    case 'CREATE_ENTRY': {
      if (payload.id == null || !payload.input) return;
      if (payload.input.recurrence && payload.recurrenceId != null) {
        db.prepare(`INSERT INTO recurrences (id, frequency, interval, end_date) VALUES (?, ?, ?, ?)`)
          .run(payload.recurrenceId, payload.input.recurrence.frequency, payload.input.recurrence.interval, payload.input.recurrence.end_date);
      }
      db.prepare(`
        INSERT INTO entries (id, activity_id, kind, amount_cents, date, category, note, recurrence_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(payload.id, payload.input.activity_id, payload.input.kind, payload.input.amount_cents, payload.input.date, payload.input.category, payload.input.note, payload.recurrenceId ?? null);
      return;
    }
    case 'UPDATE_ENTRY': {
      if (payload.id == null || !payload.input) return;
      const current = db.prepare(`SELECT recurrence_id FROM entries WHERE id = ?`).get(payload.id) as { recurrence_id: number | null } | undefined;
      if (current?.recurrence_id != null) db.prepare(`DELETE FROM recurrences WHERE id = ?`).run(current.recurrence_id);
      if (payload.input.recurrence && payload.recurrenceId != null) {
        db.prepare(`INSERT INTO recurrences (id, frequency, interval, end_date) VALUES (?, ?, ?, ?)`)
          .run(payload.recurrenceId, payload.input.recurrence.frequency, payload.input.recurrence.interval, payload.input.recurrence.end_date);
      }
      db.prepare(`
        UPDATE entries SET activity_id = ?, kind = ?, amount_cents = ?, date = ?, category = ?, note = ?, recurrence_id = ? WHERE id = ?
      `).run(payload.input.activity_id, payload.input.kind, payload.input.amount_cents, payload.input.date, payload.input.category, payload.input.note, payload.recurrenceId ?? null, payload.id);
      return;
    }
    case 'DELETE_ENTRY': {
      if (payload.id == null) return;
      const before = db.prepare(`SELECT recurrence_id FROM entries WHERE id = ?`).get(payload.id) as { recurrence_id: number | null } | undefined;
      db.prepare(`DELETE FROM entries WHERE id = ?`).run(payload.id);
      if (before?.recurrence_id != null) db.prepare(`DELETE FROM recurrences WHERE id = ?`).run(before.recurrence_id);
      return;
    }
  }
}

export function applyEntryReverse(kind: string, payload: { id?: number; recurrenceId?: number | null; entry?: Entry; before?: Entry; beforeRec?: RecurrenceRow | null; recurrence?: RecurrenceRow | null }) {
  switch (kind) {
    case 'CREATE_ENTRY': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM entries WHERE id = ?`).run(payload.id);
      if (payload.recurrenceId != null) db.prepare(`DELETE FROM recurrences WHERE id = ?`).run(payload.recurrenceId);
      return;
    }
    case 'UPDATE_ENTRY': {
      if (!payload.before) return;
      const current = db.prepare(`SELECT recurrence_id FROM entries WHERE id = ?`).get(payload.before.id) as { recurrence_id: number | null } | undefined;
      if (current?.recurrence_id != null) db.prepare(`DELETE FROM recurrences WHERE id = ?`).run(current.recurrence_id);
      if (payload.beforeRec) {
        db.prepare(`INSERT INTO recurrences (id, frequency, interval, end_date) VALUES (?, ?, ?, ?)`)
          .run(payload.beforeRec.id, payload.beforeRec.frequency, payload.beforeRec.interval, payload.beforeRec.end_date);
      }
      const b = payload.before;
      db.prepare(`
        UPDATE entries SET activity_id = ?, kind = ?, amount_cents = ?, date = ?, category = ?, note = ?, recurrence_id = ? WHERE id = ?
      `).run(b.activity_id, b.kind, b.amount_cents, b.date, b.category, b.note, b.recurrence_id, b.id);
      return;
    }
    case 'DELETE_ENTRY': {
      if (!payload.entry) return;
      if (payload.recurrence) {
        db.prepare(`INSERT INTO recurrences (id, frequency, interval, end_date) VALUES (?, ?, ?, ?)`)
          .run(payload.recurrence.id, payload.recurrence.frequency, payload.recurrence.interval, payload.recurrence.end_date);
      }
      const e = payload.entry;
      db.prepare(`
        INSERT INTO entries (id, activity_id, kind, amount_cents, date, category, note, recurrence_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(e.id, e.activity_id, e.kind, e.amount_cents, e.date, e.category, e.note, e.recurrence_id, e.created_at);
      return;
    }
  }
}
