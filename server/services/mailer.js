/**
 * Transactional email via Brevo (https://www.brevo.com).
 *
 * We call the Brevo REST API directly with the built-in fetch so the server
 * needs no extra dependency. Configure it with:
 *
 *   BREVO_API_KEY=xkeysib-...
 *   MAIL_FROM_EMAIL=no-reply@yourdomain.com
 *   MAIL_FROM_NAME=Wchat
 *
 * When BREVO_API_KEY is missing (local development) the code is printed to the
 * server console instead, so the registration flow stays fully testable.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export const isEmailConfigured = () => Boolean(process.env.BREVO_API_KEY);

const brandColor = '#245BFF';
const inkColor = '#24145B';

const verificationEmailHtml = ({ name, code, minutes }) => `
  <div style="background:#F3F5FA;padding:32px 16px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(36,20,91,.08)">
      <div style="background:linear-gradient(135deg,${brandColor},${inkColor});padding:28px 28px 24px">
        <div style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-.5px">Wchat</div>
        <div style="color:rgba(255,255,255,.82);font-size:13px;margin-top:4px">
          Your communities, your circles.
        </div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 8px;color:${inkColor};font-size:16px;font-weight:600">
          Hi ${name || 'there'},
        </p>
        <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6">
          Use the code below to confirm your account. It expires in ${minutes} minutes.
        </p>
        <div style="letter-spacing:10px;font-size:34px;font-weight:800;color:${brandColor};
                    background:#F3F5FA;border-radius:14px;padding:18px;text-align:center">
          ${code}
        </div>
        <p style="margin:20px 0 0;color:#6b7280;font-size:12px;line-height:1.6">
          If you didn't request this, you can safely ignore this email — nobody can create an
          account on your email without this code.
        </p>
      </div>
      <div style="padding:16px 28px;background:#F3F5FA;color:#9ca3af;font-size:11px">
        Wchat · Kigali, Rwanda
      </div>
    </div>
  </div>
`;

/**
 * Send a verification code by email.
 * @returns {Promise<{delivered: boolean, reason?: string}>}
 */
export const sendVerificationEmail = async ({ to, name, code, minutes = 10 }) => {
  if (!isEmailConfigured()) {
    console.log(
      `\n[Wchat mailer:dev] Brevo not configured. Verification code for ${to} is: ${code} (expires in ${minutes} min)\n`
    );
    return { delivered: false, reason: 'not-configured' };
  }

  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        email: process.env.MAIL_FROM_EMAIL || 'no-reply@wchat.app',
        name: process.env.MAIL_FROM_NAME || 'Wchat',
      },
      to: [{ email: to, name: name || undefined }],
      subject: `${code} is your Wchat verification code`,
      htmlContent: verificationEmailHtml({ name, code, minutes }),
      textContent: `Your Wchat verification code is ${code}. It expires in ${minutes} minutes.`,
      tags: ['verification'],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo rejected the email (${response.status}): ${body.slice(0, 300)}`);
  }

  return { delivered: true };
};

export default { isEmailConfigured, sendVerificationEmail };
