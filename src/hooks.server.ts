import { maybeStartupBackup } from '$lib/server/backups.js';

const initial = maybeStartupBackup();
if (initial) {
  console.log(`[backup] startup backup written: ${initial.filename}`);
}
