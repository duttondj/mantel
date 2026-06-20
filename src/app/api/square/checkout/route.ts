import { NextRequest, NextResponse } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { nanoid } from 'nanoid';
import { auth } from '@/lib/auth';

const APP_URL = process.env.APP_URL ?? 'http://localhost:13000';
const PRICE_CENTS = parseInt(process.env.SQUARE_PRICE_CENTS ?? '2000', 10);

function squareClient() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const env = process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set');
  return new SquareClient({ token, environment: env });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) return NextResponse.json({ error: 'Payments not configured.' }, { status: 503 });

  const client = squareClient();

  const res = await client.checkout.paymentLinks.create({
    idempotencyKey: nanoid(),
    order: {
      locationId,
      referenceId: session.user.id,
      lineItems: [
        {
          name: 'Mantel — 1 year of event hosting',
          quantity: '1',
          basePriceMoney: {
            amount: BigInt(PRICE_CENTS),
            currency: 'USD',
          },
        },
      ],
    },
    checkoutOptions: {
      redirectUrl: `${APP_URL}/dashboard?payment=success`,
    },
    // paymentNote is copied onto the Payment object — used as fallback
    // to identify the user if order.referenceId isn't preserved.
    paymentNote: session.user.id,
  });

  const url = res.paymentLink?.url;
  if (!url) {
    console.error('[square] no URL in payment link response:', res);
    return NextResponse.json({ error: 'Could not create checkout session.' }, { status: 500 });
  }

  return NextResponse.json({ url });
}
