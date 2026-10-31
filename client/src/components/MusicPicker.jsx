import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  Clock,
  Heart,
  Music2,
  Search,
  Sparkles,
  Upload,
  X,
  CloudUpload,
  Star,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60'

const CATEGORIES = [
  { id: 'for-you', label: 'For You', icon: Sparkles },
  { id: 'trending', label: 'Trending', icon: Clock },
  { id: 'genre', label: 'Genres', icon: Star },
  { id: 'mood', label: 'Moods', icon: Heart },
]

/**
 * Reusable music picker: search catalog, browse categories/trending/for-you,
 * preview tracks, select clip start/end, upload your own audio, and save
 * audio from other people's stories/posts.
 */
export default function MusicPicker({
  value,
  onChange,
  onClose,
  placeholder = 'Search music…',
}) {
  const [query, setQuery] = useState('')
  [category, setCategory] = useState('for-you')
  [genre, setGenre] = useState('')
  [mood, setMood] = useState('')
  [tracks, setTracks] = useState([])
  [myTracks, setMyTracks] = useState([])
  [genres, setGenres] = useState([])
  [moods, setMoods] = useState([])
  [uploading, setUploading] = useState(false)
  [saving, setSaving] = useState(false)
  [previewUrl, setPreviewUrl] = useState('')
  [audioEl, setAudioEl] = useState(null)
  [showClipPicker, setShowClipPicker] = useState(false)
  [clipTrack, setClipTrack] = useState(null)

  useEffect(() => {
    fetchCatalog()
    fetchCategories()
    fetchMyTracks()
  }, [])

  // Debounced catalog search / browse.
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      fetchCatalog()
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [query, category, genre, mood])

  const fetchCatalog = async () => {
    try {
      const params = { q: query || undefined, category, genre: genre || undefined, mood: mood || undefined }
      const { data } = await api.get('/music/catalog', { params })
      if (typeof window !== 'undefined') {
        setTracks(Array.isArray(data?.tracks) ? data.tracks : [])
      }
    } catch {
      setTracks([])
    }
  }

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/music/categories')
      setGenres(Array.isArray(data?.genres) ? data.genres : [])
      setMoods(Array.isArray(data?.moods) ? data.moods : [])
    } catch {
      setGenres([])
      setMoods([])
    }
  }

  const fetchMyTracks = async () => {
    try {
      const { data } = await api.get('/music/my')
      setMyTracks(Array.isArray(data?.tracks) ? data.tracks : [])
    } catch {
      setMyTracks([])
    }
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      return toast.error('Please upload an audio file')
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('media', file)
      const { data } = await api.post('/music/upload', fd)
      setMyTracks((prev) => [data, ...prev])
      selectTrack(data)
      event.target.value = ''
    } catch (error) {
      toast.error(getApiError(error, 'Could not upload audio'))
    } finally {
      setUploading(false)
    }
  }

  const selectTrack = (track) => {
    setClipTrack(track)
    setShowClipPicker(true)
  }

  const confirmClip = (clip) => {
    onChange?.({
      title: clip.track.title,
      artist: clip.track.artist,
      url: clip.track.url,
      albumArt: clip.track.albumArt,
      duration: clip.track.duration,
      startTime: clip.startTime,
      endTime: clip.endTime,
      lyrics: clip.track.lyrics,
    })
    setPreviewUrl(clip.track.url)
    if (audioEl) audioEl.pause()
    const el = new Audio(clip.track.url)
    setAudioEl(el)
    el.play().catch(() => {})
    setShowClipPicker(false)
    setClipTrack(null)
  }

  const removeMusic = () => {
    onChange?.(null)
    setPreviewUrl('')
    audioEl?.pause()
    setAudioEl(null)
  }

  const saveTrack = async (track) => {
    setSaving(true)
    try {
      await api.post('/music/save', { trackId: track._id })
      toast.success('Saved to your audio library')
    } catch (error) {
      toast.error(getApiError(error, 'Could not save audio'))
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return tracks
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(term) || t.artist.toLowerCase().includes(term)
    )
  }, [query, tracks])

  const isSaved = (track) => {
    return myTracks.some((t) => String(t._id) === String(track._id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-400">Music</label>
        {value ? (
          <button
            type="button"
            onClick={removeMusic}
            className="text-xs text-zinc-500 hover:text-rose-300"
          >
            Remove
          </button>
        ) : null}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => {
          const active = category === cat.id
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <Icon size={12} />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Genre / mood filters when browsing genres/moods */}
      {(category === 'genre' || category === 'mood') && (
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar mb-2">
          {(category === 'genre' ? genres : moods).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => (category === 'genre' ? setGenre(g) : setMood(g))}
              className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition ${
                (category === 'genre' ? genre === g : mood === g)
                  ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pl-8`}
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1">
        {filtered.length > 0 ? (
          filtered.map((track) => (
            <button
              key={`${track.title}-${track.artist}-${track.source}`}
              type="button"
              onClick={() => selectTrack(track)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-left text-xs text-zinc-300 hover:border-zinc-600"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{track.title}</span>
                <span className="block truncate text-[10px] text-zinc-500">
                  {track.artist} {track.source === 'upload' ? '· your upload' : ''}
                  {track.genre ? ` · ${track.genre}` : ''}
                  {track.mood ? ` · ${track.mood}` : ''}
                </span>
              </span>
              <span
                className={`text-xs ${
                  isSaved(track) ? 'text-amber-400' : 'text-zinc-500'
                }`}
              >
                {isSaved(track) ? <Star size={12} fill="#fbbf24" /> : <Star size={12} />}
              </span>
            </button>
          ))
        ) : (
          <p className="text-[10px] text-zinc-500">No music found</p>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <p className="text-[10px] text-zinc-500 mb-2">Or upload your own</p>
        <label
          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400/60 cursor-pointer"
        >
          <input
            type="file"
            accept="audio/*"
            onChange={handleUpload}
            className="hidden"
          />
          <CloudUpload size={14} className="text-amber-400" />
          <span>Upload audio</span>
          {uploading ? <span className="ml-2 text-[10px] text-amber-400">…</span> : null}
        </label>
      </div>

      {myTracks.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-medium text-zinc-400 mb-1">Your uploads</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {myTracks.map((track) => (
              <button
                key={track._id}
                type="button"
                onClick={() => selectTrack(track)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-left text-xs text-zinc-300 hover:border-zinc-600"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{track.title}</span>
                  <span className="block truncate text-[10px] text-zinc-500">{track.artist}</span>
                </span>
                <span className="text-zinc-500">+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {value && previewUrl && (
        <div className="mt-2 flex items-center gap-2 p-2 rounded-lg border border-amber-400/30 bg-amber-500/10">
          <Music2 size={14} className="text-amber-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-zinc-100">{value.title}</span>
            <span className="block truncate text-[10px] text-zinc-400">{value.artist}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (audioEl?.paused) audioEl.play()
              else audioEl?.pause()
            }}
            className="p-1 text-zinc-500 hover:text-white"
          >
            {audioEl?.paused ? <Music2 size={14} className="text-amber-400" /> : <Music2 size={14} className="text-zinc-500" />}
          </button>
        </div>
      )}

      {showClipPicker && clipTrack && (
        <ClipSelection
          track={clipTrack}
          onConfirm={confirmClip}
          onClose={() => setShowClipPicker(false)}
        />
      )}
    </div>
  )
}
