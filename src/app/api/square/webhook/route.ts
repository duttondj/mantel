import { NextRequest, NextResponse } from 'next/server';
import { SquareClient, SquareEnvironment, WebhooksHelper } from 'square';
import { grantAccess } from '@/lib/entitlements';

const APP_URL = process.env.APP_URL ?? 'http://localhost:13000';
const WEBHOOK_URL = `${APP_URL}/api/square/webhook`;

function squareClient() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const env = process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set');
  return new SquareClient({ token, environment: env });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-square-hmacsha256-signature') ?? '';
  const signatureKey = process.env.SQUARE_WEBHOOK_SECRET ?? '';

  if (signatureKey) {
    const valid = await WebhooksHelper.verifySignature({
      requestBody: body,
      signatureHeader: signature,
      signatureKey,
      notificationUrl: WEBHOOK_URL,
    });
    if (!valid) {
      console.warn('[square] webhook signature invalid');
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }

  if (event.type !== 'payment.updated') {
    return new NextResponse('OK', { status: 200 });
  }

  const payment = (event as { data?: { object?: { payment?: { status?: string; orderId?: string } } } })
    .data?.object?.payment;

  if (payment?.status !== 'COMPLETED' || !payment.orderId) {
    return new NextResponse('OK', { status: 200 });
  }

  try {
    const client = squareClient();
    const orderRes = await client.orders.get({ orderId: payment.orderId });
    const userId = orderRes.order?.referenceId;

    if (!userId) {
      console.error('[square] no referenceId on order', payment.orderId);
      return new NextResponse('OK', { status: 200 });
    }

    await grantAccess(userId, { plan: 'paid' });
    console.log(`[square] granted access to user ${userId}`);
  } catch (err) {
    console.error('[square] webhook processing error:', err);
    // Return 200 so Square doesn't retry indefinitely for non-transient errors.
    // Transient errors (DB down) should return 5xx so Square retries.
    return new NextResponse('Error', { status: 500 });
  }

  return new NextResponse('OK', { status: 200 });
}
