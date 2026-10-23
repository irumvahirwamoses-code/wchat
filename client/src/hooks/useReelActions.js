import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { getFileUrl, getId } from '../utils/api'
import { useAuth } from '../context/AuthContext'

/**
 * Maps a stored Reel into the player's clip shape. Prefers the multi-clip
 * `clips` array and falls back to the legacy `mediaItems` / `media` fields.
 */
export function toPlayerClips(reel) {
  const stored = Array.isArray(reel?.clips) ? reel.clips.filter((c) => c.media) : []
  if (stored.length > 0) {
    return stored.map((clip) => ({
      src: getFileUrl(clip.media),
      duration: clip.duration || 0,
      trimStart: clip.trimStart || 0,
      trimEnd: clip.trimEnd || 0,
      speed: clip.speed || 1,
      muted: Boolean(clip.muted),
    }))
  }
  const items =
    Array.isArray(reel?.mediaItems) && reel.mediaItems.length
      ? reel.mediaItems
      : reel?.media
        ? [reel.media]
        : []
  return items.map((src) => ({ src: getFileUrl(src), speed: 1 }))
}

/** Saves a media file to the device, falling back to opening it when the
 *  browser blocks a cross-origin download. */
export async function saveMedia(url, name) {
  if (!url) return
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not fetch the media')
    const blob = await response.blob()
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = name || 'wchat-reel'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(href)
    toast.success('Saved to your device')
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}

/**
 * Every action a Reel supports — Sparks, saves, shares (Drops), downloads,
 * remixes and Circle joins. Shared by the feed card and the full-screen viewer
 * so both surfaces stay in sync and honour the creator's sharing preferences.
 */
export default function useReelActions(reel, onRemixed) {
  const { user } = useAuth()

  const [sparks, setSparks] = useState(reel?.sparkCount ?? (reel?.sparks || []).length)
  const [sparked, setSparked] = useState(
    (reel?.sparks || []).some((id) => getId(id) === getId(user?._id))
  )
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [remixBusy, setRemixBusy] = useState(false)
  const [joined, setJoined] = useState(Boolean(reel?.isMember))
  const [joinBusy, setJoinBusy] = useState(false)

  const author = reel?.author || {}

  // Sharing & reuse — the creator's controls. Missing preferences mean allowed.
  const canShare = author.preferences?.allowShareToStories !== false
  const canDownload = author.preferences?.allowDownload !== false
  const canRemix =
    (reel?.isMember || getId(reel?.author) === getId(user?._id)) &&
    author.preferences?.allowRemix !== false

  const clips = useMemo(() => (reel ? toPlayerClips(reel) : []), [reel])
  const audio = reel?.audio?.url ? { src: getFileUrl(reel.audio.url) } : null
  const overlays = reel?.overlays || []
  const filter = reel?.filter && reel.filter !== 'none' ? reel.filter : 'none'
  const tags = reel?.hashtags?.length ? reel.hashtags : reel?.tags || []

  const spark = useCallback(async () => {
    const chatId = getId(reel?.chat)
    if (!chatId) return
    setBusy(true)
    try {
      const { data } = await api.post(`/circles/${chatId}/items/${reel._id}/spark`)
      setSparked(data.sparked)
      setSparks(data.sparkCount)
    } catch (error) {
      toast.error(getApiError(error, 'Could not save your Spark'))
    } finally {
      setBusy(false)
    }
  }, [reel])

  // Reuse: build your own Reel from this one (honours "Allow remixes").
  const remix = useCallback(async () => {
    const chatId = getId(reel?.chat)
    if (!chatId) return
    setRemixBusy(true)
    try {
      const { data } = await api.post(`/circles/${chatId}/items/${reel._id}/remix`, {})
      toast.success('Remix added — open the Circle to edit it')
      onRemixed?.(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not remix this Reel'))
    } finally {
      setRemixBusy(false)
    }
  }, [reel, onRemixed])

  const downloadReel = useCallback(() => {
    const src = clips[0]?.src || (reel?.media ? getFileUrl(reel.media) : '')
    saveMedia(src, `${(reel?.title || 'wchat-reel').replace(/\s+/g, '-').toLowerCase()}.mp4`)
  }, [clips, reel])

  const drop = useCallback(async () => {
    if (!reel) return
    const url = `${window.location.origin}/?reel=${reel._id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: reel.title, text: reel.description || '', url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('Link copied — paste it in a chat or post')
    } catch {
      /* user cancelled */
    }
  }, [reel])

  // Discovery → participation: turn a Reel you found into a Circle you belong to.
  const joinCircle = useCallback(async () => {
    const chatId = getId(reel?.chat)
    if (!chatId) return
    setJoinBusy(true)
    try {
      const { data } = await api.post(`/chats/${chatId}/join-request`)
      if (data?.joined) {
        setJoined(true)
        toast.success(`Joined ${reel?.chat?.chatName || 'the Circle'}`)
      } else {
        toast.success(data?.message || 'Join request sent')
      }
    } catch (error) {
      toast.error(getApiError(error, 'Could not join this Circle'))
    } finally {
      setJoinBusy(false)
    }
  }, [reel])

  const toggleSave = useCallback(() => setSaved((v) => !v), [])

  return {
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
  }
}
