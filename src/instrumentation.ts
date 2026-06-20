export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { default: cron } = await import('node-cron');
  const { runPurge } = await import('@/lib/tasks/purge');
  const { runRemind } = await import('@/lib/tasks/remind');
  const { runAutoClose } = await import('@/lib/tasks/auto-close');

  // 2:00 AM daily — close galleries idle for AUTO_CLOSE_DAYS (default 14)
  cron.schedule('0 2 * * *', () => {
    runAutoClose().catch((e) => console.error('[cron] auto-close failed:', e));
  });

  // 3:00 AM daily — delete data for accounts past the 30-day grace period
  cron.schedule('0 3 * * *', () => {
    runPurge(true).catch((e) => console.error('[cron] purge failed:', e));
  });

  // 9:00 AM daily — send expiry reminder emails at 30d and 7d windows
  cron.schedule('0 9 * * *', () => {
    runRemind().catch((e) => console.error('[cron] remind failed:', e));
  });

  console.log('[cron] Scheduled: auto-close at 02:00, purge at 03:00, reminders at 09:00');
}
