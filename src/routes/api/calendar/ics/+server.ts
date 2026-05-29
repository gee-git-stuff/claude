import { buildIcs, listEvents } from '$lib/server/calendar.js';
import { listActivities } from '$lib/server/activities.js';

export async function GET({ url }: { url: URL }) {
  const idsParam = url.searchParams.get('activity_ids');
  const ids = idsParam ? new Set(idsParam.split(',').map(Number).filter((n) => !Number.isNaN(n))) : null;

  const activities = listActivities();
  const nameById = new Map(activities.map((a) => [a.id, a.name]));

  const all = listEvents();
  const events = ids ? all.filter((e) => ids.has(e.activity_id)) : all;

  const body = buildIcs(events, nameById);
  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="expense-dashboard.ics"'
    }
  });
}
