import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Plus,
  Repeat2,
  Search,
  Send,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import Seo from '../components/Seo'
import api, { getApiError } from '../config/api'
import Avatar from '../components/Avatar'
import ReasonBadge from '../components/ReasonBadge'
import ReelComposer from '../components/ReelComposer'
import ReelPlayer from '../components/ReelPlayer'
import ReelsViewer from '../components/ReelsViewer'
import useReelActions from '../hooks/useReelActions'

function RailButton({ icon: Icon, label, active, busy, disabled, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={title || label}
      className="flex flex-col items-center gap-1 text-white disabled:opacity-50"
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur transition active:scale-95 sm:h-12 sm:w-12 ${
          active ? 'text-wchat' : 'text-white hover:bg-black/60'
        }`}
      >
        {busy ? <Loader2 size={20} className="animate-spin" /> : <Icon size={21} />}
      </span>
      {label != null ? (
        <span className="text-[11px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,.8)]">{label}</span>
      ) : null}
    </button>
  )
}

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

      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {reel.reason ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-16">
          <div className="pointer-events-auto">
            <ReasonBadge code={reel.reasonCode} detail={reel.reasonDetail} reason={reel.reason} className="border-white/15 bg-black/35 text-white backdrop-blur" />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenProfile?.(author)}
        className="absolute left-3 top-3 z-10 flex max-w-[72%] items-center gap-2.5 text-left sm:left-4 sm:top-4"
      >
        <Avatar src={author.profilePicture} frame={author.profilePictureFrame} name={authorName} size={40} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white drop-shadow">{authorName}</span>
          <span className="block truncate text-[11px] text-white/75">
            {reel.chat?.chatName ? `${reel.chat.chatName} · ` : ''}
            {reel.visibility === 'public' ? 'Public' : 'Circle'}
          </span>
        </span>
      </button>

      <div className="absolute bottom-28 right-2 z-10 flex flex-col items-center gap-4 sm:right-3 sm:bottom-24">
        {reel.isExternal ? (
          <RailButton
            icon={ExternalLink}
            label="Open"
            onClick={() => {
              const url = reel.source?.url || reel.source?.authorUrl
              if (url) window.open(url, '_blank', 'noopener,noreferrer')
            }}
            title={reel.source?.url ? `View on ${reel.source.provider || 'source'}` : 'Open source'}
          />
        ) : (
          <>
            <RailButton icon={Sparkles} label={String(sparks)} active={sparked} busy={busy} onClick={spark} title={sparked ? 'Remove Spark' : 'Spark'} />
            <RailButton icon={Bookmark} label="Save" active={saved} onClick={toggleSave} title="Save" />
            {canShare ? <RailButton icon={Send} label="Drop" onClick={drop} title="Share" /> : null}
            {canDownload ? <RailButton icon={Download} label="Get" onClick={downloadReel} title="Download" /> : null}
            {canRemix && reel.isMember ? <RailButton icon={Repeat2} label="Remix" busy={remixBusy} onClick={remix} title="Remix" /> : null}
          </>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-5 sm:px-4 sm:pb-6">
        <div className="max-w-[78%] space-y-2">
          {reel.chat?._id ? (
            joined ? (
              <button
                type="button"
                onClick={() => onOpenHub?.(reel.chat)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur"
              >
                <Users size={12} /> {reel.chat.chatName || 'Circle'} · Open
              </button>
            ) : (
              <button
                type="button"
                onClick={joinCircle}
                disabled={joinBusy}
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--wchat-primary)] px-3 py-1 text-[11px] font-bold text-white shadow-glow disabled:opacity-60"
              >
                {joinBusy ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                {reel.chat.joinPolicy === 'request' ? 'Request to join' : `Join ${reel.chat.chatName || 'Circle'}`}
              </button>
            )
          ) : null}
          <h2 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-white drop-shadow">{reel.title || 'Reel'}</h2>
          {reel.description ? (
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/90">{reel.description}</p>
          ) : null}
          {tags.length ? (
            <p className="flex flex-wrap gap-x-2 gap-y-0.5">
              {tags.slice(0, 6).map((tag) => (
                <span key={tag} className="text-[12px] font-semibold text-[color:var(--landing-blue-glow)]">#{String(tag).replace(/^#/, '')}</span>
              ))}
            </p>
          ) : null}
          {reel.audio?.title || reel.audio?.name ? (
            <p className="truncate text-[11px] text-white/70">♪ {reel.audio.title || reel.audio.name}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/**
 * Immersive Reels tab: full-height snap slides, only the slide in view plays.
 * Preserves existing feed APIs/actions (Spark/Save/Drop/Remix/Join) and composer.
 */
export default function ReelsFeed({ onOpenProfile, onOpenHub, onError }) {
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [scope, setScope] = useState('for-you')
  const [composing, setComposing] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(-1)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef(null)
  const slideRefs = useRef([])

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (term.trim()) params.search = term.trim()
      if (scope === 'discover') params.scope = 'discover'
      const { data } = await api.get('/circles/feed/reels', { params })
      const next = Array.isArray(data) ? data : []
      setReels(next)
      setActiveIndex(0)
      containerRef.current?.scrollTo?.({ top: 0 })
    } catch (error) {
      onError?.(getApiError(error, 'Could not load Reels'))
      setReels([])
    } finally {
      setLoading(false)
    }
  }, [term, scope, onError])

  useEffect(() => { load() }, [load])

  // Only the Reel crossing the feed viewport plays (fixes "previous reel still playing").
  useEffect(() => {
    const container = containerRef.current
    if (!container || !reels.length || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        let best = null
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const idx = Number(entry.target.dataset.index)
          if (!best || entry.intersectionRatio > best.ratio) best = { idx, ratio: entry.intersectionRatio }
        }
        if (best && best.ratio >= 0.55) setActiveIndex(best.idx)
      },
      { root: container, threshold: [0, 0.35, 0.55, 0.75, 1] }
    )
    slideRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [reels])

  useEffect(() => {
    const onKey = (e) => {
      if (viewerIndex >= 0 || composing || showSearch) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const next = Math.min(reels.length - 1, Math.max(0, activeIndex + (e.key === 'ArrowDown' ? 1 : -1)))
      slideRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, reels.length, viewerIndex, composing, showSearch])

  const openViewer = (id) => {
    const index = reels.findIndex((reel) => reel._id === id)
    setViewerIndex(index < 0 ? 0 : index)
  }

  const pager = useMemo(() => ({ prev: Math.max(0, activeIndex - 1), next: Math.min(reels.length - 1, activeIndex + 1) }), [activeIndex, reels.length])

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[var(--landing-reel,#120b2e)] text-white">
      <Seo
        title="Reels | Wchat"
        description="Short videos from your Circles and communities. Spark, Save, Drop, Remix, and join Circles straight from the feed."
        path="/reels"
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 pt-3 sm:px-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="flex gap-4 rounded-full bg-black/25 px-3 py-1.5 text-[13px] font-bold backdrop-blur">
            {[
              { id: 'for-you', label: 'For you' },
              { id: 'discover', label: 'Discover' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScope(tab.id)}
                className={`pb-0.5 transition ${scope === tab.id ? 'border-b-2 border-white text-white' : 'text-white/65 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setShowSearch((v) => !v)} aria-label="Search Reels" className="grid h-9 w-9 place-items-center rounded-full bg-black/30 text-white backdrop-blur hover:bg-black/50">
            {showSearch ? <X size={18} /> : <Search size={18} />}
          </button>
          {reels.length > 0 ? (
            <button type="button" onClick={() => openViewer(reels[activeIndex]?._id)} aria-label="Immersive view" title="Immersive" className="grid h-9 w-9 place-items-center rounded-full bg-black/30 text-white backdrop-blur hover:bg-black/50">
              <Maximize2 size={17} />
            </button>
          ) : null}
          <button type="button" onClick={() => setComposing(true)} aria-label="Create a Reel" className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--wchat-primary)] text-white shadow-glow hover:brightness-110">
            <Camera size={18} />
          </button>
        </div>
      </header>

      {showSearch ? (
        <div className="absolute inset-x-0 top-14 z-20 px-3 sm:px-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Reels, captions or #hashtags"
            className="h-10 w-full rounded-xl border border-white/15 bg-black/45 px-3 text-sm text-white placeholder-white/55 outline-none backdrop-blur focus:border-[color:var(--wchat-primary)]/60"
            autoFocus
          />
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="scrollbar-none h-full snap-y snap-mandatory overflow-y-auto overscroll-contain lg:mx-auto lg:max-w-[460px]"
      >
        {loading ? (
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-3 text-white/70">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Loading Reels…</p>
            </div>
          </div>
        ) : reels.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><Sparkles size={26} className="text-white/80" /></span>
              <p className="text-base font-bold text-white">No Reels yet</p>
              <p className="max-w-xs text-sm text-white/65">Public Reels and Reels from your Circles show up here. Create the first one.</p>
              <button type="button" onClick={() => setComposing(true)} className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--wchat-primary)] px-4 py-2.5 text-sm font-bold text-white">
                <Plus size={15} /> Create a Reel
              </button>
            </div>
          </div>
        ) : (
          reels.map((reel, index) => (
            <div
              key={reel._id}
              data-index={index}
              ref={(el) => { slideRefs.current[index] = el }}
              className="h-full w-full snap-start snap-always"
            >
              <ReelSlide
                reel={reel}
                active={index === activeIndex && viewerIndex < 0}
                onOpenProfile={onOpenProfile}
                onOpenHub={onOpenHub}
                onRemixed={load}
              />
            </div>
          ))
        )}
      </div>

      {!loading && reels.length > 1 ? (
        <div className="pointer-events-none absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
          <button type="button" onClick={() => slideRefs.current[pager.prev]?.scrollIntoView({ behavior: 'smooth', block: 'start' })} disabled={activeIndex === 0} className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur disabled:opacity-30"><ChevronUp size={18} /></button>
          <button type="button" onClick={() => slideRefs.current[pager.next]?.scrollIntoView({ behavior: 'smooth', block: 'start' })} disabled={activeIndex >= reels.length - 1} className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur disabled:opacity-30"><ChevronDown size={18} /></button>
        </div>
      ) : null}

      {viewerIndex >= 0 ? (
        <ReelsViewer
          reels={reels}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(-1)}
          onOpenProfile={onOpenProfile}
          onOpenHub={onOpenHub}
          onRemixed={load}
        />
      ) : null}

      {composing ? (
        <ReelComposer
          onClose={() => setComposing(false)}
          onCreated={(created) => { setReels((prev) => [created, ...prev]); setActiveIndex(0); containerRef.current?.scrollTo?.({ top: 0 }) }}
        />
      ) : null}
    </div>
  )
}
