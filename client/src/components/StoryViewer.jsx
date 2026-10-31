import { useEffect, useRef, useState } from 'react'
import {
  BellOff,
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  Loader2,
  Music,
  Send,
  Share2,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import ReportModal from './ReportModal'
import StorySticker from './StoryStickers'
import MusicSticker from './MusicSticker'
import api, { getApiError } from '../config/api'
import { getFileUrl, getId } from '../utils/api'
import { formatHandle } from '../utils/handle'

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👏']

const timeAgo = (value) => {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const firstUnseenIndex = (ring, userId) => {
  const stories = ring?.stories || []
  const index = stories.findIndex(
    (story) => !(story.viewers || []).some((viewer) => String(viewer) === String(userId))
  )
  return index === -1 ? 0 : index
}

export default function StoryViewer({
  ring,
  rings: ringsProp = [],
  startIndex = 0,
  currentUser,
  onClose,
  onChanged,
}) {
  const rings = ringsProp.length ? ringsProp : ring ? [ring] : []
  const myId = getId(currentUser)

  const initialRing = (() => {
    if (!rings.length) return 0
    if (startIndex >= 0 && startIndex < rings.length) return startIndex
    if (ring) {
      const found = rings.findIndex(
        (item) => getId(item.owner) === getId(ring.owner)
      )
      if (found >= 0) return found
    }
    return 0
  })()

  const [ringIdx, setRingIdx] = useState(initialRing)
  const [storyIdx, setStoryIdx] = useState(() =>
    firstUnseenIndex(rings[initialRing], myId)
  )
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const [showReport, setShowReport] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  const progressRef = useRef(0)
  const videoRef = useRef(null)
  const tapState = useRef(null)
  const holdTimer = useRef(null)

  const currentRing = rings[ringIdx]
  const stories = currentRing?.stories || []
  const story = stories[storyIdx]
  const owner = currentRing?.owner || {}
  const isOwner = String(getId(owner)) === String(myId)

  const goNext = () => {
    const list = rings[ringIdx]?.stories || []
    if (storyIdx < list.length - 1) {
      setStoryIdx(storyIdx + 1)
      return
    }
    if (ringIdx < rings.length - 1) {
      setRingIdx(ringIdx + 1)
      setStoryIdx(0)
      return
    }
    onClose?.()
  }

  const goPrev = () => {
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1)
      return
    }
    if (ringIdx > 0) {
      const previous = ringIdx - 1
      const list = rings[previous]?.stories || []
      setRingIdx(previous)
      setStoryIdx(Math.max(0, list.length - 1))
      return
    }
    progressRef.current = 0
    setProgress(0)
  }

  const nextRef = useRef(goNext)
  nextRef.current = goNext

  useEffect(() => {
    progressRef.current = 0
    setProgress(0)
    setPaused(false)
    setReply('')
    if (!story) return
    api.post(`/stories/${story._id}/view`).catch(() => {})
  }, [story?._id])

  useEffect(() => {
    if (!story) return undefined
    setLiked((story.likes || []).some((id) => String(id) === String(myId)))
    setLikeCount((story.likes || []).length)
    return undefined
  }, [story?._id, myId])

  useEffect(() => {
    if (!story || paused || story.mediaType === 'video') return undefined
    const timer = setInterval(() => {
      progressRef.current = Math.min(100, progressRef.current + 2)
      setProgress(progressRef.current)
      if (progressRef.current >= 100) nextRef.current()
    }, 100)
    return () => clearInterval(timer)
  }, [story?._id, paused, ringIdx, storyIdx])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (paused) video.pause()
    else video.play().catch(() => {})
  }, [paused, story?._id])

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    tapState.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
      held: false,
    }
    setPaused(true)
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => {
      if (tapState.current) tapState.current.held = true
    }, 220)
  }

  const handlePointerUp = (event) => {
    clearTimeout(holdTimer.current)
    const state = tapState.current
    tapState.current = null
    setPaused(false)
    if (!state) return

    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    const elapsed = Date.now() - state.time

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext()
      else goPrev()
      return
    }
    if (state.held || elapsed > 260) return

    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    if (ratio < 0.3) goPrev()
    else goNext()
  }

  const handlePointerCancel = () => {
    clearTimeout(holdTimer.current)
    tapState.current = null
    setPaused(false)
  }

  const handleLike = async () => {
    if (!story) return
    try {
      const { data } = await api.post(`/stories/${story._id}/like`)
      setLiked(Boolean(data.liked))
      setLikeCount(Number(data.likeCount) || 0)
    } catch (error) {
      toast.error(getApiError(error, 'Could not like this story'))
    }
  }

  const handleReact = async (emoji) => {
    if (!story) return
    try {
      await api.post(`/stories/${story._id}/react`, { emoji })
      toast.success(`Reacted ${emoji}`)
    } catch (error) {
      toast.error(getApiError(error, 'Could not react'))
    }
  }

  const handleReply = async () => {
    if (!story || !reply.trim()) return
    setSending(true)
    try {
      await api.post(`/stories/${story._id}/reply`, { text: reply.trim() })
      setReply('')
      toast.success('Reply sent')
    } catch (error) {
      toast.error(getApiError(error, 'Could not send reply'))
    } finally {
      setSending(false)
    }
  }

  const handleShare = async () => {
    if (!story) return
    if (owner.preferences?.allowShareToStories === false) {
      toast.error('Sharing is turned off for this story')
      return
    }
    const url = `${window.location.origin}/?story=${story._id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const handleMute = async () => {
    if (!owner?._id) return
    try {
      await api.post(`/auth/mute-stories/${getId(owner)}`)
      toast.success(`Muted ${formatHandle(owner.username)}`)
      onChanged?.()
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not mute these stories'))
    }
  }

  const handleDelete = async () => {
    if (!story) return
    try {
      await api.delete(`/stories/${story._id}`)
      toast.success('Story deleted')
      onChanged?.()
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not delete story'))
    }
  }

  if (!story) return null

  const renderMedia = () => {
    if (story.mediaType === 'video' && story.media) {
      return (
        <video
          ref={videoRef}
          src={getFileUrl(story.media)}
          className="max-h-full max-w-full object-contain"
          autoPlay
          playsInline
          muted={videoMuted}
          onTimeUpdate={(event) => {
            const video = event.currentTarget
            if (video.duration) {
              const percent = (video.currentTime / video.duration) * 100
              progressRef.current = percent
              setProgress(percent)
            }
          }}
          onEnded={goNext}
        />
      )
    }
    if (story.media) {
      return (
        <img
          src={getFileUrl(story.media)}
          alt="Story"
          className="max-h-full max-w-full object-contain"
        />
      )
    }
    return (
      <div
        className="flex h-full w-full items-center justify-center p-8 text-center"
        style={{
          background: story.textStyle?.background || '#111827',
          color: story.textStyle?.color || '#ffffff',
        }}
      >
        <p className="whitespace-pre-wrap break-words text-2xl font-bold leading-snug">
          {story.text}
        </p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="z-30 px-4 pb-2 pt-3">
        <div className="mb-2 flex gap-1">
          {stories.map((item, index) => (
            <div key={item._id || index} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-[width] duration-100"
                style={{
                  width:
                    index < storyIdx ? '100%' : index === storyIdx ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Avatar
            src={owner.profilePicture}
            name={`${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.username}
            size={34}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">
              {formatHandle(owner.username)}
            </p>
            <p className="text-[10px] text-white/60">{timeAgo(story.createdAt)}</p>
          </div>
          {!isOwner ? (
            <button
              type="button"
              onClick={handleMute}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              title="Mute stories"
            >
              <BellOff size={16} />
            </button>
          ) : null}
          {!isOwner ? (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              title="Report story"
            >
              <Flag size={16} />
            </button>
          ) : null}
          {story.mediaType === 'video' ? (
            <button
              type="button"
              onClick={() => setVideoMuted((prev) => !prev)}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              title={videoMuted ? 'Unmute' : 'Mute'}
            >
              {videoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Media + interactions */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {renderMedia()}

        <div
          className="absolute inset-0 z-10"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />

        <div className="pointer-events-none absolute inset-0 z-20">
          {(story.stickers || []).map((sticker, index) => (
            <StorySticker
              key={sticker._id || index}
              sticker={sticker}
              storyId={story._id}
              currentUserId={myId}
              isAuthor={isOwner}
            />
          ))}
        </div>

        {story.caption ? (
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 text-center">
            <p className="mx-auto inline-block max-w-full rounded-lg bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
              {story.caption}
            </p>
          </div>
        ) : null}

        {story.music?.url ? (
          <div className="absolute bottom-4 left-4 z-10 flex max-w-[60%] flex-col gap-1 rounded-xl bg-black/60 px-3 py-2 text-white backdrop-blur-sm">
            <MusicSticker
              music={story.music}
              style="titleLabel"
              className="max-w-[48%]"
            />
            {!isOwner && (
              <button
                type="button"
                onClick={() => {
                  toast('Audio saved to your library')
                }}
                className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300"
              >
                <Star size={12} fill="#fbbf24" />
                Save audio
              </button>
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={goPrev}
          className="absolute left-2 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 sm:block"
          title="Previous"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={goNext}
          className="absolute right-2 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 sm:block"
          title="Next"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Footer */}
      <div className="z-30 border-t border-white/10 bg-black/50 px-3 pb-4 pt-2 backdrop-blur">
        {isOwner ? (
          <div className="flex items-center justify-between text-xs text-white/80">
            <span>
              {story.viewers?.length || 0} view
              {(story.viewers?.length || 0) === 1 ? '' : 's'}
              {likeCount ? ` · ${likeCount} like${likeCount === 1 ? '' : 's'}` : ''}
            </span>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
            >
              <Trash2 size={13} /> Delete story
            </button>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-1.5">
              <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(emoji)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg hover:bg-white/10"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleLike}
                className={`grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 ${
                  liked ? 'text-rose-500' : 'text-white'
                }`}
                title="Like story"
              >
                <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="grid h-8 w-8 place-items-center rounded-full text-white hover:bg-white/10"
                title="Share story"
              >
                <Share2 size={16} />
              </button>
            </div>

            {story.allowReplies !== false ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  handleReply()
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  maxLength={500}
                  placeholder={`Reply to ${formatHandle(owner.username)}…`}
                  className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/40"
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black disabled:opacity-40"
                  title="Send reply"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </form>
            ) : (
              <p className="py-1.5 text-center text-[11px] text-white/50">
                Replies are turned off for this story
              </p>
            )}
          </>
        )}
      </div>

      {showReport ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <ReportModal
            targetType="story"
            targetId={story._id}
            targetName={`a story by ${formatHandle(owner.username)}`}
            onClose={() => setShowReport(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
