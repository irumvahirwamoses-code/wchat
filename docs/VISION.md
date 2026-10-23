# Wchat — Product Vision

> **Wchat** is a mobile-first, group-based social network for Rwanda and beyond:
> real-time chat and Loops (short videos), posts, comments, Sparks (likes) and
> community discovery — with **Circles (groups) at the heart of the platform**.
> Every Loop, post and conversation belongs to a Circle.

**Brand:** electric blue `#245BFF` · deep indigo `#24145B` · light surface `#F3F5FA`

## Wchat terminology

| Generic term | Wchat name | Meaning |
|---|---|---|
| Follow | **Join** | Connecting to a person or a Circle |
| Group / community | **Circle** | The organising unit of Wchat |
| Short video / Reels | **Loop** | Short vertical video inside a Circle |
| Like | **Spark** | The reaction that pushes content up |
| Trending | **Buzz** | What the network is talking about now |
| Post | Post | Text, photo, video, poll, listing or event |

## The core idea: every account is a Circle

- Registering automatically creates a **personal Circle** for that person.
- A profile *is* a Circle page: members, its own feed, its own story ring, rules.
- **Discover** shows all public Circles — personal, topic and local. Joining a
  personal Circle is the Wchat way of "following" someone.
- Three Circle types: **personal** (one per user), **topic** (coffee, moto-taxi,
  coding…) and **local** (cell / sector / district — e.g. *Kicukiro · Gikondo*).
- Roles: **owner › admin › moderator › member › guest**. Join policies:
  `open`, `request` (approval flow), `invite`, `paid` (MoMo).

## Onboarding (after the account is created)

1. **Pick your fields** — at least **5** interests (see `server/data/interests.js`).
2. **Meet your people** — recommended Circles/people for those fields; **Join at
   least 5**.
3. **Make it yours** — photo, language (rw/en/fr/sw), district, content preferences.

Until onboarding is complete the app keeps the user on this flow. The chosen
fields seed the feed algorithm so the very first feed is already relevant.

## Feed, Loops and Buzz

- The home feed merges: Circle posts you joined + people you follow + your
  interest fields + your district + Buzz (trending in the last 24h).
- Post types: text, image, **Loop** (video), voice, poll, question, marketplace
  listing, event, how-to.
- Interactions: **Spark**, comment (threaded), share, repost w/ quote, save,
  "not interested", report.
- **Low-data mode**: text-only toggle, image compression, data meter — built for
  Rwandan mobile data.

## The algorithm + feedback loop

- **Implicit signals**: Spark, comment, share, repost, save, dwell time, video
  completion, hide, mute, report.
- **Explicit feedback**: in-feed micro-cards — *"More coffee farming? `More`
  `Less` `Not interested`"* — plus a **"Why am I seeing this?"** panel on every
  card (explainability builds trust).
- Per-user `InterestProfile` holds interest weights, author affinity, content-type
  affinity, language affinity and recency decay. Ranking:

```
score = 0.35·interestMatch + 0.20·authorAffinity + 0.15·freshness
      + 0.15·engagementVelocity + 0.10·locality + 0.05·diversity
      − penalties + ε-exploration(10%)
```

## Stories ("Inkuru")

In the main header: your story (`+`), unseen Circles (Wchat ring), seen (grey).
A story supports photo/video, music, captions, text overlays, voice-over and
stickers (poll, question, location, mention, countdown, price tag). Circles can
post stories too. Replies slide into chat; highlights are saved to the profile.

## What global apps don't do here

| Wchat capability | Why it matters |
|---|---|
| Circles with roles, rules, events, jobs, marketplace | WhatsApp groups are just a chat |
| **Ibimina ledger** — transparent group savings | Digitalises what millions do on paper |
| MoMo in-chat: send, split, tip, pay-to-join | Payments live where Rwandans already are |
| Kinyarwanda-first UI + voice posts auto-transcribed | Works for everyone |
| Low-data / offline queue + USSD companion | 2G/3G and feature phones stay connected |
| District-level local feeds | Nothing global is this local |
| Local moderators + Kinyarwanda abuse detection | Trust and safety | 

## Community Circles — one community, multiple ways to participate

Each Circle is a **mini social network** with its own identity and activities.
Open the **Community hub** from the Circle header (grid icon) or from the
**Communities** tab. Sections are backed by the `CircleItem` API, so every action
persists (`server/models/CircleItem.js`, `server/controllers/circleController.js`):

| Section | Tagline | Notes |
|---|---|---|
| **Circle Chat** | Real-time conversations, replies, polls, and voice notes. | The Circle's conversation (existing chat) + voice notes, edit/delete, read receipts, emoji. |
| **Circle Reels** | Short videos from the community and its creators. | Upload a video to a Circle; aggregated in the **Reels** tab (`GET /api/circles/feed/reels`). |
| **Circle Library** | Guides, documents, tutorials, and trusted answers. | Attach a document or link a trusted answer. |
| **Circle Challenges** | Competitions, achievements, and collaborative projects. | Members **Join**; participant count + optional deadline. |
| **Circle Events** | Meetings, livestreams, workshops, and reminders. | Date/time + location; members **Join**. |
| **Circle Opportunities** | Jobs, scholarships, mentorship, and projects. | Tags (job, scholarship…), deadline, external link. |

Every item supports **Spark** (like), edit (author), delete (author or Circle
admin) and an external **link**. Endpoints: `GET/POST /api/circles/:chatId/items`,
`PUT/DELETE /api/circles/:chatId/items/:id`, `POST …/spark`, `POST …/join`,
`GET /api/circles/mine`, `GET /api/circles/feed/reels`,
`GET /api/circles/feed/discover`.

## Mobile navigation concept

Wchat is mobile-first: a five-tab bottom bar (`client/src/components/MobileNav.jsx`).

| Tab | Purpose | Screen |
|---|---|---|
| **Home** | Personal Circle feed — posts, carousels, stories. | `HomeFeed` — Stories bar + ranked-by-recency feed + composer. |
| **Reels** | Short videos and community challenges. | `ReelsFeed` — Reels from all your Circles + upload. |
| **Communities** | Your groups, group chats and activities. | `CommunitiesPage` — your Circles with per-section counts, open hub or chat. |
| **Discover** | People, public Circles, events and opportunities. | `DiscoverPage` — **Buzz** (public posts), People / Circles / Opportunities. |
| **Profile** | Your posts, interests, saved items and settings. | `ProfilePage` — Posts + Saved tabs, contribution stats, bio, Settings. |

On desktop the same app keeps the two-pane layout (chat list + conversation) and
the bottom bar is hidden (`md:` breakpoint).

## Status & roadmap

| Phase | Scope | Status |
|---|---|---|
| **A** | Wchat brand, Wchat Auth 2.0 (username suggestions, gender avatars, DOB, dial-code dropdown, country, **email/SMS OTP verification via Brevo**, login by email/phone/username), profile edit incl. photo & handle | ✅ built |
| **B** | Circles model, personal Circle per user, interest onboarding (≥5 fields, Join ≥5), Discover | ✅ built |
| **B.1** | **Community Circle sections** (Reels, Library, Challenges, Events, Opportunities) + **mobile navigation** (Home/Reels/Communities/Discover/Profile) | ✅ built |
| **B.2** | Chat quality: **file/audio/video/voice + document uploads fixed**, profile-picture upload fixed, **read receipts (Seen)**, **emoji picker**, **edit / delete message** | ✅ built |
| **C** | Post/Comment models, home feed, Spark / comment / share / repost / save | 🟡 core built (see below) |
| **D** | Inkuru stories (header rings, composer with music + captions, viewers, replies) | 🟡 core built (24h stories) |
| **E** | Algorithm: InterestProfile, ranking, feedback cards, "Why am I seeing this?" | 🟡 reasons shipped on Explore |
| **F** | Notifications centre, moderation tools, MoMo, offline/low-data, USSD | 🟡 notifications + data saver + block built |

### Delivery roadmap (Wchat phases 1–4)

**Phase 1 — Essential social platform** (build first)
- Registration, login, profile, and password recovery.
- Create public and private groups.
- Group membership, roles, and moderation.
- Real-time group messaging and direct messages.
- Text and image posts, comments, likes, and sharing.
- Basic notifications, search, block, and report.

**Phase 2 — Social discovery**
- Short-video uploads and a Reels feed.
- Group-linked Reels and public group discovery.
- Following creators and saving content.
- Group polls, announcements, and pinned messages.
- Data Saver settings and basic content recommendations.

**Phase 3 — Your differentiators**
- Kinyarwanda–English translation, followed by more languages.
- Opportunities and community challenges.
- Searchable knowledge libraries.
- Verified organization profiles.
- International community collaboration.

**Phase 4 — Advanced capabilities**
- Group voice and video rooms.
- AI-assisted discussion summaries and recommendations.
- Creator monetization, where appropriate.
- Business catalogs and supported payment integrations.


### What Phase B ships

- **Circle** = the Wchat group primitive, stored on the existing `Chat` document
  (`circleType`: `topic` | `local` | `personal`, `joinPolicy`: `open` | `request`,
  `interests`, `description`, `district`, `rules`).
- **Every account is a Circle** — a personal Circle is created automatically at
  registration and kept in sync with the profile. Joining a personal Circle is
  Wchat's "follow".
- **Starter Circles** (17, see `server/data/circles.js`) are created on boot and
  by `npm run seed`, so onboarding always has relevant content.
- **Onboarding** (`/onboarding`): pick ≥5 fields → Join ≥5 Circles → dashboard.
  Endpoints: `GET /api/users/onboarding`, `PUT /api/users/interests`,
  `POST /api/users/onboarding/join`, `POST /api/users/onboarding/leave`,
  `POST /api/users/onboarding/complete`.
- Recommendations rank topic/local Circles and people by interest overlap then
  membership; the home chat list excludes personal Circles, while **Discover**
  shows them all.

See **[AUTH.md](AUTH.md)** for the authentication flow, environment variables and
Brevo setup.

### What Phase B.1 / B.2 ship

- **Community Circle sections** — `CircleItem` (`kind`: `reel` | `library` |
  `challenge` | `event` | `opportunity`) with title, description, media, link,
  date, location, tags, **Sparks** and **participants**. The **Community hub**
  (`client/src/components/CircleHub.jsx`) renders one tab per section with a real
  create form; the **Communities** and **Discover** tabs aggregate them.
- **Mobile navigation** — bottom bar with Home / Reels / Communities / Discover /
  Profile; desktop keeps the two-pane layout.
- **Uploads** — the shared axios client no longer forces
  `Content-Type: application/json`, which used to turn `FormData` into JSON and
  silently drop the file. Image, audio, video, **voice notes**, **documents** and
  **profile pictures** now upload; multer accepts a safe document whitelist and
  rejects executables.
- **Chat quality** — read receipts (**Seen**, `PUT /api/messages/:chatId/seen` +
  `chat seen` socket), **emoji picker**, **edit message**
  (`PUT /api/messages/:id`, `editedAt`) and **delete message**
  (`DELETE /api/messages/:id`), all broadcast in real time.

### What the Home feed, Stories, Notes & Settings ship

- **Home feed** — `GET /api/posts/feed` merges posts from your Circles, timeline
  posts of people you Join and your own posts (`server/controllers/postController.js`
  → `buildFeedFilter`). Each card renders its **Circle identity** so context is
  never lost.
- **Posts** — `Post` gains `mediaItems` (carousel, max 10), `location`, `tags`
  (`#hashtags`), `mentions` (`@usernames`, auto-extracted), `savedBy` (bookmarks)
  and `pinnedAt` (pin ≤6 to your profile). Endpoints: `POST /api/posts`
  (multipart, up to 10 files), `POST /:id/save`, `POST /:id/pin`, `GET /saved`.
- **Buzz / Explore** — `GET /api/posts/explore` returns **public** posts you have
  not joined, each with a `reason` ("Popular in <Circle>", "You joined this
  creator", "Buzz for #tag") so recommendations are explainable. Search by text,
  hashtag or location.
- **Stories** — 24-hour photo/video stories with a TTL index
  (`server/models/Story.js`), a Stories bar and a viewer with progress bars.
- **Notes** — 60-character status pinned above the inbox for 24 hours
  (`server/models/Note.js`, one active note per person/Circle, auto-expiry).
- **Notifications** — `Notification` (spark, comment, mention, join, invite,
  announcement) created for every relevant action, pushed live to the recipient's
  socket room (`services/notifications.js`) and surfaced by the Home bell with
  unread counts and mark-all-read.
- **Settings & themes** — `User.preferences` (`theme`, `dataSaver`,
  `autoplayVideos`, `showReadReceipts`, `allowDmFromAnyone`) is editable in
  **Settings** (`PUT /api/auth/preferences`) and applied on login. The three themes
  (Dark / Light / Midnight) work by re-mapping Tailwind's colour variables under
  `html[data-theme=…]` in `client/src/index.css`, so **every screen** restyles at once.
- **Privacy & safety** — `User.blocked` with `POST/DELETE /api/auth/block/:userId`
  and `GET /api/auth/blocked`; public profiles (`GET /api/users/:id`) never expose
  email, phone, gender or date of birth.

