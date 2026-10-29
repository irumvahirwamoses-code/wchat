# Wchat promo reel — “Where chats become communities”

This document is the script, storyboard, and export instructions for the short ad-style reel embedded in `client/src/components/PromoReel.jsx` and shown on the public landing page.

## Deliverable
- Component: `client/src/components/PromoReel.jsx`
- Page: `client/src/pages/LandingPage.jsx`
- Route: `/` for signed-out visitors; signed-in visitors still go to the app
- Format: animated 9:16 browser reel, about 24 seconds, auto-looping, play/pause/restart controls, reduced-motion safe

No `ffmpeg` is installed in this environment, so no MP4 file was generated. To publish the reel on TikTok/Instagram/YouTube Shorts, record the component at 1080×1920 and export as MP4 using the instructions below.

## Voiceover script
(Optional female/energetic voice, ~24 seconds)

1. “Chats become communities.”  
2. “Create a Circle for your team, class, neighborhood, or interest.”  
3. “Invite anyone in seconds with a link or QR code.”  
4. “Open Circles join instantly; request Circles await your approval.”  
5. “Chat and call in real time.”  
6. “Share Reels, Stories, and Library content.”  
7. “Spark posts, join activities, and vote in Circle decisions.”  
8. “One place for your people. Create your Circle on Wchat today.”

## Scene storyboard
| Time | Scene | On-screen title | On-screen caption | Icon |
|------|-------|-----------------|-------------------|------|
| 0–4s | 1 | Chats become communities | Create a Circle for your team, class, neighborhood, or interest. | Users |
| 4–8s | 2 | Invite anyone in seconds | Share a link or QR code. Open Circles join instantly; request Circles await approval. | Share2 |
| 8–12s | 3 | Chat and call in real time | Group messaging, reactions, and WebRTC calls inside every Circle. | MessageCircle |
| 12–16s | 4 | Reels, Stories, and Library | Short videos, disappearing stories, documents, events, challenges, and opportunities. | Film |
| 16–20s | 5 | Spark, join, and decide | Members react with Sparks, join activities, and vote in Circle decisions. | Zap |
| 20–24s | 6 | One place for your people | Create your Circle and add others today on Wchat. | Users |

## How to record and export an MP4
1. Start the app locally: `cd client && npm run dev`, then open `http://localhost:5173` (or open the deployed landing page).
2. Resize the browser/recording area to 1080×1920 vertical, centered on the `PromoReel` section.
3. Enable “Play” if the reel is not auto-playing.
4. Record the full 24-second loop with a screen recorder.
   - Windows: Xbox Game Bar (`Win + Alt + R`) or OBS Studio.
   - macOS: QuickTime Player → File → New Screen Recording.
   - Linux: OBS Studio or `ffmpeg` screen capture.
5. Crop/export to 1080×1920 MP4 if your recorder does not do it automatically.
6. If you have `ffmpeg`, a simple crop command is:
   ```bash
   ffmpeg -i recording.mp4 -vf "crop=1080:1920:0:0" -c:a copy promo-reel.mp4
   ```
   Adjust the crop offset to match the recorded reel position.
7. Publish `promo-reel.mp4` as a short/ad reel with the landing page URL in the caption.

## Accessibility notes
- The component respects `prefers-reduced-motion` by simplifying animation.
- Play/pause/restart controls are keyboard accessible and labeled.
- Captions are included in the component; use the voiceover script above for audio.
