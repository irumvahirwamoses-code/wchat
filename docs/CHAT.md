# Wchat Chat

Messaging between people (private chats) and inside **Circles** (group chats).
Everything here is real: messages are stored in MongoDB, delivered over Socket.IO
and enforced server-side.

## Endpoints

### Conversations — `/api/chats`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/chats` | Every conversation you belong to, newest activity first. Pinned chats float to the top. |
| `POST` | `/api/chats` | Open (or create) a private 1:1 chat — `{ userId }` |
| `POST` | `/api/chats/group` | Create a Circle / group chat |
| `POST` | `/api/chats/group/add` | Add a member (admin only) |
| `PUT` | `/api/chats/group/rename` | Rename a group (admin only) |
| `PUT` | `/api/chats/group/leave` | Leave a group |
| `DELETE` | `/api/chats/group/:id` | Delete a group (admin only) |
| `GET` | `/api/chats/discover` | Browse public groups (`search`, `category`, `feature`, `sort`) |
| `POST` | `/api/chats/:id/join-request` | Ask to join a group that needs approval |
| `GET` | `/api/chats/join-requests` | Pending requests for groups you administer |
| `PUT` | `/api/chats/join-requests/:requestId` | Accept / reject a request (admin only) |
| `POST` | `/api/chats/:id/follow` | Toggle following a group |
| `POST` | `/api/chats/:id/invite` | Fetch (minting it on first use) a Circle's QR invite code — members only |
| `POST` | `/api/chats/join/:code` | Redeem a QR invite — adds you or files a join request |

### Messages — `/api/messages`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/messages/:chatId` | Conversation history (oldest first), senders + reactions + quotes populated |
| `POST` | `/api/messages` | Send a message (multipart: `chatId`, `contentType`, `text`/`file`, optional `replyTo`, optional `scheduledAt`) |
| `PUT` | `/api/messages/:id` | Edit your own **text** message (15-minute window) |
| `DELETE` | `/api/messages/:id` | Delete your own message |
| `PUT` | `/api/messages/:id/react` | Set / change / clear your emoji reaction |
| `POST` | `/api/messages/live-location` | Start sharing a live location — `{ chatId, latitude, longitude, durationMinutes }` |
| `PUT` | `/api/messages/:id/live-location` | Move your active live location |
| `PUT` | `/api/messages/:id/live-location/stop` | End a live location early |
| `PUT` | `/api/messages/:chatId/seen` | Mark the conversation read |

`contentType` is one of `text`, `image`, `audio`, `video`, `file`, `location`.

### Per-chat settings — `/api/chats/:id`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/chats/:id/settings` | Your theme, nicknames, pinned messages and vanish mode for this chat |
| `PUT` | `/api/chats/:id/settings` | Save `theme`, `vanishMode` and/or `nickname: { target, name }` |
| `POST` | `/api/chats/:id/pin-message` | Pin a message — `{ messageId }` (max 3) |
| `DELETE` | `/api/chats/:id/pin-message/:messageId` | Unpin a message |
| `PUT` | `/api/chats/:id/pin` | Pin / unpin the conversation for **you** (max 3) |

## Features

### Reactions
Any member can react to any message with one emoji. Reacting again replaces the
existing reaction; sending an **empty** emoji removes it. Reactions are stored on
the message (`reactions: [{ user, emoji }]`) and broadcast with the
`message reacted` socket event.

### Replies
Sending with `replyTo` quotes another message **in the same chat** (a reply that
points outside the chat is rejected with `400`). The quoted message is populated
on read, so the bubble can show the author and a one-line preview; tapping the
quote scrolls to the original.

### Pinned messages
Up to **3** messages can be pinned per chat by any member. Pins appear in a strip
beneath the header; tapping one scrolls to it. `chat pinned-messages` tells the
other open clients to refresh.

### Pinned conversations
Each member can pin up to **3** conversations. Pins are stored per user
(`user.pinnedChats`), so they are private, and pinned chats sort to the top of the
list.

### Chat themes
A conversation's outgoing bubbles can use one of the presets in
`client/src/config/chatThemes.js`. Themes are **per user** (`user.chatThemes`),
so the same chat can look different on each side. An empty id means the default
Wchat theme.

### Nicknames
Set a private nickname for the other person (1:1) or for the group itself
(`target: null`). Stored per user in `user.nicknames`; the client shows it via
`getChatNickname()` wherever a chat title is rendered.

### Scheduled messages
"Send later" queues a message up to **29 days** ahead (minimum one minute). The
message is stored immediately with `delivered: false` and only its author can see
it; `services/chatScheduler.js` reveals it at `scheduledAt`, flips `delivered` and
emits `message received` to the conversation. Conversation history and the chat
list both skip undelivered messages.

### Vanish Mode
A shared conversation mode (`chat.vanishMode`). While it is on, every new message
gets an `expiresAt` 24 hours out; the scheduler deletes expired messages and
emits `message deleted`. Either member can toggle it from the chat menu, and the
other side is told via the `chat settings` socket event. While on, the thread
shows a banner explaining that messages disappear.

shows a banner explaining that messages disappear.

### Live location
From the attach menu you can share where you are for **5–60 minutes** (presets of
15 / 30 / 60). The share is a normal message with `contentType: 'location'` whose
`content` is a JSON string:

```json
{ "latitude": -1.9441, "longitude": 30.0619, "live": true, "expiresAt": "…" }
```

The sharer's browser watches the position and pushes moves (throttled to one
every 20 seconds) via `PUT /api/messages/:id/live-location`, which broadcasts
`location updated` to the conversation. Only the sharer can move or end their own
share, and moves are refused once the share has ended or expired.

Stopping (`.../stop`) keeps the last known position in the thread with
`live: false`, and the deadline lives inside the payload rather than in
`expiresAt`, so ended shares are **not** swept up by the Vanish Mode purge.

The card in the thread renders a stylised map with a pulsing marker while live,
the coordinates, the end time, and an "Open in Maps" link.

### QR Circle invites
Every Circle can mint a short, unique `inviteCode` on demand
(`POST /api/chats/:id/invite`, members only). The chat menu shows it as a QR code
plus a shareable `/join/:code` link. Scanning it lands on the join page, which:
- adds the person straight away when `joinPolicy` is `open`, or
- files a `JoinRequest` (and pings the admin) when the policy is `request`.

Codes are lowercase hex, collision-checked on creation, and the field is left
absent until a code is minted so the sparse unique index behaves. A link opened
while signed out is remembered in `localStorage` and redeemed right after sign-in.

### Instant translation
Translation runs **on the device** — no message text ever leaves the browser.
`utils/translate.js` wraps the Chrome/Edge on-device `LanguageDetector` and
`Translator` APIs, and degrades gracefully with a "not supported in this browser"
notice everywhere else.

- Every text message has a **Translate** action in its hover rail (translates to
  the language chosen for the chat, or English by default).
- The chat menu has **Translate messages →**, which picks a target language and
  turns **automatic** translation on for that chat (`localStorage`
  `wchatTranslate:<chatId>`); incoming messages are then translated as they arrive.
- Translated bubbles are labelled ("Translated from French") with a
  "Show original" / "Show translation" toggle.

### Tapping a Circle sender

In any Circle, the avatar and name on someone else's message open their profile
(`ChatBox` → `ScrollableChat` `onUserClick` → `ProfileModal`), which shows their
Joins / Following counts and a **Join** button. Joining is Wchat's follow, and
works for personal Circles too.

### Group meetings (mesh WebRTC)

The video button in a Circle header starts a multi-party call. Each pair of
members shares one `RTCPeerConnection` in a mesh, and negotiation uses the
WebRTC **perfect negotiation** pattern:

- Roles are **deterministic** — for every pair, the member with the greater user
  id is *polite* (answers) and the other is *impolite* (offers). Two ends can
  never race, so there is no timer and no "which side calls first?" guess.
- Offers are driven by `onnegotiationneeded`, so a peer that joins mid-call is
  negotiated with immediately, and media keeps flowing as people arrive or leave.
- Candidates that arrive before the remote description are queued and flushed
  after it lands.
- Signalling rides the existing socket; if the socket reconnects the client
  simply announces itself again and existing members treat it as a new joiner.
- The camera/mic stream is acquired first, then `join meeting` is emitted, so
  tracks are already attached when the first peer object is created.

The server keeps a per-meeting membership map in `server/server.js` and relays
`meeting signal` directly to the target member's `user:<id>` room.

## Models

- **Message** adds `reactions[]`, `replyTo`, `scheduledAt`, `delivered`,
  `expiresAt`, `contentType: 'location'`, and keeps `seenBy` / `editedAt`.
- **Chat** adds `pinnedMessages[]` (message, user, pinnedAt), `vanishMode` and a
  unique, sparse `inviteCode`.
- **User** adds `pinnedChats[]`, `chatThemes[]`, `nicknames[]`.

## Socket events

| Event | Direction | Meaning |
|---|---|---|
| `message received` | server → client | A new message arrived |
| `message reacted` | server → client | A reaction changed (full message payload) |
| `message edited` / `message deleted` | server → client | An edit / deletion |
| `chat seen` | server → client | Read receipts advanced |
| `chat pinned-messages` | server → client | The pin set changed — re-fetch settings |
| `chat settings` | server → client | Vanish mode changed |
| `location updated` | server → client | A live location moved (`{ messageId, chatId, latitude, longitude, live }`) |
| `member added` | server → client | Someone joined a Circle from an invite |
| `new join request` | server → client | A QR invite filed a request for the admin |
| `join meeting` | client → server | Announce yourself in a Circle meeting (`{ meetingId, userId, name }`) |
| `meeting peers` | server → client | The members already in the meeting, sent to the joiner |
| `meeting peer joined` | server → client | Someone joined the meeting |
| `meeting peer left` | server → client | Someone left the meeting (or disconnected) |
| `meeting signal` | both | SDP / ICE for a peer (`{ to, from, signal }`), relayed to `user:<id>` |
| `leave meeting` | client → server | You are leaving the meeting |
