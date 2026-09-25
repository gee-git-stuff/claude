import { error, json } from '@sveltejs/kit';
import { backupNow, listBackups } from '$lib/server/backups.js';

export async function GET() {
  return json({ backups: listBackups() });
}

export async function POST() {
  try {
    const result = backupNow('manual');
    if (!result) throw error(400, 'Nothing to back up yet (DB is empty or missing).');
    return json({ backup: result });
  } catch (e) {
    if (e instanceof Error) throw error(500, e.message);
    throw error(500, 'Backup failed');
  }
}
