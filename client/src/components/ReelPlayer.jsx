import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { isDataSaver } from '../utils/theme'

/** Effective runtime of one clip (trim window ÷ playback speed). */
export function clipDuration(clip) {
  if (!clip) return 0
  const end = clip.trimEnd || clip.duration || 0
  const start = clip.trimStart || 0
  const speed = clip.speed || 1
  return Math.max(0, (end - start) / speed)
}

/**
 * Plays a Reel made of one-or-more clips back-to-back, honouring each clip's
 * trim window, playback speed and filter, with timed text overlays on top.
 *
 * Clips are `{ src, duration, trimStart, trimEnd, speed, filter, muted }`.
 * `audio`, when present (`{ src }`), replaces the clips' own soundtrack.
 */
export default function ReelPlayer({
  clips = [],
  audio = null,
  overlays = [],
  filter = 'none',
  className = '',
  rounded = 'rounded-2xl',
  autoPlay = false,
  showControls = true,
  guides = false,
  editable = false,
  snap = true,
  /**
   * Immersive mode: the video grows to fill its container (`h-full`) and the
   * `fit` decides whether it is cropped (`cover`) or letterboxed (`contain`).
   */
  fill = false,
  fit = 'contain',
  onExpand,
  onOverlayMove,
  onEnded,
}) {
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const dragRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [ready, setReady] = useState(false)

  const total = useMemo(() => clips.reduce((sum, c) => sum + clipDuration(c), 0), [clips])
  const finished = clips.length === 0
  const current = clips[index]
  const fitClass = fit === 'cover' ? 'object-cover' : 'object-contain'

  const prefixDuration = useMemo(
    () => clips.slice(0, index).reduce((sum, c) => sum + clipDuration(c), 0),
    [clips, index]
  )

  const hasAudioTrack = Boolean(audio?.src)

  /* Apply source + clip settings whenever the active clip changes. */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !current) return
    setReady(false)
    video.src = current.src
    video.playbackRate = current.speed || 1
    video.load()
  }, [current?.src, index]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoaded = useCallback(() => {
    const video = videoRef.current
    if (!video || !current) return
    setReady(true)
    if (current.trimStart) {
      try {
        video.currentTime = current.trimStart
      } catch {
        /* not seekable yet */
      }
    }
    video.muted = Boolean(current.muted) || hasAudioTrack || muted
    if (playing || autoPlay) video.play().catch(() => setPlaying(false))
  }, [current, hasAudioTrack, muted, playing, autoPlay])

  /*
   * Play/pause as a Reel scrolls in and out of view (feed + full screen).
   * `autoPlay` is driven by an IntersectionObserver so only the visible Reel
   * has sound and motion; everything else is paused.
   */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !current) return
    if (autoPlay) {
      const attempt = video.play()
      if (attempt && typeof attempt.catch === 'function') {
        attempt
          .then(() => setPlaying(true))
          .catch(() => {
            // Browsers only auto-play muted media — retry with sound off.
            video.muted = true
            video
              .play()
              .then(() => setPlaying(true))
              .catch(() => {})
          })
      } else {
        setPlaying(true)
      }
      audioRef.current?.play().catch(() => {})
    } else {
      video.pause()
      audioRef.current?.pause()
      setPlaying(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, current?.src])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || !current) return
    const speed = current.speed || 1
    const end = current.trimEnd || current.duration || video.duration || 0
    setElapsed(prefixDuration + Math.max(0, (video.currentTime - (current.trimStart || 0)) / speed))

    if (end && video.currentTime >= end - 0.05) {
      if (index < clips.length - 1) {
        setIndex((i) => i + 1)
      } else {
        setPlaying(false)
        onEnded?.()
      }
    }
  }, [current, clips.length, index, prefixDuration, onEnded])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (playing) {
      video.pause()
      audioRef.current?.pause()
      setPlaying(false)
    } else {
      if (finished) {
        setIndex(0)
        setElapsed(0)
      }
      video.play().then(() => setPlaying(true)).catch(() => {})
      if (audioRef.current) audioRef.current.play().catch(() => {})
    }
  }, [playing, finished])

  /* External audio track playback. */
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.loop = true
    el.muted = muted
    if (playing) el.play().catch(() => {})
    else el.pause()
  }, [playing, muted, audio?.src])

  /* Restart from the top when the clip list changes (new upload). */
  useEffect(() => {
    setIndex(0)
    setElapsed(0)
    setPlaying(false)
  }, [clips.length])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = muted || hasAudioTrack || Boolean(current?.muted)
  }, [muted, hasAudioTrack, current?.muted])

  const visibleOverlays = overlays.filter(
    (o) => elapsed >= (o.start || 0) && (!o.end || elapsed <= o.end)
  )

  /* ---------------------------------------------------- overlay positioning */
  const clamp = (value) => Math.min(97, Math.max(3, value))

  const beginDrag = (event, overlay) => {
    if (!editable || !onOverlayMove) return
    const stage = event.currentTarget.closest('[data-reel-stage]')
    if (!stage) return
    event.preventDefault()
    dragRef.current = { id: overlay.id, rect: stage.getBoundingClientRect() }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveDrag = (event) => {
    const drag = dragRef.current
    if (!drag || !onOverlayMove) return
    const { rect } = drag
    let x = ((event.clientX - rect.left) / rect.width) * 100
    let y = ((event.clientY - rect.top) / rect.height) * 100
    if (snap) {
      ;[10, 50, 90].forEach((guide) => {
        if (Math.abs(x - guide) < 3) x = guide
        if (Math.abs(y - guide) < 3) y = guide
      })
    }
    onOverlayMove(drag.id, { x: clamp(x), y: clamp(y) })
  }

  const endDrag = () => {
    dragRef.current = null
  }

  return (
    <div
      data-reel-stage
      className={`relative overflow-hidden bg-black ${rounded} ${className}`}
    >
      {clips.length === 0 ? (
        <div
          className={`grid w-full place-items-center text-xs text-zinc-500 ${
            fill ? 'h-full' : 'aspect-[9/16] max-h-[70vh]'
          }`}
        >
          Nothing to preview yet
        </div>
      ) : (
        <video
          ref={videoRef}
          playsInline
          preload={isDataSaver() ? 'none' : 'auto'}
          onClick={togglePlay}
          onLoadedMetadata={handleLoaded}
          onTimeUpdate={handleTimeUpdate}
          className={`bg-black ${fitClass} ${
            fill ? 'h-full w-full' : 'max-h-[70vh] w-full'
          }`}
          style={{ filter: filter && filter !== 'none' ? filter : current?.filter || 'none' }}
        />
      )}

      {onExpand && clips.length > 0 ? (
        <button
          type="button"
          onClick={onExpand}
          title="Play full screen"
          aria-label="Play full screen"
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
        >
          <Maximize2 size={15} />
        </button>
      ) : null}

      {hasAudioTrack ? (
        <audio ref={audioRef} src={audio.src} preload="none" />
      ) : null}

      {/* Alignment guides — centre + rule-of-thirds lines */}
      {guides && clips.length > 0 ? (
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute inset-y-0 left-[33.33%] w-px bg-white/25" />
          <span className="absolute inset-y-0 left-[66.66%] w-px bg-white/25" />
          <span className="absolute inset-x-0 top-[33.33%] h-px bg-white/25" />
          <span className="absolute inset-x-0 top-[66.66%] h-px bg-white/25" />
          <span className="absolute inset-y-0 left-1/2 w-px bg-wchat/70" />
          <span className="absolute inset-x-0 top-1/2 h-px bg-wchat/70" />
        </div>
      ) : null}

      {/* Timed text overlays */}
      <div className={`absolute inset-0 ${editable ? '' : 'pointer-events-none'}`}>
        {visibleOverlays.map((o, i) => (
          <span
            key={o.id || i}
            onPointerDown={(event) => beginDrag(event, o)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`absolute max-w-[86%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap text-center font-extrabold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${
              editable ? 'cursor-grab touch-none active:cursor-grabbing' : ''
            }`}
            style={{
              left: `${o.x ?? 50}%`,
              top: `${o.y ?? 50}%`,
              color: o.color || '#fff',
              fontSize: `${o.size || 28}px`,
              textAlign: o.align || 'center',
            }}
          >
            {editable ? (
              <span className="pointer-events-none absolute -inset-1 rounded-md border border-dashed border-white/50" />
            ) : null}
            {o.text}
          </span>
        ))}
      </div>

      {showControls && !playing && clips.length > 0 ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 grid place-items-center bg-black/20"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-zinc-900 shadow-lg">
            <Play size={24} className="translate-x-0.5" />
          </span>
        </button>
      ) : null}

      {showControls && clips.length > 0 ? (
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-150"
              style={{ width: total ? `${Math.min(100, (elapsed / total) * 100)}%` : '0%' }}
            />
          </div>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      ) : null}

      {!ready && clips.length > 0 && playing === false ? null : null}
    </div>
  )
}
