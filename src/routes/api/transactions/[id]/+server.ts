import { error, json } from '@sveltejs/kit';
import { deleteTxn } from '$lib/server/transactions.js';

export async function DELETE({ params }: { params: { id: string } }) {
  const ok = deleteTxn(Number(params.id));
  if (!ok) throw error(404, 'Not found');
  return json({ ok: true });
}
