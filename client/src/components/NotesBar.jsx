import { useEffect, useRef, useState } from 'react'
import { Music2, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import MusicPicker from './MusicPicker'

const MAX = 60

/**
 * Instagram-style Notes row: 60-character status updates pinned above the
 * inbox for 24 hours, with optional music.
 */
export default function NotesBar() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [composing, setComposing] = useState(false)
  const [text, setText] = useState('')
  const [music, setMusic] = useState(null)
  const [busy, setBusy] = useState(false)
  const [musicOpen, setMusicOpen] = useState(false)
  const inputRef = useRef(null)

  const load = async () => {
    try {
      const { data } = await api.get('/notes')
      setNotes(Array.isArray(data) ? data : [])
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (composing && inputRef.current) inputRef.current.focus()
  }, [composing])

  const myNote = notes.find(
    (n) => String(n.author?._id || n.author) === String(user?._id) && !n.circle
  )

  const submit = async () => {
    const body = text.trim()
    if (!body) return
    setBusy(true)
    try {
      const { data } = await api.post('/notes', {
        text: body,
        music: music ? JSON.stringify(music) : undefined,
      })
      setNotes((prev) => [data, ...prev.filter((n) => n !== myNote)])
      setComposing(false)
      setText('')
      setMusic(null)
      toast.success('Note posted for 24 hours')
    } catch (error) {
      toast.error(getApiError(error, 'Could not post note'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    try {
      await api.delete(`/notes/${id}`)
      setNotes((prev) => prev.filter((n) => n._id !== id))
    } catch (error) {
      toast.error(getApiError(error, 'Could not delete note'))
    }
  }

  return (
    <div className="border-b border-zinc-800/80 px-4 py-3">
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {/* My note */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (myNote) {
                remove(myNote._id)
              } else {
                setComposing(true)
                setText('')
              }
            }}
            className="relative rounded-full"
            title={myNote ? 'Delete your note' : 'Leave a note (24h)'}
          >
            <Avatar
              src={user?.profilePicture}
              name={`${user?.firstName || ''} ${user?.lastName || ''}`}
              size={44}
            />
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-zinc-950 bg-amber-400 text-white">
              <Plus size={11} />
            </span>
          </button>
          <span className="max-w-[64px] truncate text-[10px] text-zinc-500">
            {myNote ? 'Your note' : 'Note'}
          </span>
        </div>

        {notes.map((note) => {
          const author = note.author || {}
          const isMine = String(author._id || author) === String(user?._id)
          return (
            <div key={note._id} className="flex shrink-0 flex-col items-center gap-1">
              <div className="max-w-[150px] rounded-2xl bg-zinc-800/90 px-2.5 py-1.5">
                <p className="truncate text-[11px] text-zinc-200">{note.text}</p>
                {note.music && (
                  <div className="mt-1 flex items-center gap-1">
                    <Music2 size={8} className="text-amber-400" />
                    <span className="text-[9px] text-zinc-400 truncate">
                      {note.music.title} — {note.music.artist}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Avatar src={author.profilePicture} name={`${author.firstName || ''} ${author.lastName || ''}`} size={20} />
                <span className="max-w-[56px] truncate text-[10px] text-zinc-500">
                  {author.username ? `@${author.username}` : author.firstName}
                </span>
                {isMine ? (
                  <button type="button" onClick={() => remove(note._id)} className="text-zinc-600 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {composing ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
          <input
            ref={inputRef}
            value={text}
            maxLength={MAX}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') setComposing(false)
            }}
            placeholder="Share a note for 24 hours…"
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
          />
          <span className="text-[10px] text-zinc-600">
            {MAX - text.length}
          </span>
          <button
            type="button"
            onClick={() => setMusicOpen(true)}
            className="text-xs text-zinc-400 hover:text-amber-400"
          >
            <Music2 size={12} /> Add music
          </button>
          <button type="button" onClick={() => setComposing(false)} className="text-zinc-500 hover:text-zinc-300">
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            Post
          </button>
        </div>
      ) : null}

      {musicOpen && (
        <MusicPicker
          value={music}
          onChange={(track) => {
            setMusic(track)
            setMusicOpen(false)
          }}
          placeholder="Search songs…"
        />
      )}
    </div>
  )
}
