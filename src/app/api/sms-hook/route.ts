import { Webhook } from 'standardwebhooks';

/**
 * Supabase "Send SMS" auth hook.
 * Supabase calls this endpoint instead of its built-in SMS providers, so OTPs can go
 * through a Bangladeshi gateway with reliable local delivery.
 *
 * Setup: Supabase Dashboard > Authentication > Hooks > Send SMS > HTTPS,
 * URL = https://<your-domain>/api/sms-hook, then copy the generated secret into
 * SEND_SMS_HOOK_SECRET.
 */

type HookPayload = { user: { phone: string }; sms: { otp: string } };

function fail(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status });
}

export async function POST(req: Request) {
  const secret = process.env.SEND_SMS_HOOK_SECRET;
  if (!secret) return fail(500, 'hook_not_configured');

  const raw = await req.text();
  let payload: HookPayload;
  try {
    payload = new Webhook(secret.replace('v1,whsec_', '')).verify(
      raw,
      Object.fromEntries(req.headers),
    ) as HookPayload;
  } catch {
    return fail(401, 'invalid_signature');
  }

  const to = payload.user.phone.replace(/\D/g, ''); // 8801XXXXXXXXX
  const message = `${payload.sms.otp} is your Admission Ventures verification code. Do not share it.`;

  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') return fail(500, 'sms_not_configured');
    console.log(`[sms-hook:dev] OTP for +${to}: ${payload.sms.otp}`);
    return Response.json({});
  }

  try {
    // Alpha SMS (sms.net.bd). Verify field names against your gateway's current docs;
    // swap this block to use SSL Wireless or another provider.
    const res = await fetch('https://api.sms.net.bd/sendsms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ api_key: apiKey, msg: message, to }),
    });
    const body = (await res.json().catch(() => null)) as { error?: number } | null;
    if (!res.ok || (body && body.error !== undefined && body.error !== 0)) {
      return fail(502, 'sms_gateway_error');
    }
  } catch {
    return fail(502, 'sms_gateway_unreachable');
  }

  return Response.json({});
}
