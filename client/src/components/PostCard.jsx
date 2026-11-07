import { useEffect, useState } from 'react'
import {
  Archive,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Music2,
  Pin,
  RefreshCw,
  Send,
  Share,
  Share2,
  Trash2,
  Edit3,
  Users,
} from 'lucide-react'
import ReportModal from './ReportModal'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import ReasonBadge from './ReasonBadge'
import { useNavigate } from 'react-router-dom'
import useImpression from '../hooks/useImpression'
import { trackFeedEvent } from '../utils/feedEvents'
import api, { getApiError } from '../config/api'
import { getFileUrl, getId } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { formatHandle } from '../utils/handle'
import { formatTime } from '../utils/api'

/** Renders the caption with #hashtags / @mentions highlighted. */
function Caption({ text, max = 400 }) {
  const short = text.length > max ? `${text.slice(0, max)}â€¦` : text
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
      <video autoPlay muted playsInline loop src={getFileUrl(only.url)} className="max-h-[80vh] w-full bg-black" onClick={(e)=>{const v=e.currentTarget;if(v.paused)v.play().catch(()=>{});else v.pause();}} />
    ) : (
      <img
        src={getFileUrl(only.url)}
        alt={only.fileName || 'Post'}
        className="max-h-[80vh] w-full bg-black object-contain"
      />
    )
  }

  const item = items[idx]

  return (
    <div className="relative bg-black">
      {item.type === 'video' ? (
        <video key={item.url} autoPlay muted playsInline loop src={getFileUrl(item.url)} className="max-h-[80vh] w-full" onClick={(e)=>{const v=e.currentTarget;if(v.paused)v.play().catch(()=>{});else v.pause();}} />
      ) : (
          <img
            key={item.url}
            src={getFileUrl(item.url)}
            alt={item.fileName || 'Post'}
            className="max-h-[80vh] w-full bg-black object-contain"
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

export default function PostCard({
  post,
  onCommentClick,
  onDeleted,
  showReason = false,
  surface = 'home',
  position = 0,
  onNotInterested,
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isExternal = Boolean(post?.isExternal);
  const impressionRef = useImpression(isExternal ? null : post._id, { surface, position })
  const track = (eventType, extra = {}) => {
    if (!isExternal) trackFeedEvent({ itemId: post._id, eventType, surface, position, ...extra })
  }
  const author = post.author || {}
  const circle = post.circle || null
  const collaborators = post.collaborators || []
  const authorName =
    `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username
  const isMine = getId(author) === user?._id
  const canEdit = isMine || collaborators.some((c) => getId(c) === user?._id)

  const goToProfile = () => {
    if (author?._id) navigate(`/user/${author._id}`)
  }

  // Sharing & reuse â€” the author decides what others may do with their content.
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
  const [archived, setArchived] = useState(Boolean(post.archivedAt))
  const [busy, setBusy] = useState(false)
  const [editedItems, setEditedItems] = useState(items)
  const [reportOpen, setReportOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editedText, setEditedText] = useState(post.text || '')
  const [showComments, setShowComments] = useState(true)
  const [comments, setComments] = useState([])
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [showSendUser, setShowSendUser] = useState(false)
  const [sendToUser, setSendToUser] = useState('')
  const [sendUsers, setSendUsers] = useState([])

  const spark = async () => {
    setBusy(true)
    try {
      const { data } = await api.post(`/posts/${post._id}/spark`)
      setSparked(data.sparked)
      setSparks(data.sparkCount)
      track(data.sparked ? 'spark' : 'unspark')
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
      track(data.saved ? 'save' : 'unsave')
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

  const toggleArchive = async () => {
    setBusy(true)
    try {
      const endpoint = archived ? '/unarchive' : '/archive'
      const { data } = await api.post(`/posts/${post._id}${endpoint}`)
      setArchived(data.archived)
      toast.success(data.archived ? 'Post archived' : 'Post restored')
      if (data.archived) onDeleted?.(post._id)
    } catch (error) {
      toast.error(getApiError(error, 'Could not archive post'))
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { data } = await api.put(`/posts/${post._id}`, {
        text: editedText,
        mediaItems: editedItems,
      })
      setEditedText(data.text || '')
      setEditOpen(false)
      toast.success('Post updated')
      onDeleted?.(post._id) // trigger refresh
    } catch (error) {
      toast.error(getApiError(error, 'Could not update post'))
    } finally {
      setBusy(false)
    }
  }

  const loadComments = async () => {
    try {
      const { data } = await api.get(`/posts/${post._id}/comments`)
      setComments(Array.isArray(data) ? data : [])
    } catch {
      setComments([])
    }
  }

  useEffect(() => {
    loadComments()
  }, [post._id])

  const addComment = async () => { if(isExternal){ if(!replyText.trim()) return; setComments(prev=>[...prev,{_id:String(Date.now()),author:user,text:replyText.trim(),createdAt:new Date().toISOString()}]); setReplyText(''); setReplyingTo(null); return; }
    if (!replyText.trim()) return
    setSendingReply(true)
    try {
      const { data } = await api.post(`/posts/${post._id}/comments`, {
        text: replyText.trim(),
        parentComment: replyingTo || undefined,
      })
      setComments((prev) => [...prev, data])
      setReplyText('')
      setReplyingTo(null)
      track('comment')
    } catch (error) {
      toast.error(getApiError(error, 'Could not add comment'))
    } finally {
      setSendingReply(false)
    }
  }


  const sendToUserAction = async () => {
    if (!sendToUser) return
    setBusy(true)
    try {
      const { data } = await api.post(`/posts/${post._id}/send`, {
        userId: sendToUser,
      })
      setShowSendUser(false)
      setSendToUser('')
      setSendUsers([])
      track('share')
      toast.success('Post sent')
    } catch (error) {
      toast.error(getApiError(error, 'Could not send post'))
    } finally {
      setBusy(false)
    }
  }

  // Search users as the person types in the send-to-user box.
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      const q = sendToUser.trim()
      if (!q) {
        setSendUsers([])
        return
      }
      try {
        const { data } = await api.get('/users', { params: { search: q } })
        if (active) setSendUsers(Array.isArray(data) ? data : [])
      } catch {
        if (active) setSendUsers([])
      }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [sendToUser])

  const repostToStoryAction = async () => {
    setBusy(true)
    try {
      await api.post(`/posts/${post._id}/repost-to-story`, { text: '', music: null })
      track('share')
      toast.success('Added to your story')
    } catch (error) {
      toast.error(getApiError(error, 'Could not repost to story'))
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
      window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <article
      ref={impressionRef}
      className="mx-auto mb-4 w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-900/55 shadow-card backdrop-blur-sm"
    >
      <header className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={goToProfile}
          className="inline-flex items-center gap-3 border-none bg-transparent p-0 text-left"
        >
          <Avatar src={author.profilePicture} name={authorName} size={42} />
          <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            {authorName}
            {canEdit && !isMine ? (
              <span className="text-xs text-amber-400" title="Co-author">Â· Collab</span>
            ) : null}
            <span className="text-xs font-normal text-zinc-500">
              {formatHandle(author.username)}
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-zinc-500">
            <span>{formatTime(post.createdAt)}</span>
            {circle ? (
              <>
                <span>Â·</span>
                <span className="font-medium text-zinc-400">{circle.chatName}</span>
              </>
            ) : null}
            {post.location ? (
              <>
                <span>Â·</span>
                <MapPin size={11} className="inline" />
                <span>{post.location}</span>
              </>
            ) : null}
            {pinned ? (
              <>
                <span>Â·</span>
                <Pin size={11} className="inline text-amber-300" />
              </>
            ) : null}
            {archived ? (
              <>
                <span>Â·</span>
                <Archive size={11} className="inline text-zinc-400" />
                <span className="text-zinc-500">Archived</span>
              </>
            ) : null}
            {post.audio?.url ? (
              <>
                <span>Â·</span>
                <Music2 size={11} className="inline text-pink-400" />
              </>
            ) : null}
          </p>
          {post.audio?.title && (
            <p className="text-[10px] text-zinc-500 truncate">
              ðŸŽµ {post.audio.title}{post.audio.artist ? ` â€” ${post.audio.artist}` : ''}
            </p>
          )}
        </div>
        </button>
        {isMine ? (
          <>
            <button
              type="button"
              onClick={() => { setEditedText(post.text || ''); setEditedItems(items); setEditOpen(true) }}
              disabled={busy}
              title="Edit post"
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            >
              <Edit3 size={16} />
            </button>
            <button
              type="button"
              onClick={toggleArchive}
              disabled={busy}
              title={archived ? 'Restore post' : 'Archive post'}
              className={`rounded-md p-1.5 transition hover:bg-zinc-800 ${archived ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Archive size={16} />
            </button>
            <button
              type="button"
              onClick={togglePin}
              disabled={busy}
              title={pinned ? 'Unpin' : 'Pin to profile (max 6)'}
              className={`rounded-md p-1.5 transition hover:bg-zinc-800 ${pinned ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-300'}`}
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
          onHide={() => {
            track('not_interested')
            onNotInterested?.(post._id)
            toast.success('You will see less like this')
          }}
          onMore={() => {
            track('more_like_this')
            toast.success('More posts like this')
          }}
          onLess={() => {
            track('less_like_this')
            toast.success('You will see less like this')
          }}
        />
      ) : null}

      {post.text ? (
        <div className="px-4 pb-3">
          <Caption text={post.text} />
        </div>
      ) : null}

      {items.length ? <Carousel items={items} /> : null}

      {post.audio?.url ? (
        <div className="px-4 pb-2">
          <audio controls className="w-full">
            <source src={getFileUrl(post.audio.url)} type="audio/mpeg" />
          </audio>
        </div>
      ) : null}

      <footer className="flex items-center gap-4 border-t border-zinc-800/50 px-4 py-3">
        <button
          type="button"
          onClick={async()=>{ if(isExternal){ const next=!sparked; setSparked(next); setSparks(n=>next?n+1:Math.max(0,n-1)); return; } await spark(); }}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold transition ${
            sparked ? 'bg-wchat/10 text-wchat' : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200'
          }`}
        >
          {post.sparks?.slice(0, 2).map((s) => (
            <img
              key={getId(s)}
              src={getFileUrl(s.profilePicture)}
              alt={s.username || s.firstName}
              className="h-5 w-5 shrink-0 rounded-full border border-zinc-800 bg-zinc-800"
              title={`${s.firstName || ''} ${s.lastName || ''}`.trim() || s.username}
            />
          ))}
          <Heart size={18} fill={sparked ? '#245bff' : 'none'} strokeWidth={sparked ? 2.2 : 2} />
          {sparks}
          {post.sparks && post.sparks.length > 2 && (
            <span className="text-[10px] text-zinc-500 ml-1">+{post.sparks.length - 2}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setShowComments(true); loadComments() }}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <MessageCircle size={18} />
          {post.commentCount || 0}
        </button>
        {canDownload && items.length ? (
          <button
            type="button"
            onClick={() => download(items[0])}
            title="Download"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-200"
          >
            <Download size={17} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={async()=>{ if(isExternal){ const next=!saved; setSaved(next); toast.success(next?'Saved':'Removed'); return; } await toggleSave(); }}
          title={saved ? 'Remove from saved' : 'Save'}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold transition ${
            saved ? 'bg-wchat/10 text-wchat' : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200'
          }`}
        >
          <Bookmark size={17} fill={saved ? '#245bff' : 'none'} />
        </button>
        <button
          type="button"
          onClick={() => setShowSendUser(true)}
          title="Send to user"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <Send size={17} />
        </button>
        <button
          type="button"
          onClick={isExternal?undefined:repostToStoryAction}
          title="Add to your story"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <RefreshCw size={17} />
        </button>
        {!isMine ? (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            title="Report post"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Flag size={16} />
          </button>
        ) : null}
        {canShare ? (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-800/60 hover:text-zinc-200"
            onClick={() => {
              const url = `${window.location.origin}/?p=${post._id}`
              track('share')
              if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))
              else toast('Copy this link: ' + url)
            }}
            title="Drop (share)"
          >
            <Share size={17} />
          </button>
        ) : (
          <span
            title="This creator has turned off sharing"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-zinc-700"
          >
            <Share size={17} />
          </span>
        )}
      </footer>

      {/* Inline comments at footer */}
      <div className="border-t border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-zinc-200 hover:text-zinc-100"
          >
            <MessageCircle size={14} />
            <span>Comments ({isExternal?0:comments.length})</span>
          </button>
        </div>

        {showComments ? (
          <div className="px-3 py-2">
            <div className="space-y-2">
              {comments.length === 0 ? (
                <p className="text-center text-[10px] text-zinc-500 py-2">No comments yet</p>
              ) : null}

              {comments.filter((c) => !c.parentComment).map((c) => {
                const a = c.author || {}
                const replies = comments.filter((r) => r.parentComment === c._id)
                const isReplyingToThis = replyingTo === c._id

                return (
                  <div key={c._id} className="mb-2">
                    <div className="flex gap-2">
                      <Avatar src={a.profilePicture} name={`${a.firstName || ''} ${a.lastName || ''}`} size={28} />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-300">
                          <span className="font-semibold">{a.username ? `@${a.username}` : a.firstName}</span>{' '}
                          {c.text}
                        </p>
                        <p className="text-[10px] text-zinc-500">{formatTime(c.createdAt)}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(c._id)
                            setReplyText('')
                          }}
                          className="text-[10px] text-zinc-500 hover:text-amber-400"
                        >
                          Reply
                        </button>
                      </div>
                    </div>

                    {replies.map((r) => {
                      const ra = r.author || {}
                      return (
                        <div key={r._id} className="ml-6 mt-1 border-l border-zinc-800 pl-2 space-y-1">
                          <div className="flex gap-2">
                            <Avatar src={ra.profilePicture} name={`${ra.firstName || ''} ${ra.lastName || ''}`} size={24} />
                            <div className="min-w-0">
                              <p className="text-[10px] text-zinc-300">
                                <span className="font-semibold">{ra.username ? `@${ra.username}` : ra.firstName}</span>{' '}
                                {r.text}
                              </p>
                              <p className="text-[9px] text-zinc-500">{formatTime(r.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {isReplyingToThis && (
                      <div className="mt-1 flex items-center gap-2 pl-10">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a replyâ€¦"
                          className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                        />
                        <button
                          type="button"
                          onClick={addComment}
                          disabled={sendingReply || !replyText.trim()}
                          className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-amber-400 disabled:opacity-40"
                        >
                          Send
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReplyingTo(null); setReplyText('') }}
                          className="text-[10px] text-zinc-500 hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
              }

            <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-2">
              <Avatar src={user?.profilePicture} name={`${user?.firstName || ''} ${user?.lastName || ''}`} size={28} />
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={replyingTo ? 'Write a replyâ€¦' : 'Add a commentâ€¦'}
                className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
              {replyingTo ? (
                <button
                  type="button"
                  onClick={addComment}
                  disabled={sendingReply || !replyText.trim()}
                  className="rounded-md px-2.5 py-1.5 text-xs text-zinc-500 hover:text-amber-400 disabled:opacity-40"
                >
                  Send
                </button>
              ) : (
                <button
                  type="button"
                  onClick={addComment}
                  disabled={sendingReply || !replyText.trim()}
                  className="rounded-full p-1.5 text-zinc-500 hover:text-amber-400 disabled:opacity-40"
                >
                  <Send size={16} />
                </button>
              )}
              {replyingTo && (
                <button
                  type="button"
                  onClick={() => { setReplyingTo(null); setReplyText('') }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        ) : null}
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-zinc-950 rounded-2xl p-4 w-full max-w-md border border-zinc-800">
            <h3 className="text-sm font-semibold mb-3">Edit post</h3>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 mb-3"
            />
            {editedItems.length > 0 ? (
              <div className="mb-3">
                <p className="text-xs text-zinc-400 mb-2">Media â€” tap Ã— to remove</p>
                <div className="flex flex-wrap gap-2">
                  {editedItems.map((item, idx) => (
                    <div key={`${item.url}-${idx}`} className="relative">
                      {item.type === 'video' ? (
                        <video
                          src={getFileUrl(item.url)}
                          className="h-16 w-16 rounded-lg object-cover bg-black"
                          muted
                         />
                      ) : (
                        <img
                          src={getFileUrl(item.url)}
                          alt={item.fileName || 'Media'}
                          className="h-16 w-16 rounded-lg object-cover bg-black"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setEditedItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white hover:bg-red-600"
                        title="Remove"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-400 text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to user */}
      {showSendUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-zinc-950 rounded-2xl p-4 w-full max-w-md border border-zinc-800">
            <h3 className="text-sm font-semibold mb-3">Send post to</h3>
            <input
              value={sendToUser}
              onChange={(e) => setSendToUser(e.target.value)}
              placeholder="Search usersâ€¦"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 mb-3 outline-none focus:border-amber-400/60"
            />
            {sendUsers.length > 0 ? (
              <div className="max-h-40 overflow-y-auto border border-zinc-800 rounded-lg bg-zinc-900 mb-3">
                {sendUsers.map((u) => (
                  <button
                    key={getId(u)}
                    type="button"
                    onClick={() => {
                      setSendToUser(getId(u))
                      setSendUsers([])
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    <Avatar src={u.profilePicture} name={`${u.firstName || ''} ${u.lastName || ''}`} size={24} />
                    <span className="truncate text-sm">{u.username ? `@${u.username}` : `${u.firstName || ''} ${u.lastName || ''}`}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSendUser(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendToUserAction}
                disabled={busy || !sendToUser}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-400 text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {reportOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <ReportModal
            targetType="post"
            targetId={post._id}
            targetName="this post"
            onClose={() => setReportOpen(false)}
          />
        </div>
      ) : null}
    </article>
  )
}





