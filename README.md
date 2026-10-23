# Wchat 💬

**Wchat** is a mobile-first, **group-based social network** — real-time chat, Loops
(short videos), posts, Sparks (likes), stories and community discovery — built
with the **MERN stack** (MongoDB, Express, React, Node.js) and **Socket.IO**.

> **Circles are the heart of Wchat.** Every account is a Circle, and every Loop,
> post and conversation belongs to a Circle.

**Brand:** electric blue `#245BFF` · deep indigo `#24145B` · light surface `#F3F5FA`

## ✨ Features

### Accounts & verification (Wchat Auth 2.0)
- Register with a real **verification code** sent by **email (Brevo)** or **SMS** —
  choose the channel, confirm the code, and only then is the account created
- **Username suggestions** from your name + live availability check
- **Gender → automatic avatar** (gender-matched DiceBear avatar, no upload needed at signup)
- Full name, date of birth (13+), password, **phone with country dial-code dropdown**, country
- Login with **email, phone number or username** + password
- Edit your profile later — including uploading your own photo and changing your handle

### Real-time chat
- **1-on-1 private messaging** with Socket.IO, typing indicators, online status,
  read receipts (**Seen**) and message history
- Text, images, audio (voice notes), video and **document** messages
- **Emoji picker**, **edit** (within 15 minutes, like Instagram) and **delete**
  your own messages (synced live)
- **Notes** — a 60-character status pinned above your inbox for 24 hours
- **1-on-1 audio/video calls** and **group video meetings** — a mesh WebRTC
  meeting whose peer roles are decided deterministically, so members connect
  immediately instead of waiting on a timer
- **Tap any Circle sender** to open their profile and **Join** them without
  leaving the conversation

### Home feed & posts
- Instagram-style **Home** stream: posts and media from your Circles, the people
  you Join, and your own timeline, with a **Stories bar** at the top
- **Posts** with text and/or up to **10 photos/videos** in a swipeable carousel
- **Location tags**, `#hashtags` and `@mentions` (auto-extracted and highlighted)
- **Spark** (like), comment, **Save** (bookmark) and **Drop** (share) on every post
- **Download** and **Remix** where the creator allows it — controls in Settings
- **Pin up to 6 posts** to the top of your profile grid
- Every post shows its **Circle identity** (name) so context is never lost

### Stories
- 24-hour photo/video stories with a ring in the Stories bar
- View tracking and automatic expiry (TTL index)

### Reels
- Multi-clip editing: trim, speed, filters, an audio bed, draggable text overlays
  with an align grid, hands-free recording with a countdown, templates and
  **auto-captions** from on-device dictation
- **Autoplay** — only the Reel you're actually looking at plays, driven by an
  IntersectionObserver
- **Full-window immersive viewer** — one Reel fills the whole screen with
  scroll-snapping; Spark, Save, Drop, Download, Remix and **Join the Circle**
  stay available, and `↑` / `↓` / `Esc` work on desktop
- Every Reel says **why** it's in your feed, and you can **Remix** any Reel whose
  creator allows it

### Notifications
- Live **Home bell** for Sparks, replies, `@mentions`, Circle joins and invites,
  pushed in real time over Socket.IO, with unread counts and mark-all-read

### Settings & themes
- **Account Center** — personal details, **change password**, your activity and
  account status in one place
- **Sharing & reuse** — allow remixes, sharing and downloads, and choose **who can
  @mention you** (everyone · people you follow · no one)
- **Profile insights** — real numbers only: Sparks, comments, saves, shares, Reel
  plays, followers, a 7-day publishing series and your top posts
- **Appearance** — switch the whole system between **Dark**, **Light** and
  **Midnight** themes (persisted to your account)
- **Data & storage** — data saver and autoplay controls
- **Privacy & safety** — read receipts, who can DM you, hidden words, and a
  **blocked accounts** manager (block / unblock)

### Discover & public profiles
- **Buzz** (Explore) tab surfacing public posts you haven't joined, each labelled
  with **why you're seeing it** (popular in a Circle, a creator you Join, a hashtag)
- Search across posts, hashtags and locations
- **Public profiles** with bio, interests and contribution stats — email, phone,
  gender and date of birth are never exposed
- **Joins & Following** counts on every profile, plus the list of people behind
  each count so you can Join them right there

### Circles (groups)
- **Circles are the heart of Wchat** — every account is also a Circle, and every
  conversation lives in one
- **Interest onboarding** — pick at least 5 fields, then Join at least 5 Circles
  before you reach the feed (a route guard keeps new accounts on `/onboarding`)
- Three Circle types: **topic**, **local** (district) and **personal** (a person's
  profile; joining it is Wchat's "follow")
- 17 public **starter Circles** created automatically (`server/data/circles.js`)
- **Circle discovery (Discover)** — search/filter by name, category and features;
  sort by followers / members / recent
- Join policies (**open** = one tap, **request** = admin approval), roles, admin
  tools and join-request notifications

### Community Circles (each Circle is a mini social network)
Open the **Community hub** from any Circle header — six ways to participate:
- **Circle Chat** — real-time conversations, replies and voice notes
- **Circle Reels** — short videos from the community and its creators
- **Circle Library** — guides, documents, tutorials and trusted answers
- **Circle Challenges** — competitions, achievements and collaborative projects
- **Circle Events** — meetings, livestreams, workshops and reminders
- **Circle Opportunities** — jobs, scholarships, mentorship and projects

Every item supports **Spark** (like), author edit, admin delete and an external
link, and is aggregated in the **Reels** and **Discover** tabs.

### Circle operations, access & decisions
- **Circle Operations** — start, stop or restart every member's resource as one
  unit; a resource that cannot come back marks the whole Circle **broken**
  until a successful restart, and the Circle can be **moved** to a new admin
  (the previous admin stays as moderator)
- **Circle Access Control** — one policy per Circle (post messages, send media,
  create items, invite members, manage members, start decisions) enforced in
  chat, Circle content and decisions alike, plus per-member roles
  (owner / admin / moderator / member)
- **Circle Decisions (GDSS)** — parallel idea collection, a private → published
  workspace, anonymous Delphi rating rounds, a recorded outcome and an
  automatic audit log

### Mobile navigation
A five-tab bottom bar, built mobile-first:
**Home** (posts & recommended content) · **Reels** (short videos & challenges) ·
**Communities** (your groups, chats & activities) · **Discover** (people, public
Circles, events & opportunities) · **Profile** (posts, interests, saved, settings).

## 🛠️ Tech Stack

| Layer     | Technology                                                                 |
|-----------|----------------------------------------------------------------------------|
| Frontend  | React 19, Vite, Tailwind CSS v4, React Router 7, socket.io-client, axios   |
| Backend   | Node.js, Express 5, Socket.IO, JWT, bcrypt, Multer                        |
| Database  | MongoDB + Mongoose                                                         |
| Email     | **Brevo** transactional API (`server/services/mailer.js`)                   |
| SMS       | Any HTTP gateway (`server/services/sms.js`)                                 |
| Calls     | WebRTC (peer-to-peer video/audio)                                          |

## 📁 Project Structure

```
wchat/
├── server/          # Express + Socket.IO + MongoDB API
│   ├── config/      # DB connection
│   ├── models/      # User, Chat, Message, Post, Comment, Story, Note,
│   │                # Notification, CircleItem, CircleOps, CircleDecision,
│   │                # JoinRequest, VerificationCode
│   ├── controllers/ # auth, user, chat, message, post, story, note,
│   │                # notification, circle, circle ops, access, decisions
│   ├── routes/      # /api/auth, /api/users, /api/chats, /api/messages,
│   │                # /api/circles, /api/decisions, /api/posts, /api/stories,
│   │                # /api/notes, /api/notifications
│   ├── services/    # Brevo email, SMS sending, notifications
│   ├── data/        # interests, categories, countries, circles
│   ├── scripts/     # seed demo accounts + username migration
│   ├── middleware/  # JWT protect, multer uploads (disk or Cloudinary)
│   └── uploads/     # local uploads (development only)
├── client/          # React (Vite) frontend
│   └── src/
│       ├── context/ # Auth, Chat, Socket contexts
│       ├── components/ # ChatBox, MessageInput, ScrollableChat, PostCard,
│       │            # PostComposer, StoriesBar, StoryViewer, NotesBar,
│       │            # NotificationBell, Settings, CircleHub, CircleOpsPanel,
│       │            # CircleAccessPanel, CircleDecisions, MobileNav…
│       ├── pages/   # AuthPage, ChatPage, OnboardingPage, HomeFeed, ReelsFeed,
│       │            # CommunitiesPage, DiscoverPage, ProfilePage
│       └── utils/   # api helpers, handle formatting, theme storage
└── docs/            # VISION.md (product + roadmap) · AUTH.md (auth + Brevo setup)
                     # CHAT.md (messaging) · REELS.md · DISCOVERY.md (Home/Explore)
                     # PROFILE.md (Account Center · sharing & reuse · insights)
                     # DEPLOY.md (free hosting + free domains)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally (default: `mongodb://127.0.0.1:27017/wchat`)

### 1. Backend
```bash
cd server
npm install
npm run dev          # http://localhost:5000
```

### 2. Frontend
```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

### 3. Demo accounts (optional)
```bash
cd server
npm run seed         # starter Circles + two demo accounts (also migrates old #usernames)
```

The demo accounts are **already onboarded** (fields chosen, Circles joined) so you
land straight on the dashboard. A brand-new account goes through the onboarding
flow instead.

| Handle | Email | Password |
|---|---|---|
| `@keza` | `keza@wchat.rw` | `Keza1234` |
| `@eric` | `eric@wchat.rw` | `Eric1234` |

### 4. Verification codes in development
Leave `BREVO_API_KEY` (and the SMS variables) empty: the code is printed to the
**server console** and also shown in the UI as a toast, so you can complete
registration without any external service. See [docs/AUTH.md](docs/AUTH.md) for
the Brevo setup.

## 📝 Environment Variables (`server/.env`)

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/wchat
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173        # comma-separated origins in production

APP_NAME=Wchat
CLOUDINARY_CLOUD_NAME=                  # optional: permanent media on free hosts
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=wchat
BREVO_API_KEY=            # empty = dev mode (codes logged)
MAIL_FROM_EMAIL=no-reply@wchat.app
MAIL_FROM_NAME=Wchat
SMS_API_URL=              # empty = dev mode (codes logged)
SMS_API_KEY=
SMS_SENDER=Wchat
VERIFY_CODE_TTL_MINUTES=10
```

`client/.env` holds the API origin when the client is deployed separately:

```
VITE_API_URL=https://wchat-api.onrender.com
```

## ☁️ Free hosting (step by step)

The whole app can run for **free** with no credit card:

| Part | Free host | What to use it for |
|---|---|---|
| React client | **Vercel** or **Netlify** | static build of `client/` |
| API + Socket.IO | **Render** free web service (or **Koyeb**) | `server/` |
| Database | **MongoDB Atlas** M0 | users, chats, posts |
| Uploads | **Cloudinary** free tier | images, video, audio, documents |
| Domain | host subdomain, **is-a.dev**, **eu.org**, **DuckDNS** | free URL |

Full walkthrough — including CORS, WebSockets, Atlas network access, Cloudinary
keys, custom domains and the free-domain options — is in
**[docs/DEPLOY.md](docs/DEPLOY.md)**.

## 🗺️ Roadmap
See **[docs/VISION.md](docs/VISION.md)** — Circles, Loops, the Spark/Buzz feed
algorithm with user feedback, Inkuru stories and the Rwanda-first differentiators.

## ⚠️ Notes
- Video calls use a public STUN server; for production across NATs, add a TURN server.
- Voice notes require microphone permission (works on `localhost` or HTTPS).
- Redis is not required; presence/call state is kept in memory (single instance).
