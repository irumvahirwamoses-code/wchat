import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  Calendar,
  Check,
  Loader2,
  MapPin,
  Sparkles,
  Trophy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { getId } from '../utils/api'
import { useAuth } from '../context/AuthContext'

/**
 * "Take part today" — the bridge from discovery to participation on Home.
 *
 * Events and challenges posted inside the member's Circles show up here as
 * cards you can act on in one tap: say you're going, or join the challenge,
 * without hunting through the Circle first.
 */
export default function ParticipationRail({ onExplore, onOpenHub }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [state, setState] = useState({})
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.get('/circles/feed/discover', { params: { kind: 'event' } }),
      api.get('/circles/feed/discover', { params: { kind: 'challenge' } }),
    ])
      .then(([events, challenges]) => {
        if (cancelled) return
        const merged = [...(events.data || []), ...(challenges.data || [])]

        // Dated things first, soonest at the front; undated items follow.
        merged.sort((a, b) => {
          if (a.date && b.date) return new Date(a.date) - new Date(b.date)
          if (a.date) return -1
          if (b.date) return 1
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        })

        setItems(merged.slice(0, 6))
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const takePart = async (item) => {
    const chatId = getId(item.chat)
    if (!chatId) return
    setBusy(item._id)
    try {
      const { data } = await api.post(`/circles/${chatId}/items/${item._id}/join`)
      setState((prev) => ({ ...prev, [item._id]: data }))
      toast.success(data?.participating ? "You're taking part" : 'You left')
    } catch (error) {
      toast.error(getApiError(error, 'Could not update your place'))
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) return null

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
          <Sparkles size={13} className="text-wchat" /> Take part today
        </h2>
        {onExplore ? (
          <button
            type="button"
            onClick={onExplore}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-wchat transition hover:brightness-110"
          >
            Explore <ArrowRight size={12} />
          </button>
        ) : null}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => {
          const takeState = state[item._id]
          const joined = takeState
            ? takeState.participating
            : (item.participants || []).some(
                (id) => getId(id) === getId(user?._id)
              )
          const count = takeState?.count ?? (item.participants || []).length

          return (
            <article
              key={item._id}
              className="flex w-60 shrink-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-wchat/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-wchat">
                  {item.kind}
                </span>
                {item.chat?.chatName ? (
                  <button
                    type="button"
                    onClick={() => onOpenHub?.(item.chat)}
                    className="truncate text-[10px] text-zinc-500 transition hover:text-zinc-300"
                  >
                    {item.chat.chatName}
                  </button>
                ) : null}
              </div>

              <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-100">
                {item.title}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                {item.date ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} /> {new Date(item.date).toLocaleDateString()}
                  </span>
                ) : null}
                {item.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {item.location}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => takePart(item)}
                disabled={busy === item._id}
                className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                  joined
                    ? 'border-wchat/60 bg-wchat/15 text-wchat'
                    : 'border-amber-400/60 text-amber-300 hover:bg-amber-400/10'
                }`}
              >
                {busy === item._id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : joined ? (
                  <Check size={13} />
                ) : (
                  <Trophy size={13} />
                )}
                {joined
                  ? 'Going'
                  : item.kind === 'event'
                    ? "I'm going"
                    : 'Join challenge'}
                {count > 0 ? (
                  <span className="text-[10px] font-normal opacity-80">{count}</span>
                ) : null}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
