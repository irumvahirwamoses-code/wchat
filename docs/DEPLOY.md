# Deploying Wchat for free

This guide takes Wchat from your laptop to a public HTTPS URL **without paying
anything** and **without a credit card**. Every part has a free tier.

There are two shapes you can deploy. Pick one:

| | Separate hosts (recommended) | Single host (simplest) |
|---|---|---|
| Client | Vercel or Netlify (static) | Render (served by Express) |
| API + Socket.IO | Render or Koyeb | same Render service |
| Database | MongoDB Atlas M0 | MongoDB Atlas M0 |
| Uploads | Cloudinary | Cloudinary |
| CORS setup | yes (`CLIENT_URL`, `VITE_API_URL`) | none |
| Free cold starts | client is instant; API may sleep | whole app sleeps |

---

## 0. Before you start

You need:

- a **GitHub account** (all free hosts deploy from GitHub),
- the project pushed to a GitHub repository,
- a **MongoDB Atlas** account (free),
- a **Cloudinary** account (free, for uploads).

Push the project:

```bash
git add .
git commit -m "Wchat"
git push origin main
```

---

## 1. Database â€” MongoDB Atlas (free forever tier)

1. Go to <https://www.mongodb.com/cloud/atlas/register> and create an account.
2. **Create a project** â†’ **Build a database** â†’ choose **M0 Free**.
3. Pick the region closest to your API host (e.g. `Frankfurt` or `Virginia`).
4. **Database Access** â†’ *Add New Database User*:
   - Authentication: **Password**
   - Username: `wchat`
   - Password: generate one and **save it**
   - Role: **Read and write to any database**
5. **Network Access** â†’ *Add IP Address* â†’ **Allow access from anywhere**
   (`0.0.0.0/0`).
   > Render's free tier has no fixed outgoing IP, so the database must accept
   > connections from anywhere. The password is what protects it â€” use a long
   > random one.
6. **Database** â†’ *Connect* â†’ *Drivers* â†’ copy the connection string:

   ```
   mongodb+srv://wchat:<password>@cluster0.xxxxx.mongodb.net/wchat?retryWrites=true&w=majority
   ```

   Replace `<password>` with the real password and keep the database name
   `wchat` at the end (or choose another name â€” just keep it consistent).

7. Optional: load the demo data into Atlas from your machine:

   ```powershell
   cd server
   $env:MONGO_URI="mongodb+srv://wchat:PASSWORD@cluster0.xxxxx.mongodb.net/wchat?retryWrites=true&w=majority"
   npm run seed
   ```

   On macOS/Linux use `MONGO_URI="..." npm run seed` instead.

---

## 2. Uploads â€” Cloudinary (free tier)

Free hosts (Render, Koyeb, Fly.io) use an **ephemeral filesystem**: files saved
to `server/uploads` are deleted on every deploy or restart. Wchat already
supports Cloudinary out of the box â€” it switches automatically when the three
credentials are present.

1. Sign up at <https://cloudinary.com/users/register_free>.
2. Open the **Console/Dashboard** â†’ **Product Environment Credentials**.
3. Copy:
   - **Cloud name** â†’ `CLOUDINARY_CLOUD_NAME`
   - **API key** â†’ `CLOUDINARY_API_KEY`
   - **API secret** â†’ `CLOUDINARY_API_SECRET`
4. Add them as environment variables on your API host (step 3 or 4 below).
5. `CLOUDINARY_FOLDER` is optional (defaults to `wchat`).

Without these variables Wchat still works, but new uploads live on the
ephemeral disk and will disappear after a redeploy.

Cloudinary's free plan changes occasionally; check the current limits on their
pricing page. 25 MB per file is the limit Wchat enforces.

---

## 3. API + Socket.IO â€” Render free web service

Render supports **WebSockets** on its free plan, which Socket.IO needs.

1. Sign up at <https://render.com> with GitHub.
2. **New +** â†’ **Web Service** â†’ connect your repository.
3. Fill in:

   | Field | Value |
   |---|---|
   | Name | `wchat-api` |
   | Region | closest to you |
   | Branch | `main` |
   | **Root Directory** | `server` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
   | Health Check Path | `/api/health` |

4. **Environment Variables** â†’ add:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | your Atlas connection string |
   | `JWT_SECRET` | long random string (see below) |
   | `CLIENT_URL` | `https://your-client.vercel.app` (comma-separate more later) |
   | `CLOUDINARY_CLOUD_NAME` | from Cloudinary |
   | `CLOUDINARY_API_KEY` | from Cloudinary |
   | `CLOUDINARY_API_SECRET` | from Cloudinary |
   | `APP_NAME` | `Wchat` |

   Generate a strong JWT secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Do **not** set `PORT` â€” Render injects it automatically.

5. **Create Web Service**. Wait for the first deploy.
6. Your API is now at `https://wchat-api.onrender.com`.
   Test it: <https://wchat-api.onrender.com/api/health> should return
   `{"status":"ok","app":"Wchat",...}`.

### Render free-tier behaviour

- The service **sleeps after ~15 minutes without traffic**. The next request
  takes 30â€“60 seconds to wake it. The client handles this gracefully (retry the
  action once).
- Free instance hours are limited per month â€” plenty for a small app.
- Keep it awake with a free uptime pinger such as
  <https://uptimerobot.com> or <https://cron-job.org>, pinging
  `https://wchat-api.onrender.com/api/health` every 10 minutes (optional; stays
  within fair-use).

### Alternative: Koyeb

<https://www.koyeb.com> also has a free web service with WebSocket support.
Settings are the same: root `server`, build `npm install`, run `npm start`,
health check `/api/health`. Render has the simpler free tier today.

---

## 4. Client â€” Vercel (free)

1. Sign up at <https://vercel.com> with GitHub.
2. **Add Newâ€¦ â†’ Project** â†’ import the repository.
3. Configure:

   | Field | Value |
   |---|---|
   | Framework Preset | `Vite` (auto-detected) |
   | **Root Directory** | `client` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

4. **Environment Variables** â†’ add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://wchat-api.onrender.com` |

   No trailing slash. This value is baked in at build time, so **redeploy after
   changing it**.

5. **Deploy**. Your app is live at `https://wchat-xxxx.vercel.app`.
6. Open **Settings â†’ Domains** to rename the subdomain (e.g. `wchat.vercel.app`
   if available) or add a custom domain (section 6).

`client/vercel.json` already rewrites unknown paths to `index.html`, so React
Router deep links (`/profile`, `/circles/...`) work.

### Back on Render

Now that you know the client URL, set `CLIENT_URL` on the Render service to it
(e.g. `https://wchat.vercel.app`) and **redeploy**. This is what allows the
browser to call the API and open the Socket.IO connection.

If you use a custom domain too, list every origin, comma-separated:

```
CLIENT_URL=https://wchat.vercel.app,https://wchat.is-a.dev
```

### Alternative: Netlify

- **Add new site â†’ Import an existing project â†’ GitHub**.
- Base directory: `client`; build `npm run build`; publish `dist`.
- Environment variable: `VITE_API_URL=https://wchat-api.onrender.com`.
- `client/public/_redirects` and `client/netlify.toml` already handle SPA
  routing.

---

## 5. Single-host option (one free Render service)

If you want **no CORS and no `VITE_API_URL`**, let Express serve the built
client. The server already does this automatically when `client/dist` exists.

1. Render â†’ **New â†’ Web Service**, but this time:
   - **Root Directory**: leave **empty** (the repository root)
   - **Build Command**:

     ```bash
     cd server && npm install && cd ../client && npm install && npm run build
     ```

     (On Render the shell is Linux, so `&&` works.)
   - **Start Command**: `cd server && npm start`
   - **Health Check Path**: `/api/health`
2. Environment variables: same as section 3, except:
   - `CLIENT_URL` can be the service's own URL (Socket.IO same-origin works
     even if left as the default; same-origin requests send no `Origin` header
     for GETs and the page origin for API calls â€” list the Render URL to be
     safe).
   - Do **not** set `VITE_API_URL`.
3. Deploy. The app, API, uploads and Socket.IO all live on one HTTPS origin,
   e.g. `https://wchat.onrender.com`.

Trade-off: the whole app sleeps together, and every deploy rebuilds the client.

---

## 6. A free domain name

A real paid TLD (`.com`, `.app`, `.rw`) is never truly free. These options give
you a **free public hostname** that looks like a domain:

### Free subdomains from the hosts (zero setup)

| Host | Free URL | How |
|---|---|---|
| Vercel | `https://wchat.vercel.app` | Project â†’ Settings â†’ Domains â†’ edit the `*.vercel.app` subdomain |
| Netlify | `https://wchat.netlify.app` | Site configuration â†’ Change site name |
| Render | `https://wchat-api.onrender.com` | Service name becomes the hostname |
| Cloudflare Pages | `https://wchat.pages.dev` | Project name |

This is enough for most projects and is the fastest route.

### `is-a.dev` â€” free `*.is-a.dev` (recommended for developers)

1. Fork <https://github.com/is-a-dev/register>.
2. Add `domains/wchat.json`:

   ```json
   {
     "owner": { "username": "your-github-username" },
     "record": {
       "CNAME": "cname.vercel-dns.com"
     }
   }
   ```

3. Commit, push, open a Pull Request. After review + merge, `wchat.is-a.dev`
   points at your Vercel site (it can take a few minutes to propagate).
4. In Vercel â†’ Domains â†’ **Add** `wchat.is-a.dev`; Vercel issues the free
   certificate automatically.

Use the same pattern for the API: `api.wchat.is-a.dev` with a `CNAME` to
`wchat-api.onrender.com`, then add it in Render â†’ Settings â†’ Custom Domains.

### `js.org` â€” free `*.js.org`

<https://github.com/js-org/js.org> accepts pull requests for JavaScript
projects. Same idea: CNAME to your host. Review can take weeks.

### `eu.org` â€” free domains like `wchat.eu.org`

1. Request a domain at <https://nic.eu.org> (free, but manual review can take
   days to weeks).
2. Point its **nameservers** at Cloudflare (free plan), then create the records
   there:
   - `wchat` â†’ CNAME `cname.vercel-dns.com`
   - `api` â†’ CNAME `wchat-api.onrender.com`
3. Add both hostnames in Vercel and Render so they issue certificates.

### DuckDNS / No-IP â€” free dynamic hostnames

<https://www.duckdns.org> (`wchat.duckdns.org`) and
<https://www.noip.com/free> are handy for a server with a dynamic IP (e.g. a
home PC). They only provide A/AAAA records, so they are not ideal for
Vercel/Render, which expect a CNAME for subdomains.

### GitHub Student Developer Pack

If you are a student, <https://education.github.com/pack> includes a **free
Namecheap `.me` for one year**, a `.tech` domain, and other credits. Verify
with your school email/student ID. This is the cheapest way to get a real TLD
like `wchat.me`.

### About Freenom

Freenom (`.tk`, `.ml`, `.ga`, `.cf`, `.gq`) no longer reliably offers free
registrations. Don't build on it.

### Cloudflare (free DNS + SSL)

Put any domain you own on Cloudflare's free plan for DNS, then point:

- client subdomain (`wchat`, `www`) â†’ CNAME `cname.vercel-dns.com`
- API subdomain (`api`) â†’ CNAME `wchat-api.onrender.com`

Both Vercel and Render provision free TLS certificates for custom domains.

---

## 7. Final checklist

- [ ] Atlas cluster created, DB user created, `0.0.0.0/0` allowed.
- [ ] Render service is live and `/api/health` returns `ok`.
- [ ] Render env: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, Cloudinary keys.
- [ ] Vercel env: `VITE_API_URL` points at the Render URL, no trailing slash.
- [ ] `CLIENT_URL` on Render lists the exact client origin(s) (no trailing slash).
- [ ] A new account can register, log in, post, and upload a photo.
- [ ] Two browsers can chat in real time (Socket.IO works).
- [ ] Media URL starts with `https://res.cloudinary.com/...` (Cloudinary active).
- [ ] Deep links work after refresh (`/profile` does not 404).

---

## 8. Troubleshooting

**`blocked by CORS policy`**
`CLIENT_URL` on Render does not match the browser origin exactly. Include the
protocol (`https://`), no trailing slash, and comma-separate multiple origins.

**Socket.IO disconnects immediately / `websocket error`**
The client is connecting to the wrong host. Rebuild Vercel after changing
`VITE_API_URL`; it is compiled into the bundle. Render supports WebSockets on
the free plan.

**Everything works, then `401` after a while**
`JWT_SECRET` changed between deploys. Set it once and keep it stable.

**Uploads disappear after a deploy**
Expected on ephemeral hosts â€” add the three Cloudinary variables and redeploy.

**First request takes ~45 seconds**
The Render free service fell asleep. Either accept it or ping
`/api/health` every 10 minutes with a free uptime monitor.

**`MongoServerError: bad auth`**
The password in `MONGO_URI` is wrong or contains characters that need URL
encoding (`@`, `:`, `/`, `?`, `#`). Use a simpler random password or
percent-encode it.

**MongoDB connection timeout**
Atlas Network Access does not include `0.0.0.0/0`, or the cluster is paused.

