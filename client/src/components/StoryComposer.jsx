import { useState, useMemo } from 'react'
import { Loader2, X, Music, Search, Volume2, VolumeX } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useChat } from '../context/ChatContext'

const MUSIC_CATALOG = [
  { title: 'Sunrise', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/sunrise.mp3' },
  { title: 'Night Drive', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/night-drive.mp3' },
  { title: 'Circle Vibes', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/circle-vibes.mp3' },
  { title: 'Chill Chat', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/chill-chat.mp3' },
  { title: 'Reel Flow', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/reel-flow.mp3' },
  { title: 'Morning Coffee', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/morning-coffee.mp3' },
  { title: 'Neon City', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/neon-city.mp3' },
  { title: 'Loops & Beats', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/loops-beats.mp3' },
]

export default function StoryComposer({ onClose, onCreated }) {
  const { chats } = useChat()
  const communities = chats.filter((c) => c.circleType !== 'personal')
  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [circleId, setCircleId] = useState('')
  const [music, setMusic] = useState(null)
  const [musicSearch, setMusicSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const filteredMusic = useMemo(() => {
    const term = musicSearch.trim().toLowerCase()
    if (!term) return MUSIC_CATALOG
    return MUSIC_CATALOG.filter(
      (m) => m.title.toLowerCase().includes(term) || m.artist.toLowerCase().includes(term)
    )
  }, [musicSearch])

  const submit = async () => {
    if (!file) return toast.error('Select an image or video')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('media', file)
      if (caption) fd.append('caption', caption)
      if (circleId) fd.append('circleId', circleId)
      if (music) fd.append('music', JSON.stringify(music))
      const { data } = await api.post('/stories', fd)
      toast.success('Story posted')
      onCreated?.(data)
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not create story'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-100">New story</h3>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
      </div>
      <div className="space-y-3 p-4">
        <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-zinc-200" />

        {/* Music search */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <Music size={14} className="text-amber-400" />
            Add music (optional)
          </label>
          <input
            value={musicSearch}
            onChange={(e) => setMusicSearch(e.target.value)}
            placeholder="Search music…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
          />
          {filteredMusic.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredMusic.map((track) => {
                const selected = music?.title === track.title && music?.artist === track.artist
                return (
                  <button
                    key={`${track.title}-${track.artist}`}
                    type="button"
                    onClick={() => setMusic(selected ? null : track)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                      selected
                        ? 'border-amber-400 bg-amber-400/15 text-amber-400'
                        : 'border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{track.title}</span>
                      <span className="block truncate text-[10px] text-zinc-500">{track.artist}</span>
                    </div>
                    {selected ? (
                      <span className="text-xs text-amber-400">Added</span>
                    ) : (
                      <span className="text-xs text-zinc-500">+</span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[10px] text-zinc-500">No music found</p>
          )}
          {music && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs">
              <Volume2 size={14} className="text-amber-400" />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-100">{music.title}</span>
                <span className="block truncate text-[10px] text-zinc-400">{music.artist}</span>
              </span>
              <button
                type="button"
                onClick={() => setMusic(null)}
                className="rounded-md p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                title="Remove music"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
          <option value="">My timeline</option>
          {communities.map((c) => <option key={c._id} value={c._id}>{c.chatName}</option>)}
        </select>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        <div className="flex justify-end">
          <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Share
          </button>
        </div>
      </div>
    </div>
  )
}
