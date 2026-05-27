import { error, json } from '@sveltejs/kit';
import { deleteActivity, getActivity, updateActivity } from '$lib/server/activities.js';
import type { ActivityType } from '$lib/types.js';

export async function GET({ params }: { params: { id: string } }) {
  const activity = getActivity(Number(params.id));
  if (!activity) throw error(404, 'Not found');
  return json({ activity });
}

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
  const id = Number(params.id);
  const body = await request.json();
  const activity = updateActivity(id, {
    name: String(body.name ?? '').trim() || 'Untitled',
    type: (body.type as ActivityType) ?? 'CUSTOM',
    color: String(body.color ?? '#3b82f6'),
    notes: String(body.notes ?? '')
  });
  if (!activity) throw error(404, 'Not found');
  return json({ activity });
}

export async function DELETE({ params }: { params: { id: string } }) {
  const ok = deleteActivity(Number(params.id));
  if (!ok) throw error(404, 'Not found');
  return json({ ok: true });
}
