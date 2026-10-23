import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Heart, MapPin, MessageCircle, Pin, Share2, Bookmark, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import ReasonBadge from './ReasonBadge'
import api, { getApiError } from '../config/api'
import { getFileUrl, getId } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { formatHandle } from '../utils/handle'
import { formatTime } from '../utils/api'

/** Renders the caption with #hashtags / @mentions highlighted (not clickable to a dead route). */
function Caption({ text, max = 400 }) {
  const short = text.length > max ? `${text.slice(0, max)}…` : text
  const parts = short.split(/([#@][\p{L}\p{N}_]+)/gu)
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
      {parts.map((p, i) =>
        p.startsWith('#') || p.startsWith('@') ? (
          <span key={i} className="font-medium text-sky-400">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  )
}

/** Swipeable carousel (photos + videos) with dots and arrows. */
function Carousel({ items }) {
  const [idx, setIdx] = useState(0)
  const total = items.length

  useEffect(() => {
    if (idx > total - 1) setIdx(Math.max(0, total - 1))
  }, [idx, total])

  if (total === 1) {
    const only = items[0]
    return only.type === 'video' ? (
      <video controls src={getFileUrl(only.url)} className="max-h-[80vh] w-full bg-black" />
    ) : (
      <img
        src={getFileUrl(only.url)}
        alt={only.fileName || 'Post'}
        className="max-h-[80vh] w-full object-cover"
      />
    )
  }

  const item = items[idx]

  return (
    <div className="relative bg-black">
      {item.type === 'video' ? (
        <video key={item.url} controls src={getFileUrl(item.url)} className="max-h-[80vh] w-full" />
      ) : (
        <img
          key={item.url}
          src={getFileUrl(item.url)}
          alt={item.fileName || 'Post'}
          className="max-h-[80vh] w-full object-contain"
        />
      )}

      {idx > 0 ? (
        <button
          type="button"
          aria-label="Previous item"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          className="absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          <ChevronLeft size={16} />
        </button>
      ) : null}
      {idx < total - 1 ? (
        <button
          type="button"
          aria-label="Next item"
          onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          <ChevronRight size={16} />
        </button>
      ) : null}

      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
        {idx + 1}/{total}
      </span>

      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {items.map((it, i) => (
          <button
            key={it.url + i}
            type="button"
            aria-label={`Go to item ${i + 1}`}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function PostCard({ post, onCommentClick, onDeleted, showReason = false }) {
  const { user } = useAuth()
  const author = post.author || {}
  const circle = post.circle || null
  const authorName =
    `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username
  const isMine = getId(author) === user?._id

  // Sharing & reuse — the author decides what others may do with their content.
  // Missing preferences default to allowed (older accounts).
  const authorPrefs = author?.preferences || {}
  const canDownload = isMine || authorPrefs.allowDownload !== false
  const canShare = isMine || authorPrefs.allowShareToStories !== false

  const items = post.items || (post.media ? [{ url: post.media, type: post.mediaType || 'image', fileName: post.fileName }] : [])

  const [sparks, setSparks] = useState(post.sparkCount ?? (post.sparks || []).length)
  const [sparked, setSparked] = useState(
    (post.sparks || []).some((id) => getId(id) === user?._id)
  )
  const [saved, setSaved] = useState(
    (post.savedBy || []).some((id) => getId(id) === user?._id)
  )
  const [pinned, setPinned] = useState(Boolean(post.pinnedAt))
  const [busy, setBusy] = useState(false)

  const spark = async () => {
    setBusy(true)
    try {
      const { data } = await api.post(`/posts/${post._id}/spark`)
      setSparked(data.sparked)
      setSparks(data.sparkCount)
    } catch (error) {
      toast.error(getApiError(error, 'Could not save your Spark'))
    } finally {
      setBusy(false)
    }
  }

  const toggleSave = async () => {
    setSaved((s) => !s)
    try {
      const { data } = await api.post(`/posts/${post._id}/save`)
      setSaved(data.saved)
      toast.success(data.saved ? 'Saved to your collection' : 'Removed from saved')
    } catch (error) {
      setSaved((s) => !s)
      toast.error(getApiError(error, 'Could not save'))
    }
  }

  const togglePin = async () => {
    setBusy(true)
    try {
      const { data } = await api.post(`/posts/${post._id}/pin`)
      setPinned(data.pinned)
      toast.success(data.pinned ? 'Pinned to your profile' : 'Unpinned')
    } catch (error) {
      toast.error(getApiError(error, 'Could not pin'))
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (!confirm('Delete this post?')) return
    setBusy(true)
    try {
      await api.delete(`/posts/${post._id}`)
      onDeleted?.(post._id)
      toast.success('Post deleted')
    } catch (error) {
      toast.error(getApiError(error, 'Could not delete'))
    } finally {
      setBusy(false)
    }
  }

  const download = async (item) => {
    const url = getFileUrl(item.url)
    const name = item.fileName || `wchat-${post._id}`
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Could not fetch the media')
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
      toast.success('Saved to your device')
    } catch {
      // Cross-origin download — fall back to opening the file.
      window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <article className="mx-auto mb-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
      <header className="flex items-center gap-3 p-4">
        <Avatar src={author.profilePicture} name={authorName} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {authorName}{' '}
            <span className="text-xs font-normal text-zinc-500">
              {formatHandle(author.username)}
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-zinc-500">
            <span>{formatTime(post.createdAt)}</span>
            {circle ? (
              <>
                <span>·</span>
                <span className="font-medium text-zinc-400">{circle.chatName}</span>
              </>
            ) : null}
            {post.location ? (
              <>
                <span>·</span>
                <MapPin size={11} className="inline" />
                <span>{post.location}</span>
              </>
            ) : null}
            {pinned ? (
              <>
                <span>·</span>
                <Pin size={11} className="inline text-amber-300" />
              </>
            ) : null}
          </p>
        </div>
        {isMine ? (
          <>
            <button
              type="button"
              onClick={togglePin}
              disabled={busy}
              title={pinned ? 'Unpin' : 'Pin to profile (max 6)'}
              className={`rounded-md p-1.5 transition hover:bg-zinc-800 ${
                pinned ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Pin size={16} />
            </button>
            <button
              type="button"
              onClick={del}
              disabled={busy}
              title="Delete post"
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-300"
            >
              <Trash2 size={16} />
            </button>
          </>
        ) : null}
      </header>

      {showReason && post.reason ? (
        <ReasonBadge
          className="px-4 pb-2"
          reason={post.reason}
          code={post.reasonCode}
          detail={post.reasonDetail}
        />
      ) : null}

      {post.text ? (
        <div className="px-4 pb-3">
          <Caption text={post.text} />
        </div>
      ) : null}

      {items.length ? <Carousel items={items} /> : null}

      <footer className="flex items-center gap-4 px-4 py-2.5">
        <button
          type="button"
          onClick={spark}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 text-xs ${
            sparked ? 'text-wchat' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Heart size={18} fill={sparked ? '#245bff' : 'none'} strokeWidth={sparked ? 2.2 : 2} />
          {sparks}
        </button>
        <button
          type="button"
          onClick={() => onCommentClick?.(post)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <MessageCircle size={18} />
          {post.commentCount || 0}
        </button>
        {canDownload && items.length ? (
          <button
            type="button"
            onClick={() => download(items[0])}
            title="Download"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <Download size={17} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleSave}
          title={saved ? 'Remove from saved' : 'Save'}
          className={`inline-flex items-center gap-1.5 text-xs ${
            saved ? 'text-wchat' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Bookmark size={17} fill={saved ? '#245bff' : 'none'} />
        </button>
        {canShare ? (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
            onClick={() => {
              const url = `${window.location.origin}/?p=${post._id}`
              if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))
              else toast('Copy this link: ' + url)
            }}
            title="Drop (share)"
          >
            <Share2 size={17} />
          </button>
        ) : (
          <span
            title="This creator has turned off sharing"
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-700"
          >
            <Share2 size={17} />
          </span>
        )}
      </footer>
    </article>
  )
}
