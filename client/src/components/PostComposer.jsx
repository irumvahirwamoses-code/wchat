import { useRef, useState } from 'react'
import { Image, Loader2, MapPin, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'

const MAX_ITEMS = 10

export default function PostComposer({ onClose, onCreated }) {
  const { user } = useAuth()
  const { chats } = useChat()
  const communities = chats.filter((c) => c.circleType !== 'personal')
  const fileRef = useRef(null)

  const [text, setText] = useState('')
  const [circleId, setCircleId] = useState('')
  const [files, setFiles] = useState([])
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)

  const addFiles = (list) => {
    const next = [...files, ...Array.from(list || [])].slice(0, MAX_ITEMS)
    if (list?.length && files.length >= MAX_ITEMS) {
      toast(`You can add up to ${MAX_ITEMS} items`, { icon: '📸' })
    }
    setFiles(next)
  }

  const submit = async () => {
    if (!text.trim() && !files.length) return toast.error('Add text or media')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('text', text.trim())
      if (circleId) fd.append('circleId', circleId)
      if (location) fd.append('location', location.trim())
      files.forEach((f) => fd.append('media', f))
      const { data } = await api.post('/posts', fd)
      toast.success('Post created')
      onCreated?.(data)
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not create post'))
    } finally {
      setBusy(false)
    }
  }

  const canPost = Boolean(text.trim()) || files.length > 0

  return (
    <div className="animate-scale-in w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-100">Create post</h3>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={user?.profilePicture}
            name={`${user?.firstName || ''} ${user?.lastName || ''}`}
            size={40}
          />
          <select
            value={circleId}
            onChange={(e) => setCircleId(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">My timeline</option>
            {communities.map((c) => (
              <option key={c._id} value={c._id}>
                {c.chatName}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="What's on your mind? Add #hashtags and @mentions"
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
        />

        <label className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300">
          <MapPin size={14} className="text-zinc-500" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add location (city, sector, venue)"
            maxLength={120}
            className="flex-1 bg-transparent text-zinc-200 placeholder-zinc-500 outline-none"
          />
        </label>

        {files.length ? (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="relative">
                <img
                  src={URL.createObjectURL(f)}
                  alt={f.name}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"
                >
                  <X size={11} />
                </button>
                {files.length > 1 ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
                    {i + 1}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <label
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
            onClick={(e) => {
              if (files.length >= MAX_ITEMS) {
                e.preventDefault()
                toast(`You can add up to ${MAX_ITEMS} items`, { icon: '📸' })
              }
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                if (fileRef.current) fileRef.current.value = ''
              }}
            />
            <Image size={14} /> Add photo/video ({files.length}/{MAX_ITEMS})
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !canPost}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Post
          </button>
        </div>
      </div>
    </div>
  )
}
