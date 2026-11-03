import { useEffect, useState } from 'react'
import { Loader2, MessageSquareHeart, X, ChevronRight, Clock } from 'lucide-react'
import api from '../config/api'
import { formatTime } from '../utils/api'

const STATUS_LABEL = {
  open: 'Open',
  reviewed: 'Reviewed',
  resolved: 'Resolved',
}

const STATUS_COLOR = {
  open: 'text-amber-400',
  reviewed: 'text-sky-400',
  resolved: 'text-emerald-400',
}

export default function FeedbackResultsPage({ onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/support/feedback')
      .then(({ data }) => {
        setItems(Array.isArray(data.feedback) ? data.feedback : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-6 py-8 text-center">
          <Loader2 size={24} className="animate-spin text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading your feedback…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-3 flex items-center justify-between backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X size={18} />
        </button>
        <h2 className="text-sm font-semibold text-zinc-100">My Feedback</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageSquareHeart size={40} className="text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-400">No feedback yet</p>
            <p className="text-xs text-zinc-500 mt-1">
              Send feedback from Settings → Help & Support, and admin replies will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {items.map((f) => {
              const resolved = f.status === 'resolved'
              return (
                <div key={f._id} className="border-b border-zinc-800/60 px-4 py-3.5 last:border-0">
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`text-[9px] font-medium ${STATUS_COLOR[f.status]}`}>
                      {STATUS_LABEL[f.status]}
                    </span>
                    <span className="ml-auto text-[10px] text-zinc-500">
                      {formatTime(f.createdAt)}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                      {f.type}
                    </span>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap">
                      {f.message}
                    </p>
                    {f.rating && (
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Rating: {f.rating}/5
                      </p>
                    )}
                  </div>
                  {resolved && f.adminReply && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-[9px] font-medium text-emerald-400">
                          Admin response
                        </span>
                        <span className="ml-auto text-[10px] text-zinc-500">
                          {formatTime(f.updatedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 whitespace-pre-wrap">
                        {f.adminReply}
                      </p>
                    </div>
                  )}
                  {!resolved && (
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Awaiting admin response…
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
