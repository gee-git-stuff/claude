import { json } from '@sveltejs/kit';
import { getAllSettings, setSetting } from '$lib/server/settings.js';
import { checkOllama } from '$lib/server/ai.js';

export async function GET() {
  return json({ settings: getAllSettings() });
}

export async function PUT({ request }: { request: Request }) {
  const body = await request.json() as Record<string, string>;
  for (const [k, v] of Object.entries(body)) {
    setSetting(k, String(v));
  }
  return json({ ok: true, settings: getAllSettings() });
}

export async function POST() {
  return json(await checkOllama());
}
