import { useEffect, useRef, useState } from 'react'
import { Music2, Plus, Trash2, X, Volume2, VolumeX, Heart } from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import MusicPicker from './MusicPicker'
import ErrorBoundary from './ErrorBoundary'

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
  const [notePlaying, setNotePlaying] = useState(null)
  const [noteAudio, setNoteAudio] = useState(null)
  const [likedNotes, setLikedNotes] = useState({})
  const inputRef = useRef(null)

  const load = async () => {
    try {
      const { data } = await api.get('/notes')
      const noteList = Array.isArray(data) ? data : []
      setNotes(noteList)
      // Determine which notes the current user has liked.
      const liked = {}
      noteList.forEach((n) => {
        if (Array.isArray(n.likes)) {
          liked[n._id] = n.likes.some((id) => String(id) === String(user?._id))
        }
        if (!n.likeCount) n.likeCount = Array.isArray(n.likes) ? n.likes.length : 0
      })
      setLikedNotes(liked)
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
      if (notePlaying === id) {
        noteAudio?.pause()
        setNotePlaying(null)
        setNoteAudio(null)
      }
    } catch (error) {
      toast.error(getApiError(error, 'Could not delete note'))
    }
  }

  const toggleNoteMusic = (note) => {
    if (!note.music?.previewUrl) return
    if (notePlaying === note._id) {
      noteAudio?.pause()
      setNotePlaying(null)
      setNoteAudio(null)
      return
    }
    if (noteAudio) noteAudio.pause()
    const el = new Audio(note.music.previewUrl)
    setNoteAudio(el)
    setNotePlaying(note._id)
    el.play().catch(() => {})
  }

  const toggleLike = async (note) => {
    try {
      const { data } = await api.post(`/notes/${note._id}/like`)
      setLikedNotes((prev) => ({ ...prev, [note._id]: data.liked }))
      setNotes((prev) =>
        prev.map((n) => (n._id === note._id ? { ...n, likeCount: data.likes } : n))
      )
    } catch (error) {
      toast.error(getApiError(error, 'Could not like note'))
    }
  }

  const reqUserId = () => user?._id || ''

  // Cleanup note audio on unmount
  useEffect(() => {
    return () => {
      noteAudio?.pause()
    }
  }, [])

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
                    {note.music.previewUrl && (
                      <button
                        type="button"
                        onClick={() => toggleNoteMusic(note)}
                        className="ml-1 p-0.5 text-zinc-500 hover:text-amber-400"
                        title={notePlaying === note._id ? 'Pause' : 'Play preview'}
                      >
                        {notePlaying === note._id ? (
                          <Music2 size={10} className="text-amber-400 animate-pulse" />
                        ) : (
                          <Music2 size={10} />
                        )}
                      </button>
                    )}
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
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleLike(note)}
                    className={`p-0.5 rounded-md transition ${likedNotes[note._id] ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-500 hover:text-amber-400'}`}
                    title={likedNotes[note._id] ? 'Unlike' : 'Like'}
                  >
                    <Heart size={11} fill={likedNotes[note._id] ? '#f59e0b' : 'none'} strokeWidth={likedNotes[note._id] ? 2.2 : 2} />
                  </button>
                )}
                <span className="text-[9px] text-zinc-500">{note.likeCount || 0}</span>
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
        <ErrorBoundary fallback={({ reset }) => (
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4">Add music</h3>
            <p className="text-xs text-zinc-500 mb-4">Unable to load music picker.</p>
            <button
              type="button"
              onClick={reset}
              className="rounded-md px-3 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
            >
              Try again
            </button>
          </div>
        )}>
          <MusicPicker
            value={music}
            onChange={(track) => {
              setMusic(track)
              setMusicOpen(false)
            }}
            placeholder="Search songs…"
          />
        </ErrorBoundary>
      )}
    </div>
  )
}
