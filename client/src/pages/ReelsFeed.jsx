import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  Clapperboard,
  Download,
  Loader2,
  Maximize2,
  Plus,
  Repeat2,
  Search,
  Send,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import api, { getApiError } from '../config/api'
import Avatar from '../components/Avatar'
import ReasonBadge from '../components/ReasonBadge'
import ReelComposer from '../components/ReelComposer'
import ReelPlayer from '../components/ReelPlayer'
import ReelsViewer from '../components/ReelsViewer'
import useReelActions from '../hooks/useReelActions'

const fieldClass =
  'w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-wchat/70'

function ReelCard({
  reel,
  onOpenProfile,
  onOpenHub,
  onRemixed,
  onExpand,
  playing,
  reason,
  reasonCode,
  detail,
}) {
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

  const cardRef = useRef(null)
  const [inView, setInView] = useState(false)

  // Autoplay only the Reel the reader is actually looking at.
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const authorName =
    `${author.firstName || ''} ${author.lastName || ''}`.trim() ||
    author.username ||
    'Member'
  const circleName = reel.chat?.chatName

  return (
    <article
      ref={cardRef}
      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-sm"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => onOpenProfile?.(author)}>
          <Avatar src={author.profilePicture} name={authorName} size={38} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{authorName}</p>
          <p className="truncate text-[11px] text-zinc-500">
            {circleName ? `${circleName} · ` : ''}
            {new Date(reel.createdAt).toLocaleDateString()}
            {reel.visibility === 'public' ? ' · Public' : ''}
          </p>
        </div>
      </div>

      <ReelPlayer
        clips={clips}
        audio={audio}
        overlays={overlays}
        filter={filter}
        rounded="rounded-none"
        autoPlay={playing && inView}
        onExpand={onExpand}
      />

      <div className="space-y-2.5 px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={spark}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-60 ${
              sparked ? 'text-wchat' : 'text-zinc-400 hover:text-wchat'
            }`}
          >
            <Sparkles size={18} className={sparked ? 'fill-current' : ''} />
            {sparks}
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={drop}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 transition hover:text-wchat"
            >
              <Send size={17} /> Drop
            </button>
          ) : (
            <span
              title="This creator has turned off sharing"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700"
            >
              <Send size={17} /> Drop
            </span>
          )}
          {canDownload ? (
            <button
              type="button"
              onClick={downloadReel}
              title="Download"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 transition hover:text-wchat"
            >
              <Download size={17} />
            </button>
          ) : null}
          {canRemix && reel.isMember ? (
            <button
              type="button"
              onClick={remix}
              disabled={remixBusy}
              title="Remix this Reel"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 transition hover:text-wchat"
            >
              {remixBusy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Repeat2 size={17} />
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleSave}
            title="Save"
            className={`ml-auto inline-flex items-center gap-1.5 text-sm font-semibold transition ${
              saved ? 'text-wchat' : 'text-zinc-400 hover:text-wchat'
            }`}
          >
            <Bookmark size={17} className={saved ? 'fill-current' : ''} />
          </button>
        </div>

        {reason ? <ReasonBadge code={reasonCode} detail={detail} reason={reason} /> : null}

        <h3 className="text-sm font-semibold text-zinc-100">{reel.title}</h3>
        {reel.description ? (
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-400">
            {reel.description}
          </p>
        ) : null}
        {tags.length ? (
          <p className="flex flex-wrap gap-1.5">
            {tags.slice(0, 6).map((tag) => (
              <span key={tag} className="text-[11px] font-medium text-wchat">
                #{String(tag).replace(/^#/, '')}
              </span>
            ))}
          </p>
        ) : null}

        {reel.chat?._id ? (
          <div className="mt-1">
            {joined ? (
              <button
                type="button"
                onClick={() => onOpenHub?.(reel.chat)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-wchat/60 hover:text-white"
              >
                <Users size={13} /> Open {reel.chat.chatName || 'Circle'}
              </button>
            ) : (
              <button
                type="button"
                onClick={joinCircle}
                disabled={joinBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-60"
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
    </article>
  )
}

export default function ReelsFeed({ onOpenProfile, onOpenHub, onError }) {
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [scope, setScope] = useState('for-you')
  const [composing, setComposing] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(-1)

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
      setReels(Array.isArray(data) ? data : [])
    } catch (error) {
      onError?.(getApiError(error, 'Could not load Reels'))
      setReels([])
    } finally {
      setLoading(false)
    }
  }, [term, scope, onError])

  useEffect(() => {
    load()
  }, [load])

  const openViewer = (id) => {
    const index = reels.findIndex((reel) => reel._id === id)
    setViewerIndex(index < 0 ? 0 : index)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <header className="border-b border-zinc-800/80 px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <Clapperboard size={20} className="text-wchat" />
          <h1 className="flex-1 text-base font-bold text-zinc-100">Reels</h1>
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-wchat px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            <Plus size={14} /> Create
          </button>
        </div>

        <div className="mx-auto mt-3 flex max-w-xl items-center gap-2">
          <div className="flex rounded-xl bg-zinc-800/60 p-0.5">
            {[
              { id: 'for-you', label: 'For you' },
              { id: 'discover', label: 'Discover' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setScope(option.id)}
                className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition ${
                  scope === option.id
                    ? 'bg-zinc-950 text-zinc-100 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {reels.length > 0 ? (
            <button
              type="button"
              onClick={() => openViewer(reels[0]?._id)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-wchat/60 hover:text-white"
            >
              <Maximize2 size={13} /> Immersive
            </button>
          ) : null}
        </div>

        <div className="relative mx-auto mt-2 max-w-xl">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Reels, captions or #hashtags"
            className={`${fieldClass} pl-9`}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-500">
            <div className="spinner" />
            <p className="text-sm">Loading Reels…</p>
          </div>
        ) : reels.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Clapperboard size={30} className="text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">No Reels yet</p>
            <p className="max-w-xs text-xs text-zinc-600">
              Reels shared in your Circles show up here — and public ones reach
              everyone. Create the first one!
            </p>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-wchat px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus size={14} /> Create a Reel
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-xl flex-col gap-5">
            {reels.map((reel) => (
              <ReelCard
                key={reel._id}
                reel={reel}
                playing={viewerIndex < 0}
                onExpand={() => openViewer(reel._id)}
                onOpenProfile={onOpenProfile}
                onOpenHub={onOpenHub}
                onRemixed={load}
                reason={reel.reason}
                reasonCode={reel.reasonCode}
                detail={reel.reasonDetail}
              />
            ))}
          </div>
        )}
      </div>

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
          onCreated={(created) => setReels((prev) => [created, ...prev])}
        />
      ) : null}
    </div>
  )
}
