import { json } from '@sveltejs/kit';
import { createActivity, listActivities, activityTotals } from '$lib/server/activities.js';
import type { ActivityType } from '$lib/types.js';

export async function GET() {
  return json({
    activities: listActivities(),
    totals: activityTotals()
  });
}

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const activity = createActivity({
    name: String(body.name ?? '').trim() || 'Untitled',
    type: (body.type as ActivityType) ?? 'CUSTOM',
    color: String(body.color ?? '#3b82f6'),
    notes: String(body.notes ?? '')
  });
  return json({ activity }, { status: 201 });
}
