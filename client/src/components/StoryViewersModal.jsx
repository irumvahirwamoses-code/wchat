import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import api from '../config/api'
import Avatar from './Avatar'

export default function StoryViewersModal({ storyId, onClose }) {
  const [viewers, setViewers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get(`/stories/${storyId}/viewers`)
      .then(({ data }) => {
        setViewers(Array.isArray(data.viewers) ? data.viewers : [])
      })
      .catch(() => {
        setViewers([])
      })
      .finally(() => setLoading(false))
  }, [storyId])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">Story viewers</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-amber-400" />
              <p className="mt-2 text-xs text-zinc-500">Loading viewers…</p>
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-zinc-500">No viewers yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {viewers.map((viewer) => {
                const name =
                  `${viewer.firstName || ''} ${viewer.lastName || ''}`.trim() ||
                  viewer.username ||
                  'Someone'
                return (
                  <div key={viewer._id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition">
                    <Avatar
                      src={viewer.profilePicture}
                      name={name}
                      size={32}
                    />
                    <span className="min-w-0 truncate text-sm text-zinc-200">{name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 px-4 py-3 text-right">
          <span className="text-[10px] text-zinc-500">
            {viewers.length} view{viewers.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
