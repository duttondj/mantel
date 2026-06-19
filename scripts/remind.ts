import { runRemind } from '../src/lib/tasks/remind.ts';

/*
 * REMINDER JOB — sends expiry warning emails to hosts whose galleries expire
 * within 30 days (first email) or 7 days (second email).
 *
 * The same logic runs automatically at 9am daily via src/instrumentation.ts.
 * Use this script to trigger manually or inspect who would be emailed.
 */
runRemind().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
