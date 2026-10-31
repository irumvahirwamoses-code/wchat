import { useEffect, useRef, useState } from 'react'
import { Music2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'

/**
 * Music selector for posts. Lets the user upload an audio file or pick from
 * a built-in catalog. Returns { url, title, artist, duration } on confirm.
 */
export default function MusicSelector({ onConfirm, onClose }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [busy, setBusy] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      audioRef.current = new Audio(url)
    }
    return () => {
      if (preview) URL.revokeObjectURL(preview)
      audioRef.current?.pause()
    }
  }, [file, preview])

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('audio/')) {
      return toast.error('Please upload an audio file')
    }
    setFile(f)
    // Guess title from filename
    const name = f.name.replace(/\.[^/.]+$/, '')
    setTitle(name)
    e.target.value = ''
  }

  const uploadAndConfirm = async () => {
    if (!file) return toast.error('Select an audio file first')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('media', file)
      const { data } = await api.post('/posts/media/audio', fd)
      // The server returns the uploaded audio URL
      onConfirm?.({
        url: data.url || data.mediaUrl,
        title: title || data.title || 'Audio',
        artist: artist || data.artist || 'Unknown',
        duration: data.duration || 0,
      })
    } catch (error) {
      toast.error(getApiError(error, 'Could not upload audio'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 bg-zinc-950/80 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-white"
        >
          <X size={18} />
        </button>
        <h3 className="text-sm font-semibold">Add music</h3>
        <button
          type="button"
          onClick={uploadAndConfirm}
          disabled={busy || !file}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-xs font-semibold text-white disabled:opacity-50 hover:bg-amber-300"
        >
          {busy ? '…' : 'Add'}
        </button>
      </header>

      <div className="flex-1 p-4">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Music2 size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title || 'No audio selected'}</p>
            <p className="text-xs text-zinc-500 truncate">{artist}</p>
          </div>
          {audioRef.current && file ? (
            <button
              type="button"
              onClick={() => {
                if (audioRef.current && audioRef.current.paused) audioRef.current.play()
                else if (audioRef.current) audioRef.current.pause()
              }}
              className="p-1.5 text-zinc-400 hover:text-white"
            >
              {audioRef.current && audioRef.current.paused ? (
                <Music2 size={16} className="text-amber-400" />
              ) : (
                <Music2 size={16} className="text-zinc-500" />
              )}
            </button>
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-400">Audio file</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFile}
              className="block w-full text-xs text-zinc-400 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Track title"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
