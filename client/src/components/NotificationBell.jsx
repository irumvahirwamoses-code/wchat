import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Loader2 } from 'lucide-react'
import api from '../config/api'
import Avatar from './Avatar'
import { useSocket } from '../context/SocketContext'
import { formatTime } from '../utils/api'
import { formatHandle } from '../utils/handle'

const ICONS = {
  spark: Heart,
  comment: MessageCircle,
  mention: AtSign,
  join: UserPlus,
  invite: UserPlus,
  announcement: Bell,
}

const COLORS = {
  spark: 'text-amber-400',
  comment: 'text-sky-400',
  mention: 'text-wchat',
  join: 'text-emerald-400',
  invite: 'text-emerald-400',
  announcement: 'text-zinc-400',
}

/** Home-bell activity feed: mentions, replies, sparks, Circle joins & invites. */
export default function NotificationBell() {
  const { socket } = useSocket()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  const loadCount = useCallback(() => {
    api
      .get('/notifications/unread-count')
      .then(({ data }) => setCount(data.count || 0))
      .catch(() => {})
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications?limit=20')
      setItems(data.notifications || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCount()
  }, [loadCount])

  // Live activity while the app is open.
  useEffect(() => {
    if (!socket) return undefined
    const onNotify = (n) => {
      setCount((c) => c + 1)
      setItems((prev) => [n, ...prev].slice(0, 30))
    }
    socket.on('notification', onNotify)
    return () => socket.off('notification', onNotify)
  }, [socket])

  useEffect(() => {
    if (open) loadList()
  }, [open, loadList])

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read')
      setCount(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      /* ignore */
    }
  }

  const openItem = async (n) => {
    if (!n.read) {
      api.put(`/notifications/${n._id}/read`).catch(() => {})
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)))
      setCount((c) => Math.max(0, c - 1))
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Activity"
        className="relative rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
      >
        <Bell size={18} />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-40 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl">
          <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <h3 className="text-xs font-semibold text-zinc-200">Activity</h3>
            {count > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] font-medium text-amber-300 hover:text-amber-200"
              >
                Mark all read
              </button>
            ) : null}
          </header>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-amber-400" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] text-zinc-500">
                No activity yet. Sparks, replies and mentions land here.
              </p>
            ) : (
              items.map((n) => {
                const Icon = ICONS[n.type] || Bell
                const actor = n.actor || {}
                const name =
                  `${actor.firstName || ''} ${actor.lastName || ''}`.trim() ||
                  actor.username ||
                  'Someone'
                return (
                  <button
                    key={n._id}
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-2.5 border-b border-zinc-800/60 px-3 py-2.5 text-left transition last:border-0 hover:bg-zinc-900/60 ${
                      n.read ? '' : 'bg-amber-400/5'
                    }`}
                  >
                    <Avatar src={actor.profilePicture} name={name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] leading-snug text-zinc-300">
                        <span className="font-semibold text-zinc-100">{name}</span>{' '}
                        {actor.username ? (
                          <span className="text-zinc-500">{formatHandle(actor.username)} </span>
                        ) : null}
                        {n.text}
                        {n.circle?.chatName ? (
                          <span className="text-zinc-500"> in {n.circle.chatName}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
                        <Icon size={11} className={COLORS[n.type]} />
                        {formatTime(n.createdAt)}
                      </p>
                    </div>
                    {n.read ? null : (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
