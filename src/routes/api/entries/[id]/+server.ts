import { error, json } from '@sveltejs/kit';
import { deleteEntry, updateEntry } from '$lib/server/entries.js';
import type { EntryKind, RecurrenceFrequency } from '$lib/types.js';

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
  const id = Number(params.id);
  const body = await request.json();
  const recurrence = body.recurrence
    ? {
        frequency: body.recurrence.frequency as RecurrenceFrequency,
        interval: Number(body.recurrence.interval ?? 1),
        end_date: body.recurrence.end_date ?? null
      }
    : null;
  const entry = updateEntry(id, {
    activity_id: Number(body.activity_id),
    kind: (body.kind as EntryKind) ?? 'EXPENSE',
    amount_cents: Number(body.amount_cents ?? 0),
    date: String(body.date),
    category: String(body.category ?? ''),
    note: String(body.note ?? ''),
    recurrence
  });
  if (!entry) throw error(404, 'Not found');
  return json({ entry });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const ok = deleteEntry(Number(params.id));
  if (!ok) throw error(404, 'Not found');
  return json({ ok: true });
}
