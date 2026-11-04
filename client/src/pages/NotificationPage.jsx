import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Loader2, X, ChevronRight, MessageCircle, Heart, AtSign, UserPlus, MessageSquareHeart } from 'lucide-react'
import api from '../config/api'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { formatTime } from '../utils/api'
import { formatHandle } from '../utils/handle'

const ICONS = {
  spark: Heart,
  comment: MessageCircle,
  mention: AtSign,
  join: UserPlus,
  invite: UserPlus,
  announcement: Bell,
  feedback: MessageSquareHeart,
}

const COLORS = {
  spark: 'text-amber-400',
  comment: 'text-sky-400',
  mention: 'text-wchat',
  join: 'text-emerald-400',
  invite: 'text-emerald-400',
  announcement: 'text-zinc-400',
  feedback: 'text-emerald-400',
}

export default function NotificationPage({ onClose }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications?limit=50'),
        api.get('/notifications/unread-count'),
      ])
      setItems(listRes.data.notifications || [])
      setUnreadCount(countRes.data.count || 0)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      /* ignore */
    }
  }

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read')
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-6 py-8 text-center">
          <Loader2 size={24} className="animate-spin text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading notifications…</p>
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
        <h2 className="text-sm font-semibold text-zinc-100">Notifications</h2>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            className="text-[10px] font-medium text-amber-300 hover:text-amber-200"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell size={40} className="text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-400">No notifications yet</p>
            <p className="text-xs text-zinc-500 mt-1">
              Likes, comments, mentions, and Circle activity appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {items.map((n) => {
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
                  onClick={() => {
                    markRead(n._id)
                    if (n.type === 'feedback' && n.feedback) {
                      navigate(`/feedback/${n.feedback}`)
                      onClose()
                    }
                  }}
                  className={`flex items-start gap-3 border-b border-zinc-800/60 px-4 py-3.5 text-left transition last:border-0 hover:bg-zinc-900/60 ${
                    n.read ? '' : 'bg-amber-400/5'
                  }`}
                >
                  <Avatar src={actor.profilePicture} name={name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug text-zinc-300">
                      <span className="font-semibold text-zinc-100">{name}</span>{' '}
                      {actor.username ? (
                        <span className="text-zinc-500">@{actor.username} </span>
                      ) : null}
                      {n.text}
                      {n.circle?.chatName ? (
                        <span className="text-zinc-500"> in {n.circle.chatName}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                      <Icon size={11} className={COLORS[n.type]} />
                      {formatTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                  )}
                  <ChevronRight size={14} className="text-zinc-600 shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
