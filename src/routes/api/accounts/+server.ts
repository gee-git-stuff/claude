import { json } from '@sveltejs/kit';
import { createAccount, listAccounts } from '$lib/server/accounts.js';
import type { AccountType } from '$lib/types.js';

export async function GET() {
  return json({ accounts: listAccounts() });
}

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const account = createAccount({
    name: String(body.name ?? '').trim() || 'Untitled',
    type: (body.type as AccountType) ?? 'CHECKING',
    balance_cents: Number(body.balance_cents ?? 0),
    notes: String(body.notes ?? '')
  });
  return json({ account }, { status: 201 });
}
