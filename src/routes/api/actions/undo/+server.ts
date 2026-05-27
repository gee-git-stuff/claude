import { json } from '@sveltejs/kit';
import { undo } from '$lib/server/undo.js';

export async function POST() {
  return json(undo());
}
