import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useChat } from '../context/ChatContext'

export default function StoryComposer({ onClose, onCreated }) {
  const { chats } = useChat()
  const communities = chats.filter((c) => c.circleType !== 'personal')
  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [circleId, setCircleId] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!file) return toast.error('Select an image or video')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('media', file)
      if (caption) fd.append('caption', caption)
      if (circleId) fd.append('circleId', circleId)
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
        <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
          <option value="">My timeline</option>
          {communities.map((c) => <option key={c._id} value={c._id}>{c.chatName}</option>)}
        </select>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        <div className="flex justify-end">
          <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-white">
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Share
          </button>
        </div>
      </div>
    </div>
  )
}
