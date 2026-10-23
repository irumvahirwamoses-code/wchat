# Wchat Reels

Reels are short vertical videos. They live inside **Circles** (a Reel is a
`CircleItem` with `kind: 'reel'`) and, when shared publicly, they also surface on
the Reels feed and in Explore.

## Where Reels live

| Surface | File | What it does |
|---|---|---|
| Reels tab | `client/src/pages/ReelsFeed.jsx` | Vertical, snap-scrolling feed of public Reels |
| Circle hub | `CircleHub` → Reels section | Reels posted inside one Circle |
| Editor | `client/src/components/ReelComposer.jsx` | Record / upload / arrange / style / publish |
| Player | `client/src/components/ReelPlayer.jsx` | Playback, overlays, filters, and inline editing |

## Data model — `CircleItem`

| Field | Meaning |
|---|---|
| `kind` | `'reel'` for Reels |
| `title`, `description` | Caption shown under the Reel |
| `media` | First clip's upload path (kept for compatibility) |
| `mediaItems[]` | Raw ordered list of uploaded file paths |
| `clips[]` | Per-clip edit data: `media`, `duration`, `trimStart`, `trimEnd`, `speed`, `filter`, `muted` |
| `cover` / `coverTime` | Cover image, or the second of the video to grab the frame from |
| `speed` | Playback multiplier applied on top of each clip's speed |
| `filter` | Named visual filter (maps to a CSS filter on the client) |
| `audio` | `{ url, title, startAt, volume }` — music bed or voiceover |
| `overlays[]` | Timed text: `text, x, y, start, end, color, size, align` |
| `hashtags[]` | Drives Reels / Explore discovery |
| `durationSec` | Total runtime after trimming and speed |
| `clips[]` | Per-clip trim / speed / filter / mute state |
| `visibility` | `circle` (default) or `public` |
| `remixOf` | Set when this Reel remixes someone else's |

The editor sends the whole configuration as a `reel` JSON field on
`POST /api/circles/:chatId/items` (multipart, one file per clip), and the server
stores it verbatim. Trim, speed and filters are **non-destructive** — the
original upload is kept and the client applies the edits at playback.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/circles/feed/reels?search=` | Public Reels feed for Explore / the Reels tab |
| `GET` | `/api/circles/:chatId/items?kind=reel` | Reels inside one Circle |
| `POST` | `/api/circles/:chatId/items` | Publish a Reel (multipart, `reel` JSON) |
| `DELETE` | `/api/circles/items/:id` | Delete your Reel (author only) |

## Editing tools

### Multi-clip timeline
Record or upload any number of clips, then reorder them, trim each one, change
per-clip speed, and mute individual clips. `trimStart` / `trimEnd` are stored on
the clip, so playback loops only the selected slice.

### Cover frame
Scrub the preview and pick the second used as the cover (`coverTime`), or upload
a custom cover image.

### Filters and speed
A named filter set (CSS filter applied on the player) plus a playback speed
multiplier, layered on top of each clip's own speed.

### Audio
Keep the recorded audio ("original"), add a music bed, or record a voiceover.
The bed has its own start offset and volume.

### Text overlays
Add timed text that fades in and out over a range of the Reel. Each overlay has a
position, colour, size and alignment.

### Align tool
Positioning overlays pixel-precisely:
- a 9-point grid (top-left → bottom-right) for instant placement,
- fine `x` / `y` sliders,
- drag the overlay directly on the preview,
- optional rule-of-thirds guides and snapping to the grid / centre.

### Hands-free recording
- a **countdown timer** (3 / 5 / 10 seconds) before recording starts, so you can
  get into frame,
- **hands-free** mode that auto-stops each clip after a chosen length by setting
  its `trimEnd`.

### Templates
One-tap starter presets that seed a filter, overlay style and caption, so a Reel
looks composed without starting from a blank canvas.

### Auto-captions
Type or dictate a script and the editor spreads it evenly across the clips as
timed text overlays — a quick route to captions without a speech-to-text service.
Dictation uses the browser's built-in speech recognition when available.

## Publish

Publishing asks for a title, optional description, hashtags, and a visibility
choice:

- **Circle only** (default) — appears in the Circle's Reels section.
- **Public** — also reaches the Reels feed and Explore.

Both the raw clips and the full editor configuration are stored, so a Reel can be
re-opened and edited again later without losing the timeline.

## Playback

`ReelPlayer` walks the clip list in order, applying each clip's trim range and
speed, then the global speed, filter and audio bed. Text overlays fade in and out
against the running time.

### Autoplay

A Reel plays **as soon as it is what you are looking at** and stops when it
scrolls away. `client/src/hooks/useReelActions.js` holds everything a Reel can do
so the card and the full-screen viewer stay in sync, and the feed drives
`autoPlay` from an `IntersectionObserver` on each card — only one Reel ever has
motion and sound. If the browser refuses an unmuted start, the player retries
muted, which is always allowed.

### Full-window ("immersive") viewing

Every card has an expand button, and the feed header has **Immersive**.
`client/src/components/ReelsViewer.jsx` takes over the whole viewport:

- Each Reel is a `h-full` section in a `snap-y snap-mandatory` scroller, so the
  video fills the window (`fit="cover"`) instead of sitting in a card.
- An IntersectionObserver on the scroller marks the centred Reel as `active`, so
  swiping vertically moves the autoplay with you — the other Reels are paused and
  unloaded from the `video` element.
- Overlays keep the creator header, caption, hashtags, the action rail
  (Spark / Save / Drop / Download / Remix) and the Circle join button, so a Reel
  is just as actionable full-screen as it is in the feed.
- `↑` / `↓` page between Reels on desktop, `Esc` closes.

The viewer is `z-40`, deliberately below modals (`z-50`), so tapping a creator
still opens their profile on top of it.
