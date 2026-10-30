import { useState } from 'react'
import { Flag, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'

const REASONS = [
  { id: 'spam', label: 'Spam or unwanted content' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hate speech' },
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'violence', label: 'Violence or dangerous content' },
  { id: 'misinformation', label: 'False information' },
  { id: 'scam', label: 'Scam or fraud' },
  { id: 'other', label: 'Something else' },
]

/** Report a user / post / comment / message / story to the super admin. */
export default function ReportModal({ targetType, targetId, targetName, onClose }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!reason) {
      toast.error('Please choose a reason')
      return
    }
    setBusy(true)
    try {
      await api.post('/support/report', {
        targetType,
        targetId,
        reason,
        details: details.trim(),
      })
      toast.success('Report sent. Thank you for keeping Wchat safe.')
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not send report'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Flag size={16} className="text-rose-400" />
          Report {targetName || 'content'}
        </h3>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-xs text-zinc-400">
          Tell us what is wrong. Reports are reviewed by the WUT team.
        </p>

        <div className="space-y-1.5">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                reason === r.id
                  ? 'border-rose-400/60 bg-rose-500/10 text-rose-200'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full border ${
                  reason === r.id ? 'border-rose-400' : 'border-zinc-600'
                }`}
              >
                {reason === r.id ? <span className="h-2 w-2 rounded-full bg-rose-400" /> : null}
              </span>
              {r.label}
            </button>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Add any details that help us review this (optional)"
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-400/60"
        />

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
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-400 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Submit report
          </button>
        </div>
      </div>
    </div>
  )
}
