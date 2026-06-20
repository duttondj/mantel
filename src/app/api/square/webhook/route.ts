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

  if (!signatureKey) {
    console.error('[square] SQUARE_WEBHOOK_SECRET is not set — rejecting webhook to prevent forged payment events');
    return new NextResponse('Forbidden', { status: 403 });
  }
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

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }

  if (event.type !== 'payment.updated') {
    return new NextResponse('OK', { status: 200 });
  }

  const payment = (event as { data?: { object?: { payment?: { status?: string; orderId?: string; note?: string } } } })
    .data?.object?.payment;

  if (payment?.status !== 'COMPLETED') {
    return new NextResponse('OK', { status: 200 });
  }

  try {
    const client = squareClient();
    let userId: string | null | undefined = payment.note ?? undefined;

    // paymentNote is the primary lookup; order.referenceId is the fallback
    if (!userId && payment.orderId) {
      const orderRes = await client.orders.get({ orderId: payment.orderId });
      userId = orderRes.order?.referenceId;
    }

    if (!userId) {
      console.error('[square] could not resolve userId for payment', payment.orderId);
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
