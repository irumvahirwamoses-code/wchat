# Wchat Discovery & Participation

How Home and Explore decide what people see — and how they turn looking into
taking part.

## Feed recommendation explainers

Every post and Reel in a member's stream carries a small **"why you're seeing
this"** line, and a `?` that expands a plain-language explanation of the ranking.
The server decides the reason and sends three fields alongside the item:

| Field | Meaning |
|---|---|
| `reason` | Short sentence shown under the item, e.g. `From Technology Rwanda` |
| `reasonCode` | Stable key the client maps to an icon + explainer: `self`, `circle`, `creator`, `tag`, `nearby`, `trending` |
| `reasonDetail` | The specific Circle / person / tag behind the decision |

The decision order in `server/controllers/postController.js`
(`decorateReason`) is:

1. **`self`** — your own post (`Your post`).
2. **`circle`** — posted in a Circle you belong to (`From <Circle>`).
2. **`creator`** — you joined this person (`Because you follow @handle`).
3. **`tag`** — it matches a topic you're into (`Because you're into #topic`).
4. **`nearby`** — it carries a place you are part of.
5. **`trending`** — everything else (`Trending in Rwanda right now`).

Reels use the same shape from `listReelsFeed` in
`server/controllers/circleController.js`, plus an `isMember` flag so the client
knows whether to offer **Open Circle** or **Join**.

`client/src/components/ReasonBadge.jsx` renders the line, the expandable
"How the stream is built" note, and an optional **not interested** control.

The explanation shown to members is honest about the ranking:

> Wchat builds your stream from the Circles you are in, the people you joined, and
> what matches your interests and area. Fresh posts get a small boost so you see
> news as it happens — nothing is shown purely because it is popular.

## Discovery → participation

Finding something should let you act on it, without a detour.

### Home — "Take part today"
`client/src/components/ParticipationRail.jsx` pulls upcoming **events** and
**challenges** from the member's Circles and shows them as a horizontal rail
above the feed, soonest first. Each card can be acted on in one tap:

- `I'm going` — joins an event (`POST /api/circles/:chatId/items/:id/join`)
- `Join challenge` — joins a challenge
- `Open Circle` — jumps straight into the Circle

The rail is hidden entirely when there is nothing to take part in, so Home stays
a feed when there is nothing to do.

## Explore

`client/src/pages/DiscoverPage.jsx` has four tabs, each built to lead somewhere:

### Buzz — public posts
Public posts from outside the member's Circles, each with the reason badge above
(`GET /api/posts/explore`). Sparks and comments work inline.

### People
Search by name or `@handle` and **Join** (follow) in place. Joining a person is
Wchat's way of adding their timeline to your stream — the same `creator` reason
you later see on their posts.

### Circles
Public Circles from `GET /api/chats/discover`, which now also returns
`joinPolicy` so the button is honest about what will happen:

- **open** → **Join** — added immediately (`POST /api/chats/:id/join-request`
  adds the member and emits `member added`).
- **request** → **Request to join** — files a `JoinRequest` and pings the admin.
- already a member → **Open Circle**.

When a Circle's category matches one of your interests, the card says so
("Because you're into technology") — discovery that explains the fit.

### Opportunities
Events, challenges and opportunities posted across your Circles
(`GET /api/circles/feed/discover`). Each card carries a reason ("From …"), and:

- **events / challenges** → **I'm going** / **Join challenge** toggles your place
  in one tap (`POST /api/circles/:chatId/items/:id/join`), with a live count.
- **any item** → **Open Circle** to walk into the conversation.
- **opportunities** with a link → **Open link** (application / registration).

## Home's "Take part today" rail

`client/src/components/ParticipationRail.jsx` is the Home counterpart: it merges
the member's events and challenges, sorts dated items soonest-first (undated
items last), and lets them take part without leaving the stream. It hides itself
when there is nothing to take part in, so Home stays quiet when the Circles are.

## Endpoints used

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/posts/feed` | Home stream — now decorated with `reason` / `reasonCode` / `reasonDetail` |
| `GET` | `/api/posts/explore` | Buzz — same decoration |
| `GET` | `/api/circles/feed/reels` | Reels — decorated, plus `isMember` and the Circle's `joinPolicy` |
| `GET` | `/api/circles/feed/discover?kind=` | Events / challenges / opportunities from your Circles |
| `GET` | `/api/chats/discover` | Public Circles with `joinPolicy`, `isMember`, `memberCount` |
| `POST` | `/api/chats/:id/join-request` | Join an open Circle instantly, or request a private one |
| `POST` | `/api/circles/:chatId/items/:id/join` | Take part in / step back from an event or challenge |
| `POST` | `/api/circles/:chatId/items/:id/spark` | Save / Spark an item |

## Tests

`smoke6.mjs` (in the temp test folder) covers this surface end to end: feed and
Reel reasons, `joinPolicy` in Explore, one-tap joining of an open Circle,
approval for a request-only Circle, and toggling participation on an event.
