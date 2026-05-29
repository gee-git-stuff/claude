import { db } from './db.js';
import { recordAction } from './actions.js';
import type { CalendarEvent, CalendarEventKind } from '../types.js';

interface EventInput {
  activity_id: number;
  title: string;
  kind: CalendarEventKind;
  start_date: string;
  end_date: string | null;
  notes: string;
}

export function listEvents(from?: string, to?: string): CalendarEvent[] {
  if (from && to) {
    return db.prepare(`
      SELECT * FROM calendar_events
      WHERE start_date <= ? AND COALESCE(end_date, start_date) >= ?
      ORDER BY start_date, id
    `).all(to, from) as unknown as CalendarEvent[];
  }
  return db.prepare(`SELECT * FROM calendar_events ORDER BY start_date, id`).all() as unknown as CalendarEvent[];
}

export function getEvent(id: number): CalendarEvent | undefined {
  return db.prepare(`SELECT * FROM calendar_events WHERE id = ?`).get(id) as unknown as CalendarEvent | undefined;
}

export function createEvent(input: EventInput): CalendarEvent {
  const r = db.prepare(`
    INSERT INTO calendar_events (activity_id, title, kind, start_date, end_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.activity_id, input.title, input.kind, input.start_date, input.end_date, input.notes);
  const id = Number(r.lastInsertRowid);
  const event = getEvent(id)!;
  recordAction({
    kind: 'CREATE_EVENT',
    summary: `Added "${input.title}" on ${input.start_date}`,
    forward: { id, input },
    reverse: { id }
  });
  return event;
}

export function updateEvent(id: number, input: EventInput): CalendarEvent | undefined {
  const before = getEvent(id);
  if (!before) return undefined;
  db.prepare(`
    UPDATE calendar_events SET activity_id = ?, title = ?, kind = ?, start_date = ?, end_date = ?, notes = ?
    WHERE id = ?
  `).run(input.activity_id, input.title, input.kind, input.start_date, input.end_date, input.notes, id);
  const after = getEvent(id)!;
  recordAction({
    kind: 'UPDATE_EVENT',
    summary: `Updated "${input.title}"`,
    forward: { id, input },
    reverse: { id, input: { activity_id: before.activity_id, title: before.title, kind: before.kind, start_date: before.start_date, end_date: before.end_date, notes: before.notes } }
  });
  return after;
}

export function deleteEvent(id: number): boolean {
  const before = getEvent(id);
  if (!before) return false;
  db.prepare(`DELETE FROM calendar_events WHERE id = ?`).run(id);
  recordAction({
    kind: 'DELETE_EVENT',
    summary: `Deleted "${before.title}"`,
    forward: { id },
    reverse: { event: before }
  });
  return true;
}

export function applyEventForward(kind: string, payload: { id?: number; input?: EventInput; event?: CalendarEvent }) {
  switch (kind) {
    case 'CREATE_EVENT': {
      if (payload.id == null || !payload.input) return;
      const i = payload.input;
      db.prepare(`INSERT INTO calendar_events (id, activity_id, title, kind, start_date, end_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(payload.id, i.activity_id, i.title, i.kind, i.start_date, i.end_date, i.notes);
      return;
    }
    case 'UPDATE_EVENT': {
      if (payload.id == null || !payload.input) return;
      const i = payload.input;
      db.prepare(`UPDATE calendar_events SET activity_id = ?, title = ?, kind = ?, start_date = ?, end_date = ?, notes = ? WHERE id = ?`)
        .run(i.activity_id, i.title, i.kind, i.start_date, i.end_date, i.notes, payload.id);
      return;
    }
    case 'DELETE_EVENT': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM calendar_events WHERE id = ?`).run(payload.id);
      return;
    }
  }
}

export function applyEventReverse(kind: string, payload: { id?: number; input?: EventInput; event?: CalendarEvent }) {
  switch (kind) {
    case 'CREATE_EVENT': {
      if (payload.id == null) return;
      db.prepare(`DELETE FROM calendar_events WHERE id = ?`).run(payload.id);
      return;
    }
    case 'UPDATE_EVENT': {
      if (payload.id == null || !payload.input) return;
      const i = payload.input;
      db.prepare(`UPDATE calendar_events SET activity_id = ?, title = ?, kind = ?, start_date = ?, end_date = ?, notes = ? WHERE id = ?`)
        .run(i.activity_id, i.title, i.kind, i.start_date, i.end_date, i.notes, payload.id);
      return;
    }
    case 'DELETE_EVENT': {
      if (!payload.event) return;
      const e = payload.event;
      db.prepare(`INSERT INTO calendar_events (id, activity_id, title, kind, start_date, end_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(e.id, e.activity_id, e.title, e.kind, e.start_date, e.end_date, e.notes, e.created_at);
      return;
    }
  }
}

export function buildIcs(events: CalendarEvent[], activityNameById: Map<number, string>): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Expense Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  for (const e of events) {
    const start = e.start_date.replace(/-/g, '');
    const endDate = e.end_date ?? e.start_date;
    const endPlusOne = nextDayCompact(endDate);
    const activityName = activityNameById.get(e.activity_id) ?? '';
    const summary = activityName ? `${activityName}: ${e.title}` : e.title;
    lines.push(
      'BEGIN:VEVENT',
      `UID:event-${e.id}@expense-dashboard`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${endPlusOne}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `CATEGORIES:${e.kind}`,
      ...(e.notes ? [`DESCRIPTION:${escapeIcs(e.notes)}`] : []),
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}

function nextDayCompact(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
