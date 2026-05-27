import { json } from '@sveltejs/kit';
import { createEntry, listEntries } from '$lib/server/entries.js';
import type { EntryKind, RecurrenceFrequency } from '$lib/types.js';

export async function GET({ url }: { url: URL }) {
  const activityParam = url.searchParams.get('activity_id');
  const activityId = activityParam ? Number(activityParam) : undefined;
  return json({ entries: listEntries(activityId) });
}

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const recurrence = body.recurrence
    ? {
        frequency: body.recurrence.frequency as RecurrenceFrequency,
        interval: Number(body.recurrence.interval ?? 1),
        end_date: body.recurrence.end_date ?? null
      }
    : null;
  const entry = createEntry({
    activity_id: Number(body.activity_id),
    kind: (body.kind as EntryKind) ?? 'EXPENSE',
    amount_cents: Number(body.amount_cents ?? 0),
    date: String(body.date),
    category: String(body.category ?? ''),
    note: String(body.note ?? ''),
    recurrence
  });
  return json({ entry }, { status: 201 });
}
