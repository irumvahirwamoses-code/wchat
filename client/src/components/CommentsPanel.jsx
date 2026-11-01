import { useEffect, useState } from 'react'
import { Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { formatHandle } from '../utils/handle'
import { formatTime } from '../utils/api'
import { filterHidden } from '../utils/contentFilter'

export default function CommentsPanel({ post, onClose }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    api
      .get(`/posts/${post._id}/comments`)
      .then(({ data }) => {
        if (active) {
          setComments(Array.isArray(data) ? data : [])
          setError(null)
        }
      })
      .catch((err) => {
        if (active) setError(getApiError(err, 'Could not load comments'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [post._id])

  const add = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const { data } = await api.post(`/posts/${post._id}/comments`, {
        text: text.trim(),
      })
      setComments((prev) => [...prev, data])
      setText('')
    } catch (err) {
      setError(getApiError(err, 'Could not add comment'))
      toast.error(getApiError(err, 'Could not add comment'))
    } finally {
      setBusy(false)
    }
  }

  // Mute comments containing a hidden word.
  const visible = filterHidden(comments, (c) => c.text)

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 sm:rounded-2xl p-6">
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-500">
            <div className="spinner" />
            <p className="text-sm">Loading comments…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">Comments</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-rose-400">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setLoading(true)
                window.location.reload()
              }}
              className="rounded-md px-3 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 py-3">
          {visible.length === 0 ? (
            <p className="text-center text-xs text-zinc-500">No comments yet</p>
          ) : (
            visible.map((c) => {
              const a = c.author || {}
              return (
                <div key={c._id} className="flex gap-2">
                  <Avatar src={a.profilePicture} name={`${a.firstName||''} ${a.lastName||''}`} size={32} />
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-300"><span className="font-semibold">{a.username ? `@${a.username}` : a.firstName}</span> {c.text}</p>
                    <p className="text-[10px] text-zinc-500">{formatTime(c.createdAt)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-zinc-800 px-3 py-2">
          <Avatar src={user?.profilePicture} name={`${user?.firstName||''} ${user?.lastName||''}`} size={32} />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500" />
          <button type="button" onClick={add} disabled={busy || !text.trim()} className="rounded-full p-2 text-zinc-500 hover:text-amber-400 disabled:opacity-40"><Send size={16} /></button>
        </div>
      </div>
    </div>
  )
}
