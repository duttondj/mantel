import { runPurge } from '../src/lib/tasks/purge.ts';

/*
 * PURGE JOB — physically deletes galleries+images for couples whose access
 * expired more than 30 days ago. Dry-runs by default; pass --commit to delete.
 *
 * The same logic runs automatically at 3am daily via src/instrumentation.ts.
 * Use this script to trigger manually or inspect what would be deleted.
 */
const commit = process.argv.includes('--commit');
runPurge(commit).then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
