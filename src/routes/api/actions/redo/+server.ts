import { json } from '@sveltejs/kit';
import { redo } from '$lib/server/undo.js';

export async function POST() {
  return json(redo());
}
