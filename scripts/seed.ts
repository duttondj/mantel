import { db } from '../src/db/index.ts';
import { promoCodes } from '../src/db/schema.ts';

/*
 * Seeds a couple of promo codes so you can test redemption immediately.
 *   ***REMOVED***  — comped, 365 days, 25 uses
 *   ***REMOVED***     — comped, 365 days, unlimited
 */
async function main() {
  await db
    .insert(promoCodes)
    .values([
      { code: '***REMOVED***', grantsPlan: 'comped', durationDays: 365, maxUses: 25 },
      { code: '***REMOVED***', grantsPlan: 'comped', durationDays: 365, maxUses: null },
    ])
    .onConflictDoNothing();
  console.log('Seeded promo codes: ***REMOVED***, ***REMOVED***');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
