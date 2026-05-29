import { error, json } from '@sveltejs/kit';
import { tagTransaction } from '$lib/server/transactions.js';

export async function POST({ params, request }: { params: { id: string }; request: Request }) {
  const id = Number(params.id);
  const body = await request.json();
  const result = tagTransaction(id, {
    activity_id: Number(body.activity_id),
    category: String(body.category ?? ''),
    note: String(body.note ?? '')
  });
  if (!result.ok) throw error(400, result.reason ?? 'Tag failed');
  return json(result);
}
