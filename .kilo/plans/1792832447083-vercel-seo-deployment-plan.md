# Wchat — Vercel Deployment, SEO, Google Search & Security Plan

**Plan file**: `.kilo/plans/1792832447083-vercel-seo-deployment-plan.md`
**Mode**: Plan only — no source files are edited here. An implementation-capable agent must execute the task list.

---

## 1. Goal & Constraints

- Deploy React frontend to **Vercel** (free `vercel.app` subdomain).
- Deploy Express + Socket.IO backend to a free host that supports WebSockets (Koyeb recommended; Render free tier does **not** support WebSockets reliably — Socket.IO will fall back to long polling).
- Database: **MongoDB Atlas** M0 (already referenced in `atlas-WUT-credentials.env` — credentials must be rotated).
- Add SEO (titles, meta, Open Graph, canonical, mobile-friendly), `robots.txt`, `sitemap.xml`, Search Console prep.
- Harden security: secrets out of frontend, protect private pages/APIs, prevent private data indexing.
- Preserve all existing features; do not break current functionality.
- Never claim deployment or indexing succeeded unless verified.

**Free-only**: No paid services. Vercel (frontend), Koyeb/Render (backend), MongoDB Atlas M0 (DB), free developer domain or `vercel.app` subdomain.

---

## 2. Architecture Decision

| Layer | Host | Why |
|-------|------|-----|
| Frontend (React SPA) | **Vercel** | Static build (`dist/`), free tier, `vercel.app` domain, `vercel.json` already exists |
| Backend (Express + Socket.IO) | **Koyeb** (or Render) | Koyeb free tier supports WebSockets; Render free tier does not (polling fallback only) |
| Database | **MongoDB Atlas M0** | Free tier, already referenced in docs |
| Media uploads | Local disk (dev) / Cloudinary (prod, optional) | Ephemeral on serverless hosts — Cloudinary required for permanent media |

**Traffic flow**: `https://wchat.vercel.app` → browser → `https://wchat-api.koyeb.app` (or Render URL) for `/api/*` and Socket.IO handshake.

**Critical constraint**: Socket.IO on Vercel serverless functions will NOT work (no persistent connections). Backend must be a persistent server host.

---

## 3. Security Findings (from codebase inspection) — must fix before deploy

| # | Risk | Location | Severity |
|---|------|----------|----------|
| S1 | **Committed credentials** — `atlas-WUT-credentials.env` contains MongoDB user/pass + Brevo API key on disk | repo root | **Critical** — rotate immediately, delete file, purge from git history if ever committed |
| S2 | **Weak JWT secret** — `JWT_SECRET=chattinga_dev_secret_change_in_production` | `server/.env` | **Critical** — forgeable tokens |
| S3 | **No rate limiting** on `/api/auth/login`, `/register`, `/register/resend` | `server/controllers/authController.js` | **High** — brute force / SMS bombing |
| S4 | **JWT in localStorage, 30-day expiry, no refresh rotation** | `client/src/context/AuthContext.jsx`, `server/utils/generateToken.js` | **High** — XSS = account takeover |
| S5 | **User enumeration + PII exposure** — `GET /api/users?search=` returns `email`, `phoneNumber` | `server/controllers/userController.js:67` | **High** — enumerate any user's email/phone |
| S6 | **Unsalted SHA-256** for 6-digit verification codes | `server/models/VerificationCode.js:69-70` | **High** — crackable if DB leaks |
| S7 | **No CSRF protection** with `credentials: true` CORS; token accepted via custom `token` header | `server/server.js`, `server/middleware/authMiddleware.js` | **Medium** |
| S8 | **File upload mimetype-only validation** — `.svg`/`.html` can be served inline = stored XSS | `server/middleware/uploadMiddleware.js`, `server/server.js:100` | **Medium** |
| S9 | **No email/phone verification required at login** | `server/middleware/authMiddleware.js` | **Medium** |

---

## 4. Task List (ordered)

### Phase SEO — Search Engine Optimization (implement these exactly)

**SEO-1**: Add `react-helmet-async` dependency.
- File: `client/package.json`
- Change: Add `"react-helmet-async": "^2.0.4"` to `dependencies`.

**SEO-2**: Create Helmet provider wrapper.
- File: `client/src/components/HelmetProvider.jsx` (new)
- Content: Export `HelmetProvider` from `react-helmet-async` wrapped as a component that accepts `children`. Re-export `useHelmet`, `Helmet`, `HelmetProvider`.

**SEO-3**: Wrap app with HelmetProvider.
- File: `client/src/App.jsx`
- Change: Import `HelmetProvider` from `./components/HelmetProvider.jsx`. Wrap `AppRoutes` inside `<HelmetProvider>` (outermost, above `AuthProvider`).

**SEO-4**: Base head tags in `index.html`.
- File: `client/index.html`
- Change: Keep existing `<title>`, `<meta name="description">`, viewport, theme-color. Add:
  ```html
  <meta property="og:title" content="Wchat — Where chats become communities" />
  <meta property="og:description" content="Mobile-first group-based social network. Real-time chat, Circles, Loops, Reels and stories built for communities." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://wchat.vercel.app" />
  <meta property="og:image" content="https://wchat.vercel.app/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Wchat — Where chats become communities" />
  <meta name="twitter:description" content="Mobile-first group-based social network. Real-time chat, Circles, Loops, Reels and stories built for communities." />
  <link rel="canonical" href="https://wchat.vercel.app" />
  ```
  Replace `https://wchat.vercel.app` with the actual deployed domain. Add placeholder for Search Console verification meta tag:
  ```html
  <meta name="google-site-verification" content="REPLACE_WITH_ACTUAL_TOKEN" />
  ```

**SEO-5**: Per-page dynamic titles and meta tags.
Use `useHelmet()` in each page component. Set `document.title` + helmet tags on mount.
- `client/src/pages/AuthPage.jsx`: title `Create Account | Wchat`, description `Join Wchat — real-time chat, Circles and communities. Sign up with email, phone or username.`
- `client/src/pages/HomeFeed.jsx`: title `Home Feed | Wchat`, description `Your Circles' posts, Loops and stories — real-time social feed from your communities.`
- `client/src/pages/ProfilePage.jsx`: title `Profile | Wchat`, description `Public profile — posts, interests and community stats.`
- `client/src/pages/ReelsFeed.jsx`: title `Reels | Wchat`, description `Short videos from your Circles and the communities you follow.`
- `client/src/pages/DiscoverPage.jsx`: title `Discover | Wchat`, description `Explore public Circles, people and trending content near you.`
- `client/src/pages/CommunitiesPage.jsx`: title `Circles | Wchat`, description `Join and discover Circles — communities built around shared interests.`
- `client/src/pages/ChatPage.jsx`: title `Messages | Wchat`, description `Real-time 1-on-1 and group messaging with your Circles.`
- `client/src/pages/JoinCirclePage.jsx`: title `Join Circle | Wchat`, description `Join a Circle using an invite code.`
- `client/src/pages/OnboardingPage.jsx`: title `Onboarding | Wchat`, description `Complete your Wchat onboarding — pick interests and join Circles.`

Implementation pattern per page:
```jsx
import { useHelmet } from 'react-helmet-async'
useEffect(() => {
  document.title = 'Profile | Wchat'
}, [])
useHelmet({
  title: 'Profile | Wchat',
  meta: [
    { name: 'description', content: 'Public profile — posts, interests and community stats.' },
    { property: 'og:title', content: 'Profile | Wchat' },
    { property: 'og:description', content: 'Public profile — posts, interests and community stats.' },
    { property: 'og:type', content: 'website' },
  ],
  link: [{ rel: 'canonical', href: 'https://wchat.vercel.app/profile' }],
})
```

**SEO-6**: Create `robots.txt`.
- File: `client/public/robots.txt` (new)
- Content:
  ```
  User-agent: *
  Allow: /
  Allow: /auth
  Disallow: /api/
  Disallow: /uploads/
  Disallow: /chat/
  Disallow: /profile/
  Disallow: /onboarding/
  Disallow: /communities/
  Disallow: /discover/
  Disallow: /reels/
  Sitemap: https://wchat.vercel.app/sitemap.xml
  ```

**SEO-7**: Create `sitemap.xml`.
- File: `client/public/sitemap.xml` (new)
- Content (public pages only — the app is mostly behind auth):
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://wchat.vercel.app/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
    <url><loc>https://wchat.vercel.app/auth</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  </urlset>
  ```

**SEO-8**: Verify public files are copied to `dist/`.
- Vite copies `public/` to `dist/` root automatically. Confirm `dist/robots.txt` and `dist/sitemap.xml` exist after `npm run build`.

**SEO-9**: Mobile-friendly optimizations (already present — verify).
- `client/index.html` already has `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` and `lang="en"`. Keep as-is.

**SEO-10**: Validation.
- `npm run build` in `client/` completes with zero errors.
- `dist/` contains `index.html`, `robots.txt`, `sitemap.xml`.
- Rendered HTML contains Open Graph tags, Twitter cards, canonical link.
- `https://<vercel-domain>/robots.txt` returns 200.
- `https://<vercel-domain>/sitemap.xml` returns valid XML.
- Private routes (`/chat`, `/profile`, etc.) are NOT in sitemap and disallowed in robots.txt.

### Phase A — Security containment (no feature breakage)

1. Rotate MongoDB Atlas credentials (new DB user, revoke old). Rotate Brevo API key. Delete `atlas-WUT-credentials.env` from disk; keep gitignored.
2. Replace `JWT_SECRET` in `server/.env` and `server/.env.example` with `openssl rand -hex 32`.
3. Add `express-rate-limit` to auth routes (`/api/auth/login`, `/register`, `/register/resend`) — per-IP + per-identifier.
4. Enforce password min 8 chars + failed-attempt lockout (5 failures → 15 min).
5. Reduce JWT expiry from 30d to 7d; add token revocation denylist (in-memory acceptable for v1, Redis later).
6. Require `emailVerified`/`phoneVerified` before allowing login (check in `protect` middleware).
7. Switch verification-code hashing from unsalted SHA-256 to bcrypt.
8. Strip `email` and `phoneNumber` from `searchUsers` projection — return public fields only.
9. Add CSRF protection (double-submit cookie) for state-changing endpoints.
10. Validate uploaded file content (magic bytes via `file-type`); serve non-image uploads with `Content-Disposition: attachment`; block `.html`/`.htm`/`.svg` inline serving.

### Phase B — Vercel frontend + backend hosting prep
11. Update `client/vercel.json`: ensure `buildCommand`, `outputDirectory: "dist"`, SPA rewrite to `/index.html`, add `headers` for CSP + `X-Content-Type-Options`.
12. Set `VITE_API_URL` in Vercel project settings → `https://<backend-host>.koyeb.app` (no trailing slash).
13. Update `server/server.js` CORS `CLIENT_URL` to accept the Vercel domain (comma-separated, supports `*` for preview deploys).
14. Add `server.set('trust proxy', 1)` (already present — keep).
15. Add graceful shutdown (`SIGTERM`/`SIGINT`) to close Mongoose + clear chat scheduler interval.
16. Add `helmet.contentSecurityPolicy` with reasonable defaults (allow self + fonts.googleapis.com).
17. Add `/api/health` DB ping dependency check.

### Phase C — Google Search preparation
23. Create `client/public/robots.txt`: allow `/` and `/auth`, disallow `/api/*`, `/uploads/*`, and all private routes.
24. Generate `client/public/sitemap.xml`: include public pages only (`/`, `/auth`). Note: the app is almost entirely behind auth, so sitemap will be minimal.
25. Add Search Console verification meta tag to `client/index.html` (placeholder — user inserts actual token after adding property).
26. Document manual steps: add property in Search Console, verify via meta tag, submit sitemap URL.

### Phase D — Build, test, validate
27. Run `cd client && npm run build` — confirm no errors, `dist/` generated.
28. Run `cd server && node server.js` (with prod-like `.env`) — confirm startup, `/api/health` responds.
29. Test registration/login end-to-end against local backend.
30. Verify `robots.txt` and `sitemap.xml` are copied into `dist/` (Vite copies `public/` to dist root).
31. Run `git status` to confirm no `.env` or credentials files are tracked.

### Phase E — Deployment & domain (user-executed, documented)
32. Push code to GitHub.
33. Connect GitHub repo to Vercel → import client project → set build command/output dir → add `VITE_API_URL` env var → deploy.
34. Deploy backend to Koyeb (or Render) → set env vars (`MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `PORT`, `VERIFY_CODE_TTL_MINUTES`, optional Cloudinary/Brevo/SMS).
35. Update frontend `VITE_API_URL` to the live backend URL; redeploy on Vercel.
36. (Optional) Connect free developer domain (is-a.dev, eu.org, DuckDNS) in Vercel project settings.
37. Add site to Google Search Console → verify via meta tag → submit `https://<domain>/sitemap.xml`.

---

## 5. Files to Create

| Path | Purpose |
|------|---------|
| `client/public/robots.txt` | Search engine crawling rules |
| `client/public/sitemap.xml` | Public page index for Google |
| `client/src/components/HelmetProvider.jsx` | React Helmet async provider wrapper |
| `.kilo/plans/1792832447083-vercel-seo-deployment-plan.md` | This plan |

---

## 6. Files to Modify

| Path | Change |
|------|--------|
| `server/.env` | Rotate `JWT_SECRET`; document all required prod vars |
| `server/.env.example` | Rotate example `JWT_SECRET`; document prod vars |
| `server/server.js` | Add CSP helmet, graceful shutdown, health DB ping, CORS origin for Vercel domain |
| `server/controllers/authController.js` | Add rate limiting, password policy, lockout, verification-required check |
| `server/middleware/authMiddleware.js` | Check `emailVerified`/`phoneVerified` |
| `server/models/VerificationCode.js` | bcrypt instead of SHA-256 for codeHash |
| `server/controllers/userController.js` | Strip `email`/`phoneNumber` from `searchUsers` projection |
| `server/middleware/uploadMiddleware.js` | Magic-byte file validation, block dangerous extensions inline |
| `server/utils/generateToken.js` | Reduce expiry to `7d` |
| `client/vercel.json` | Add security headers (CSP, X-Content-Type-Options) |
| `client/index.html` | Add Open Graph, Twitter cards, canonical placeholder, Search Console meta placeholder |
| `client/package.json` | Add `react-helmet-async` dependency |
| `client/src/App.jsx` | Wrap `AppRoutes` in `<HelmetProvider>` |
| `client/src/pages/*.jsx` | Add per-page `document.title` + helmet meta (AuthPage, HomeFeed, ProfilePage, ReelsFeed, DiscoverPage, CommunitiesPage, ChatPage, JoinCirclePage, OnboardingPage) |

---

## 7. Environment Variables

**Server (`.env` + host dashboard):**
```
PORT=5000
MONGO_URI=<Atlas connection string>
JWT_SECRET=<openssl rand -hex 32>
CLIENT_URL=https://wchat.vercel.app,https://www.wchat.app
VERIFY_CODE_TTL_MINUTES=10
BREVO_API_KEY=...
MAIL_FROM_EMAIL=...
SMS_API_URL=...
SMS_API_KEY=...
CLOUDINARY_* (optional)
NODE_ENV=production
```

**Client (Vercel project settings):**
```
VITE_API_URL=https://<backend>.koyeb.app
```

---

## 8. Deployment Steps (documented for user execution)

1. **Push to GitHub** — ensure `.env`, `.env.*`, `atlas-WUT-credentials.env`, `node_modules/`, `dist/` are gitignored (already are).
2. **Vercel**: Add project → import `client/` directory → Framework: Vite → Build command: `npm run build` → Output directory: `dist` → Add env var `VITE_API_URL` → Deploy.
3. **Backend (Koyeb/Render)**: Deploy `server/` → Set all server env vars → Get public URL.
4. **Wire frontend to backend**: Update `VITE_API_URL` in Vercel to the backend URL → Redeploy.
5. **Custom domain (optional)**: In Vercel project settings → Domains → add free domain (is-a.dev / eu.org / DuckDNS) → configure DNS.
6. **Google Search Console**: Add property (URL prefix) → verify via HTML meta tag → submit `https://<domain>/sitemap.xml`.

---

## 9. Validation Steps (implementation agent must perform)

- [ ] `npm run build` in `client/` completes with zero errors; `dist/` contains `index.html`, `robots.txt`, `sitemap.xml`.
- [ ] `node server.js` starts; `GET /api/health` returns `{ status: "ok" }`.
- [ ] Registration → verification code → login works end-to-end against local backend.
- [ ] `GET /api/users?search=test` does NOT return `email` or `phoneNumber`.
- [ ] Repeated login failures trigger rate-limit 429.
- [ ] Uploading an `.html` file is rejected or served as attachment (not inline).
- [ ] `git status` shows no `.env` or credentials files tracked.
- [ ] `robots.txt` accessible at `https://<vercel-domain>/robots.txt`.
- [ ] `sitemap.xml` accessible at `https://<vercel-domain>/sitemap.xml`.
- [ ] Open Graph tags present in rendered HTML (check via view-source on deployed preview).

---

## 10. Open Questions / Assumptions

1. **Backend host**: Assuming Koyeb (WebSocket-friendly free tier). If user prefers Render, Socket.IO falls back to long polling on the free tier — real-time chat still works but with higher latency. *Recommended: Koyeb.*
2. **Domain**: Assuming `wchat.vercel.app` free subdomain unless user provides a custom free domain (is-a.dev, eu.org, DuckDNS).
3. **MongoDB Atlas**: Assuming user already has an Atlas cluster; credentials in `atlas-WUT-credentials.env` need rotation regardless.
4. **Search Console verification token**: Not yet available — user must add property first, then insert the verification meta tag into `client/index.html`.
5. **Sitemap scope**: Since nearly all app pages require authentication, the sitemap will only contain `/` and `/auth` (public). This is expected and correct — private user data must not be indexed.

---

**Status**: Plan is implementation-ready. No source files have been modified. An implementation-capable agent should execute Phase A through Phase E, then hand Phase F (user-executed deployment steps) back to the user.