# Wchat Profile & Settings

Everything a member controls about **how they appear** and **what others may do
with their content** lives here: the Account Center, Sharing & reuse, Profile
insights, plus the appearance / notifications / privacy / data sections that
already existed.

`client/src/components/Settings.jsx` is the panel (opened from Profile →
⚙ or the desktop rail) and `client/src/pages/ProfilePage.jsx` is the profile
itself.

## Account Center

The first section consolidates everything about *the account* in one place:

- **Personal details** — username, email, phone and date of birth, read straight
  from `GET /api/auth/me`. Editing the name, photo, category and links still
  happens in **Edit profile**.
- **Password & security** — change the password in place. The server
  (`PUT /api/auth/password`) verifies the **current password** first so a
  hijacked session cannot lock the owner out, rejects a password shorter than 6
  characters, rejects reusing the current password, and re-hashes through the
  model's pre-save hook.
- **Your activity** — hidden-word and blocked-account counts, with shortcuts to
  Insights and Privacy.
- **Account status** — account type and a plain read-out of the security state.

## Sharing & reuse

Members decide what other people may do with their content. The controls are
stored on the account (`user.preferences`) and enforced where reuse happens.

| Control | Preference | Enforced by |
|---|---|---|
| Allow remixes | `allowRemix` | `POST /api/circles/:chatId/items/:id/remix` returns **403** when the source creator has it off |
| Allow sharing | `allowShareToStories` | `PostCard` / Reel card hide **Drop**; the client shows a quiet note instead |
| Allow downloads | `allowDownload` | `PostCard` and the Reel card hide **Download** (`saveMedia` streams the file and falls back to opening it) |
| Who can @mention you | `allowMentions` (`everyone` · `people-i-follow` · `no-one`) | `resolveMentions` in `server/services/notifications.js` filters the mention list before any notification is created |

Mentions are the one control with a **server-side** effect: a mention that the
recipient has not allowed is dropped before it is stored or notified — nobody is
ever pinged by a mention they turned off. `people-i-follow` means the mentioned
account follows the person doing the mentioning.

### Remix = reuse, not copy-edit

`POST /api/circles/:chatId/items/:id/remix` carries the source Reel's clips,
audio, overlays, filter, cover and duration into a **new item authored by the
remixer**, linked back with `remixOf`. The remix lands in the Circle named in the
path, so the remixer must be a member of it. Only `kind: 'reel'` items can be
remixed.

Public profile and feed payloads expose the public flags
(`preferences.allowRemix`, `preferences.allowShareToStories`,
`preferences.allowDownload`) on the author so the client can hide a control the
creator turned off — without exposing the rest of the preferences.

## Profile insights

`GET /api/users/insights` returns the signed-in account's own numbers. Only the
owner can read them.

- **Totals** — posts, Reels, Circles, followers, following, Sparks, comments,
  saves, shares and Reel plays.
- **This week** — a seven-bar series of what the account published per day, plus
  posts / Reels / comments received in the last 7 days.
- **Top posts** — the five best-performing posts by Sparks, with their comment
  and save counts.

Nothing is a vanity metric: every figure is aggregated from `Post`, `Comment`
and `CircleItem`. `client/src/components/ProfileInsights.jsx` renders it and is
reused by both **Settings → Insights** and the **Insights** tab on your own
profile (the tab is hidden for other people's profiles).

## Connections — Joins & Following

Wchat's language for the social graph: **Joins** are the people who joined a
person's personal Circle, and **Following** are the people that account has
joined. Joining someone's personal Circle *is* following them, so the two counts
come from the same `followers` / `following` arrays.

`GET /api/users/:id/social` returns both counts, a short populated list for each
side, and whether **you** follow that profile — so a Join button can start in the
right state instead of always reading "Join".

- **Profile** — `ProfilePage` shows Posts · Circles · Joins · Following; tapping
  either count opens `client/src/components/ProfileSocial.jsx`, which lists the
  people and lets you join/leave them in place without leaving the profile.
- **Profile modal** — `ProfileModal` shows the same two counts on any member's
  profile (this is what you get when you tap a Circle message sender).
- Lists are capped at 200 people and expose only public profile fields, never
  email, phone or password.

## Appearance, notifications, privacy & data

Unchanged in behaviour, restyled to sit inside the new panel:

- **Appearance** — Light / Dark / Midnight, mirrored to the account.
- **Notifications** — activity (Sparks, comments, mentions) and message badge.
- **Privacy & safety** — read receipts, DMs from anyone, hidden words, blocked
  accounts.
- **Data & storage** — data saver, autoplay, highest-quality uploads.

## Endpoints used

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/me` | Personal details + preferences |
| `PUT` | `/api/auth/preferences` | Save appearance, notifications, privacy and sharing controls |
| `PUT` | `/api/auth/password` | Change the account password (current + new) |
| `GET` | `/api/auth/blocked` | Blocked accounts list |
| `GET` | `/api/users/insights` | Profile insights for the signed-in account |
| `GET` | `/api/users/:id/social` | Joins + Following counts, lists and whether you follow them |
| `POST` | `/api/users/:id/follow` | Join / leave a person's personal Circle |
| `POST` | `/api/circles/:chatId/items/:id/remix` | Reuse a Reel (honours `allowRemix`) |

## Verification

`smoke7.mjs` (in the temp workspace) covers the Account Center end to end — 28
checks: preference round-trip and validation, password change + restore,
insights shape, remix allow / deny / membership / non-reel, the public sharing
flags on feed and Reel authors, and the three `allowMentions` policies.

`smoke8.mjs` covers connections and the immersive surface — 30 checks, including
the `/users/:id/social` shape, the follow round-trip reflected in counts and
`/auth/me`, Circle joining, populated Circle senders, the Reels feed payload, and
the group-meeting signalling contract.
