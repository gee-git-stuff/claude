import { json } from '@sveltejs/kit';
import { createEvent, listEvents } from '$lib/server/calendar.js';
import type { CalendarEventKind } from '$lib/types.js';

export async function GET({ url }: { url: URL }) {
  const from = url.searchParams.get('from') ?? undefined;
  const to   = url.searchParams.get('to') ?? undefined;
  return json({ events: listEvents(from ?? undefined, to ?? undefined) });
}

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const event = createEvent({
    activity_id: Number(body.activity_id),
    title: String(body.title ?? '').trim() || 'Untitled',
    kind: (body.kind as CalendarEventKind) ?? 'OTHER',
    start_date: String(body.start_date),
    end_date: body.end_date ? String(body.end_date) : null,
    notes: String(body.notes ?? '')
  });
  return json({ event }, { status: 201 });
}
