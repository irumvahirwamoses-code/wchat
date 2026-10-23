/**
 * SMS delivery for phone-number verification.
 *
 * Any HTTP SMS gateway can be plugged in with two environment variables:
 *
 *   SMS_API_URL=https://gateway.example.com/send
 *   SMS_API_KEY=your-key
 *   SMS_SENDER=Wchat            # optional sender id / from number
 *
 * The gateway is expected to accept `POST { to, message, sender }` as JSON.
 * Popular Rwandan/local options (e.g. Africa's Talking, Twilio, Pindo, Bulk
 * SMS) all expose such an endpoint; when the variables are missing we fall back
 * to logging the code in development so the flow is testable end-to-end.
 */

export const isSmsConfigured = () => Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY);

/**
 * @returns {Promise<{delivered: boolean, reason?: string}>}
 */
export const sendVerificationSms = async ({ to, code, minutes = 10 }) => {
  const message = `Your Wchat verification code is ${code}. It expires in ${minutes} minutes.`;

  if (!isSmsConfigured()) {
    console.log(
      `\n[Wchat sms:dev] SMS gateway not configured. Verification code for ${to} is: ${code} (expires in ${minutes} min)\n`
    );
    return { delivered: false, reason: 'not-configured' };
  }

  const response = await fetch(process.env.SMS_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.SMS_API_KEY ? { authorization: `Bearer ${process.env.SMS_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      to,
      message,
      sender: process.env.SMS_SENDER || 'Wchat',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`SMS gateway rejected the message (${response.status}): ${body.slice(0, 300)}`);
  }

  return { delivered: true };
};

export default { isSmsConfigured, sendVerificationSms };
