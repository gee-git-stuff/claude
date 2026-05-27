import { json } from '@sveltejs/kit';
import { listActions, peekRedo, peekUndo } from '$lib/server/actions.js';

export async function GET() {
  return json({
    history: listActions(200),
    canUndo: peekUndo() != null,
    canRedo: peekRedo() != null
  });
}
