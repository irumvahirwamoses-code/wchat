# Wchat Improvement Plan

## 1. Project Structure Summary

**Wchat** is a MERN-stack real-time social network (MongoDB, Express, React, Node.js + Socket.IO).

### Server (`server/`)
| Entry | Purpose |
|-------|---------|
| `server.js` | Express app, CORS, helmet, Socket.IO server, HTTP + WS, error handler |
| `config/db.js` | Mongoose connection |
| `controllers/` | 12 controllers: auth, user, chat, message, post, story, note, notification, circle, circleOps, decision, access |
| `models/` | 13 Mongoose models: User, Chat, Message, Post, Comment, Story, Note, Notification, CircleItem, CircleOps, CircleDecision, JoinRequest, VerificationCode |
| `routes/` | 10 route files, all behind `protect` JWT middleware except public auth/options endpoints |
| `middleware/` | `authMiddleware.js` (JWT verify), `uploadMiddleware.js` (multer disk/Cloudinary) |
| `services/` | chatScheduler, circles, mailer (Brevo), notifications, sms |
| `utils/` | generateAvatar, generateToken, username helpers |
| `data/` | categories, circles (starter), countries, interests |
| `scripts/` | seedUsers, fixInviteCodeIndex |

### Client (`client/`)
React 19 + Vite + Tailwind CSS v4 + React Router 7 + socket.io-client + axios.
- `src/pages/` — 9 pages (Auth, Chat, Communities, Discover, HomeFeed, Onboarding, Profile, Reels)
- `src/components/` — 46 components
- `src/context/` — AuthContext, ChatContext, SocketContext
- `src/utils/` — api (axios with JWT interceptor), contentFilter, handle, theme, translate

### Key observations
- JWT is stored in `localStorage` (not httpOnly cookies) and sent as `Authorization: Bearer` plus a non-standard `token` header fallback.
- Tokens live 30 days; no refresh-token rotation.
- Password minimum length is 6; no complexity, no lockout, no password history.
- Verification codes are hashed with unsalted SHA-256 (6-digit codes are trivially crackable if the DB leaks).
- `.env` uses a placeholder `JWT_SECRET`; `atlas-WUT-credentials.env` in the repo root contains committed MongoDB credentials + a Brevo API key (gitignored but present on disk).
- Presence (`onlineUsers`, `meetings`) is in-memory; no Redis, no multi-instance scaling.
- Local disk uploads (ephemeral on Render/Koyeb) unless Cloudinary is configured.

---

## 2. Bugs

| # | Location | Bug | Impact |
|---|----------|-----|--------|
| B1 | `server/controllers/messageController.js:216` | Edit window computed from `message.updatedAt` instead of `createdAt`. Every edit resets the 15-minute window, effectively allowing indefinite editing. | Users can edit messages far beyond the intended 15-minute window. |
| B2 | `server/controllers/chatController.js:369-373` | `deleteGroup` deletes messages + join requests but leaves CircleItems, Stories, Notes, CircleDecisions, CircleOps orphaned. | Data orphaning / storage leak. |
| B3 | `server/controllers/chatController.js:335-341` | `leaveGroup` allows the admin to leave without transferring ownership; a group can be left with no admin. | Group becomes unmanageable. |
| B4 | `server/controllers/userController.js:265` | `updateProfile` reads `req.file` but the route uses `uploadMiddleware.single('profilePicture')` — works only if the field name matches; no guard if `req.file` is undefined in non-multipart requests. | Minor; profile picture update may silently skip. |
| B5 | `server/controllers/messageController.js:113` | `sendMessage` reads `req.files.file` but messageRoutes uses `uploadMiddleware.fields([{name:'file',maxCount:1}])` — produces `req.files.file[0]`. Controller handles it correctly, but the `contentType='location'` path in `startLiveLocation` bypasses `sendMessage`'s `allowedTypes` check. | Not a bug per se, but inconsistent validation. |
| B6 | `server/controllers/chatController.js:52-64` | `listChats` runs a separate `Message.findOne` per chat (N+1). | Performance degradation on large chat lists. |
| B7 | `server/controllers/postController.js:92-126` | `getFeed` runs `Chat.find` and `User.findById` after already having `req.user` — redundant queries. | Minor performance waste. |
| B8 | `server/controllers/userController.js:88-97` | `completeOnboarding` validates counts but does not verify the user actually owns the joined Circles (they could leave and re-join to inflate count). | Onboarding can be gamed. |
| B9 | `server/server.js:449` | `meeting signal` handler forwards `from: from || userId` — a spoofing vector where a socket can impersonate another peer's `from` field. | WebRTC signaling spoofing within a meeting room. |
| B10 | `server/services/chatScheduler.js:48-66` | `purgeExpiredMessages` deletes then emits per-message; if `io` is undefined, deletes happen without client notification. | Clients may not reflect vanished messages in single-host mode when io is unavailable. |

---

## 3. Security Risks

| # | Risk | Location | Severity |
|---|------|----------|----------|
| S1 | **Committed credentials** — `atlas-WUT-credentials.env` contains MongoDB username/password + Brevo API key. | Repo root | **Critical** — rotate immediately; remove from history. |
| S2 | **Weak JWT secret** — `JWT_SECRET=chattinga_dev_secret_change_in_production` in `.env`. | `server/.env` | **Critical** — brute-forceable; forge any token. |
| S3 | **No rate limiting** on `/api/auth/login`, `/api/auth/register`, `/api/auth/register/resend`. | `server/controllers/authController.js` | **High** — brute force, credential stuffing, SMS/email bombing. |
| S4 | **JWT in localStorage, 30-day expiry, no refresh rotation.** | `client/src/context/AuthContext.jsx`, `server/utils/generateToken.js` | **High** — XSS steals long-lived tokens; no revocation. |
| S5 | **User enumeration + PII exposure** — `GET /api/users?search=` searches by email and returns `email`, `phoneNumber` in results. | `server/controllers/userController.js:54-73` | **High** — enumerate phone numbers/emails of any user. |
| S6 | **Unsalted SHA-256 for 6-digit verification codes.** | `server/models/VerificationCode.js:69-70` | **High** — if DB leaks, all codes crackable instantly (10^6 space). |
| S7 | **No CSRF protection** with `credentials: true` CORS; auth token also accepted via custom `token` header. | `server/server.js:89-94`, `server/middleware/authMiddleware.js:15-17` | **Medium** — cross-site request forgery via authenticated endpoints. |
| S8 | **No password complexity / no lockout** — min 6 chars, no failed-attempt tracking. | `server/models/User.js:54-59`, `server/controllers/authController.js:442-471` | **Medium** — weak passwords, brute-force login. |
| S9 | **No `httpOnly`/`secure` cookie flags** — token in localStorage accessible to any JS. | `client/src/config/api.js:25-32` | **Medium** — XSS leads to full account takeover. |
| S10 | **File upload without content validation** — mimetype/extension filtering only; `.svg`/`.html` can be served as static assets and execute XSS in the app origin. | `server/middleware/uploadMiddleware.js`, `server/server.js:100` | **Medium** — stored XSS via uploaded HTML/SVG. |
| S11 | **No email/phone verification required at login** — `emailVerified`/`phoneVerified` set but never checked. | `server/middleware/authMiddleware.js` | **Medium** — unverified accounts can log in and act. |
| S12 | **In-memory presence/rate guard** — `lastSentAt` Map and `onlineUsers` Map reset on restart; no Redis. | `server/controllers/authController.js:70`, `server/server.js:210-211` | **Medium** — rate limits bypassable on restart; no horizontal scaling. |
| S13 | **No account deletion** endpoint — no way to erase personal data (GDPR/privacy concern). | `server/routes/userRoutes.js` | **Low** — compliance gap. |
| S14 | **`searchUsers` includes `email` and `phoneNumber` in projection.** | `server/controllers/userController.js:67` | **Low** — PII in search results. |

---

## 4. Step-by-Step Improvement Plan

### Phase 0 — Immediate containment (do first, no app changes)

1. **Rotate all exposed credentials.**
   - MongoDB Atlas user/password in `atlas-WUT-credentials.env` — create a new Atlas DB user, revoke the old one.
   - Brevo API key in `atlas-WUT-credentials.env` — regenerate in Brevo dashboard.
   - Delete `atlas-WUT-credentials.env` from disk; ensure it stays gitignored. If it was ever committed, purge from git history (`git filter-repo` or `bfg`).
   - Replace `JWT_SECRET` in `server/.env` and `.env.example` with a strong random value (`openssl rand -hex 32`).

### Phase 1 — Authentication hardening

2. **Add rate limiting** to auth endpoints (`login`, `register`, `register/resend`) using `express-rate-limit` (per-IP + per-identifier). Replace the in-memory `lastSentAt` Map with a persistent store or at least keep it in-memory but add a login failure counter.
3. **Enforce password policy** — min 8 characters, optional complexity check; add failed-login attempt tracking with temporary lockout (e.g. 5 failures → 15 min lockout).
4. **Shorten JWT expiry** (e.g. 15 min) and add refresh-token rotation stored in httpOnly, secure, sameSite cookies. Or at minimum: reduce to 7 days and add a token-revocation denylist.
5. **Require email/phone verification before login** — check `emailVerified`/`phoneVerified` in the `protect` middleware or login controller.
6. **Switch verification-code hashing to bcrypt** (salted) instead of unsalted SHA-256.

### Phase 2 — Access control & data privacy

7. **Remove `email` and `phoneNumber` from `searchUsers` projection** — return only public fields (`firstName, lastName, username, profilePicture, isOnline, lastSeen`).
8. **Add CSRF protection** (double-submit cookie or `csurf`-style) for state-changing endpoints, or rely on SameSite=strict cookies if moving to cookie-based auth.
9. **Validate uploaded file content** — use `file-type` or magic-byte inspection to confirm the file matches its claimed mimetype; serve uploads with `Content-Disposition: attachment` for non-image types; block `.html`, `.htm`, `.svg` from being served inline.
10. **Fix `listChats` N+1** — aggregate last message in a single pipeline instead of per-chat queries.
11. **Fix `editMessage` edit window** — use `createdAt` (not `updatedAt`) for the 15-minute cutoff.

### Phase 3 — Reliability & data integrity

12. **Add cascade deletes** on group deletion — remove CircleItems, Stories, Notes, CircleDecisions, CircleOps belonging to the deleted chat.
13. **Prevent admin self-removal without transfer** — `leaveGroup` must require ownership transfer if the user is the sole admin.
14. **Add graceful shutdown** — handle `SIGTERM`/`SIGINT` to close Mongoose connection and clear the chat scheduler interval.
15. **Complete the password-reset flow** — the `VerificationCode` schema supports `purpose: 'reset-password'` but no controller/route exists; implement `/api/auth/forgot-password` and `/api/auth/reset-password`.
16. **Add account deletion** endpoint (GDPR compliance).

### Phase 4 — Observability & deployment

17. **Add structured request logging** (morgan is present; consider structured JSON logging) and basic health-check dependencies (DB ping).
18. **Add Content Security Policy** via helmet (`contentSecurityPolicy` directive).
19. **Add pagination guards** — enforce `limit` max on `getMessages` and other list endpoints.
20. **Write tests** — unit tests for auth controllers, access control (`can`/`denyFor`), and middleware; integration tests for critical paths (registration, login, message send).

---

## 5. Validation Steps

After each phase:
- Run `node server.js` (server) and `npm run dev` (client) to confirm startup.
- Hit `/api/health` and `/api/auth/channels` to confirm the server responds.
- Test registration end-to-end (code sent, account created, login works).
- Test that `searchUsers` no longer returns `email`/`phoneNumber`.
- Test that a rate-limited endpoint returns 429 after repeated calls.
- Test file upload: an `.html` file should not render inline in the browser.
- Run `git status` to confirm no `.env` or credentials files are tracked.

---

## 6. Open Question (needs your approval)

The plan above is ready to implement, but you asked me to **wait for approval before editing any files**. Please confirm:

**Shall I proceed to implement the Phase 0 + Phase 1 changes (credential rotation, rate limiting, password policy, JWT expiry, verification-code hashing, search projection fix)?** Or would you like me to prioritize a different subset first?

Once you approve, I'll begin with Phase 0 (credential rotation and secret replacement) and work through the plan in order.