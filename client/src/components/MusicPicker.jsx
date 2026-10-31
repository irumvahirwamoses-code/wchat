import { useEffect, useMemo, useRef, useState } from 'react'
import { Music2, Search, Upload, X, CloudUpload } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60'

/**
 * Reusable music picker: search the public catalog, preview a track,
 * upload your own audio, and return { title, artist, url, duration }.
 */
export default function MusicPicker({ value, onChange, onClose, placeholder = 'Search music…' }) {
  const [query, setQuery] = useState('')
  const [tracks, setTracks] = useState([])
  const [myTracks, setMyTracks] = useState([])
  [uploading, setUploading] = useState(false)
  [fileInput, setFileInput] = useState(null)
  [previewUrl, setPreviewUrl] = useState('')
  [audioEl, setAudioEl] = useState(null)

  useEffect(() => {
    fetchCatalog()
  }, [])

  const fetchCatalog = async () => {
    try {
      const { data } = await api.get('/music/catalog', { params: { q: query || undefined } })
      setTracks(Array.isArray(data?.tracks) ? data.tracks : [])
    } catch {
      setTracks([])
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
    onChange?.({
      title: track.title,
      artist: track.artist,
      url: track.url,
      duration: track.duration || 0,
    })
    setPreviewUrl(track.url)
    if (audioEl) audioEl.pause()
    const el = new Audio(track.url)
    setAudioEl(el)
    el.play().catch(() => {})
  }

  const removeMusic = () => {
    onChange?.(null)
    setPreviewUrl('')
    audioEl?.pause()
    setAudioEl(null)
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return tracks
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(term) || t.artist.toLowerCase().includes(term)
    )
  }, [query, tracks])

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

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pl-8`}
        />
      </div>

      <div className="max-h-40 overflow-y-auto space-y-1">
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
                </span>
              </span>
              <span className="text-zinc-500">+</span>
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
    </div>
  )
}
