import { error, json } from '@sveltejs/kit';
import { deleteEvent, updateEvent } from '$lib/server/calendar.js';
import type { CalendarEventKind } from '$lib/types.js';

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
  const id = Number(params.id);
  const body = await request.json();
  const event = updateEvent(id, {
    activity_id: Number(body.activity_id),
    title: String(body.title ?? '').trim() || 'Untitled',
    kind: (body.kind as CalendarEventKind) ?? 'OTHER',
    start_date: String(body.start_date),
    end_date: body.end_date ? String(body.end_date) : null,
    notes: String(body.notes ?? '')
  });
  if (!event) throw error(404, 'Not found');
  return json({ event });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const ok = deleteEvent(Number(params.id));
  if (!ok) throw error(404, 'Not found');
  return json({ ok: true });
}
