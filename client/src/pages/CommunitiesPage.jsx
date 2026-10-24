import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Briefcase,
  Calendar,
  Film,
  MessageCircle,
  Plus,
  Trophy,
  Users,
} from 'lucide-react'
import Avatar from '../components/Avatar'
import api, { getApiError } from '../config/api'

const SECTION_META = [
  { key: 'reel', label: 'Reels', icon: Film },
  { key: 'library', label: 'Library', icon: BookOpen },
  { key: 'challenge', label: 'Challenges', icon: Trophy },
  { key: 'event', label: 'Events', icon: Calendar },
  { key: 'opportunity', label: 'Opportunities', icon: Briefcase },
]

export default function CommunitiesPage({ onOpenHub, onCreate, onOpenChat, onError }) {
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Circles | Wchat'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/circles/mine')
      setCommunities(Array.isArray(data) ? data : [])
    } catch (error) {
      onError?.(getApiError(error, 'Could not load your Communities'))
      setCommunities([])
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-800/80 px-4 py-3">
        <Users size={20} className="text-amber-400" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-zinc-100">Communities</h1>
          <p className="text-[11px] text-zinc-500">
            One community, multiple ways to participate
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-300"
        >
          <Plus size={14} /> New Circle
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-500">
            <div className="spinner" />
            <p className="text-sm">Loading Communities…</p>
          </div>
        ) : communities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Users size={30} className="text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">
              You have not joined a Circle yet
            </p>
            <p className="max-w-xs text-xs text-zinc-600">
              Circles are mini social networks. Create one or discover communities
              to join.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {communities.map((circle) => (
              <div
                key={circle._id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={circle.groupAvatar}
                    name={circle.chatName}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {circle.chatName}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {circle.memberCount ?? (circle.users || []).length} members
                      {circle.category ? ` · ${circle.category}` : ''}
                      {circle.joinPolicy === 'open' ? ' · Open' : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SECTION_META.map((meta) => {
                    const count = circle.counts?.[meta.key] || 0
                    const Icon = meta.icon
                    return (
                      <span
                        key={meta.key}
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-800/80 px-2 py-1 text-[10px] font-medium text-zinc-400"
                      >
                        <Icon size={11} className="text-amber-400" />
                        {meta.label}
                        {count ? (
                          <span className="text-zinc-300">{count}</span>
                        ) : null}
                      </span>
                    )
                  })}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenHub?.(circle)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-300"
                  >
                    <Users size={14} /> Community hub
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenChat?.(circle)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
                  >
                    <MessageCircle size={14} /> Open chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
