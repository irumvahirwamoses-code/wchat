# Wchat Authentication

Two-step registration with a real one-time code (OTP) delivered by **email
(Brevo)** or **SMS**, plus login by email, phone number or username.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/channels` | Which channels are deliverable + dev mode + code TTL |
| `GET` | `/api/auth/usernames?firstName=&lastName=` | Available username suggestions from a name |
| `POST` | `/api/auth/register` | **Step 1** — validate everything, send the code (202) |
| `POST` | `/api/auth/register/verify` | **Step 2** — confirm the code, create the account, return a JWT |
| `POST` | `/api/auth/register/resend` | Send a fresh code (60s cooldown) |
| `POST` | `/api/auth/login` | `{ identifier, password }` — identifier is email, phone or username |
| `GET` | `/api/auth/me` | Current user (Bearer token) |
| `GET` | `/api/users/check-username/:username` | Live availability check (leading `@`/`#` tolerated) |
| `PUT` | `/api/users/profile` | Update profile (name, handle, gender, bio, email, phone, DOB, country, photo) |

## Registration flow

1. **About you** — first name, last name, username (suggestions + live
   availability), **gender** (used to pick the default avatar), **date of birth**
   (age-gated: 13+).
2. **Account** — email, phone number (with a **country dial-code dropdown**),
   country, password + confirmation. No photo upload here: the system assigns a
   gender-matched DiceBear avatar automatically.
3. **Verify** — choose **email** or **SMS**, receive the 6-digit code, enter it.
   Only then is the account created and the user signed in and sent to the
   dashboard.

Security details:

- The code is stored as a SHA-256 **hash** only, expires after
  `VERIFY_CODE_TTL_MINUTES` (default 10) and is auto-deleted by a TTL index.
- Max 5 wrong attempts per code; 60-second resend cooldown per destination.
- Uniqueness of username / email / phone is re-checked when the code is confirmed.
- The pending record holds the **bcrypt hash** of the password, never the plain
  password, and the user document is only created after verification.

## Environment variables (`server/.env`)

```
APP_NAME=Wchat

# Email via Brevo — https://app.brevo.com/settings/keys/api
BREVO_API_KEY=xkeysib-...
MAIL_FROM_EMAIL=no-reply@yourdomain.com
MAIL_FROM_NAME=Wchat

# SMS via any HTTP gateway (Africa's Talking, Pindo, Twilio, ...)
SMS_API_URL=https://gateway.example.com/send
SMS_API_KEY=...
SMS_SENDER=Wchat

VERIFY_CODE_TTL_MINUTES=10
```

**Development:** leave `BREVO_API_KEY` and the SMS variables empty. The code is
printed to the **server console** and returned to the client as `devCode` (shown
in a toast) so the whole flow is testable without any provider. In production
(`NODE_ENV=production`) channels that are not configured are disabled in the UI.

### Brevo notes

- Create a transactional API key in Brevo and verify your sender domain/address.
- The server calls `POST https://api.brevo.com/v3/smtp/email` directly with
  `fetch` (no extra dependency) using a branded Wchat HTML template
  (`server/services/mailer.js`).
- The SMS service (`server/services/sms.js`) posts `{ to, message, sender }` as
  JSON to `SMS_API_URL` with a bearer token — the common shape for African
  gateways.

## Existing users

`npm run seed` in `server/` also **migrates legacy usernames** that still carry
the old `#` prefix and creates the demo accounts:

| Handle | Email | Password |
|---|---|---|
| `@keza` | `keza@wchat.rw` | `Keza1234` |
| `@eric` | `eric@wchat.rw` | `Eric1234` |
