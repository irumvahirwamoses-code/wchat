import { useState } from 'react'
import { Loader2, MessageSquareHeart, Star, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'

const TYPES = [
  { id: 'feedback', label: 'General feedback' },
  { id: 'bug', label: 'Something is broken' },
  { id: 'feature', label: 'Feature request' },
  { id: 'content', label: 'Report content' },
  { id: 'other', label: 'Other' },
]

/**
 * Members send feedback / bug reports / feature requests straight to the
 * super admin inbox in the dashboard.
 */
export default function FeedbackModal({ onClose }) {
  const [type, setType] = useState('feedback')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!message.trim()) {
      toast.error('Please write a message')
      return
    }
    setBusy(true)
    try {
      await api.post('/support/feedback', {
        type,
        rating: rating || undefined,
        message: message.trim(),
        page: window.location.pathname,
      })
      toast.success('Thank you! Your feedback was sent to the WUT team.')
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not send feedback'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareHeart size={16} className="text-amber-400" />
          Send feedback
        </h3>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">What is this about?</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
          >
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            How would you rate Wchat? (optional)
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n === rating ? 0 : n)}
                className="p-0.5"
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={24}
                  className={n <= rating ? 'text-amber-400' : 'text-zinc-700'}
                  fill={n <= rating ? '#fbbf24' : 'none'}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Your message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Tell us what you think, what broke, or what you would love to see…"
            className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
          />
          <p className="mt-1 text-right text-[10px] text-zinc-600">{message.length}/2000</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-wchat-400 to-wchat px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-wchat/25 transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
