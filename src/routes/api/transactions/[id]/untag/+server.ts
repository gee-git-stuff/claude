import { error, json } from '@sveltejs/kit';
import { untagTransaction } from '$lib/server/transactions.js';

export async function POST({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const result = untagTransaction(id);
  if (!result.ok) throw error(400, result.reason ?? 'Untag failed');
  return json(result);
}
