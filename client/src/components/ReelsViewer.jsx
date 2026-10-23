import { useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Repeat2,
  Send,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import Avatar from './Avatar'
import ReelPlayer from './ReelPlayer'
import useReelActions from '../hooks/useReelActions'

function RailButton({ icon: Icon, label, active, busy, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title || label}
      className="flex flex-col items-center gap-1 text-white disabled:opacity-60"
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur transition ${
          active ? 'text-wchat' : 'text-white hover:bg-black/65'
        }`}
      >
        {busy ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}
      </span>
      <span className="text-[11px] font-semibold drop-shadow">{label}</span>
    </button>
  )
}

/** One full-viewport Reel with its overlay header, rail and caption. */
function ReelSlide({ reel, active, onOpenProfile, onOpenHub, onRemixed }) {
  const {
    author,
    clips,
    audio,
    overlays,
    filter,
    tags,
    canShare,
    canDownload,
    canRemix,
    sparks,
    sparked,
    saved,
    busy,
    remixBusy,
    joined,
    joinBusy,
    spark,
    remix,
    drop,
    downloadReel,
    joinCircle,
    toggleSave,
  } = useReelActions(reel, onRemixed)

  const authorName =
    `${author.firstName || ''} ${author.lastName || ''}`.trim() ||
    author.username ||
    'Member'

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      <ReelPlayer
        clips={clips}
        audio={audio}
        overlays={overlays}
        filter={filter}
        rounded="rounded-none"
        className="h-full w-full"
        fill
        fit="cover"
        autoPlay={active}
        showControls={false}
      />

      {/* Legibility gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      {/* Author */}
      <button
        type="button"
        onClick={() => onOpenProfile?.(author)}
        className="absolute left-4 top-4 flex items-center gap-2.5 pr-14 text-left"
      >
        <Avatar src={author.profilePicture} name={authorName} size={40} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">
            {authorName}
          </span>
          <span className="block truncate text-[11px] text-white/70">
            {reel.chat?.chatName ? `${reel.chat.chatName} · ` : ''}
            {new Date(reel.createdAt).toLocaleDateString()}
            {reel.visibility === 'public' ? ' · Public' : ''}
          </span>
        </span>
      </button>

      {/* Action rail */}
      <div className="absolute bottom-36 right-3 flex flex-col items-center gap-4">
        <RailButton
          icon={Sparkles}
          label={String(sparks)}
          active={sparked}
          busy={busy}
          onClick={spark}
          title={sparked ? 'Remove Spark' : 'Spark'}
        />
        <RailButton
          icon={Bookmark}
          label="Save"
          active={saved}
          onClick={toggleSave}
          title="Save"
        />
        {canShare ? (
          <RailButton icon={Send} label="Drop" onClick={drop} title="Share" />
        ) : null}
        {canDownload ? (
          <RailButton
            icon={Download}
            label="Save"
            onClick={downloadReel}
            title="Download to device"
          />
        ) : null}
        {canRemix && reel.isMember ? (
          <RailButton
            icon={Repeat2}
            label="Remix"
            busy={remixBusy}
            onClick={remix}
            title="Remix this Reel"
          />
        ) : null}
      </div>

      {/* Caption + Circle */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-8">
        <div className="max-w-[78%]">
          <h2 className="text-sm font-bold text-white drop-shadow">{reel.title}</h2>
          {reel.description ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/85">
              {reel.description}
            </p>
          ) : null}
          {tags.length ? (
            <p className="mt-1.5 flex flex-wrap gap-2">
              {tags.slice(0, 6).map((tag) => (
                <span key={tag} className="text-[11px] font-semibold text-wchat">
                  #{String(tag).replace(/^#/, '')}
                </span>
              ))}
            </p>
          ) : null}

          {reel.chat?._id ? (
            <div className="mt-3">
              {joined ? (
                <button
                  type="button"
                  onClick={() => onOpenHub?.(reel.chat)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:border-white/60"
                >
                  <Users size={13} /> Open {reel.chat.chatName || 'Circle'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={joinCircle}
                  disabled={joinBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:brightness-105 disabled:opacity-60"
                >
                  {joinBusy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <UserPlus size={13} />
                  )}
                  {reel.chat.joinPolicy === 'request'
                    ? 'Request to join'
                    : `Join ${reel.chat.chatName || 'Circle'}`}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/**
 * Immersive, full-window Reels player. Each Reel occupies the whole viewport
 * and scroll-snaps vertically; only the Reel in view autoplays. Mirrors the
 * short-video experience while keeping the feed's action semantics.
 */
export default function ReelsViewer({
  reels = [],
  startIndex = 0,
  onClose,
  onOpenProfile,
  onOpenHub,
  onRemixed,
}) {
  const containerRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(Math.max(0, startIndex))

  // Jump to the Reel the viewer was opened from.
  useEffect(() => {
    const container = containerRef.current
    if (!container || startIndex <= 0) return
    const slide = container.children[startIndex]
    slide?.scrollIntoView({ block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autoplay only the Reel crossing the centre of the viewport.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActiveIndex(Number(entry.target.dataset.index))
          }
        })
      },
      { root: container, threshold: [0, 0.6, 1] }
    )
    Array.from(container.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [reels.length])

  // Keyboard: up/down to move, Escape to close.
  useEffect(() => {
    const handleKey = (event) => {
      const container = containerRef.current
      if (!container) return
      if (event.key === 'Escape') {
        onClose?.()
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const next = Math.min(
          reels.length - 1,
          Math.max(0, activeIndex + (event.key === 'ArrowDown' ? 1 : -1))
        )
        container.children[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeIndex, reels.length, onClose])

  const scrollTo = (index) => {
    containerRef.current?.children[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {reels.map((reel, index) => (
          <ReelSlide
            key={reel._id}
            reel={reel}
            active={index === activeIndex}
            onOpenProfile={onOpenProfile}
            onOpenHub={onOpenHub}
            onRemixed={onRemixed}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        title="Close"
        aria-label="Close Reels"
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
      >
        <X size={18} />
      </button>

      {/* Desktop paging controls */}
      <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
        <button
          type="button"
          onClick={() => scrollTo(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
          title="Previous"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-30"
        >
          <ChevronUp size={18} />
        </button>
        <button
          type="button"
          onClick={() => scrollTo(Math.min(reels.length - 1, activeIndex + 1))}
          disabled={activeIndex >= reels.length - 1}
          title="Next"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-30"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {reels.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <Users size={26} />
            <p className="text-sm">No Reels to play</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
