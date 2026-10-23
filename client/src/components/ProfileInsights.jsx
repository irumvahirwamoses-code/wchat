import { useEffect, useState } from 'react'
import {
  BarChart3,
  Bookmark,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Repeat2,
  Users,
} from 'lucide-react'
import api, { getApiError } from '../config/api'
import { getFileUrl } from '../utils/api'

/**
 * Profile insights.
 *
 * Shows the account's own numbers — audience, Sparks, comments, saves and
 * plays, what was published over the last 7 days, and the posts that landed
 * best. Everything comes from real data (`GET /api/users/insights`); nothing
 * is a vanity metric.
 */
export default function ProfileInsights({ className = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .get('/users/insights')
      .then(({ data: payload }) => {
        if (active) {
          setData(payload)
          setError('')
        }
      })
      .catch((err) => {
        if (active) setError(getApiError(err, 'Could not load your insights'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className={`flex justify-center py-10 ${className}`}>
        <Loader2 className="animate-spin text-wchat" size={18} />
      </div>
    )
  }

  if (error || !data) {
    return <p className={`py-8 text-center text-xs text-zinc-500 ${className}`}>{error || 'No insights yet'}</p>
  }

  const totals = data.totals || {}
  const last7 = data.last7Days || {}
  const week = Array.isArray(data.week) ? data.week : []
  const maxDay = Math.max(1, ...week.map((day) => (day.posts || 0) + (day.reels || 0)))

  const tiles = [
    { key: 'sparks', label: 'Sparks', icon: Heart, value: totals.sparks || 0 },
    { key: 'comments', label: 'Comments', icon: MessageCircle, value: totals.comments || 0 },
    { key: 'saves', label: 'Saves', icon: Bookmark, value: totals.saves || 0 },
    { key: 'shares', label: 'Shares', icon: Repeat2, value: totals.shares || 0 },
    { key: 'plays', label: 'Reel plays', icon: Eye, value: totals.reelPlays || 0 },
    { key: 'followers', label: 'Followers', icon: Users, value: totals.followers || 0 },
  ]

  return (
    <div className={`space-y-5 ${className}`}>
      <p className="text-xs text-zinc-500">
        How your posts, Reels and Circles are doing. Only you can see this.
      </p>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <BarChart3 size={14} className="text-wchat" /> Overview
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.key} className="rounded-lg bg-zinc-950/60 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <tile.icon size={12} /> {tile.label}
              </p>
              <p className="mt-1 text-lg font-bold text-zinc-100">{tile.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <Heart size={14} className="text-wchat" /> This week
        </h3>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          <span>
            <span className="font-semibold text-zinc-200">{last7.posts || 0}</span> posts
          </span>
          <span>
            <span className="font-semibold text-zinc-200">{last7.reels || 0}</span> Reels
          </span>
          <span>
            <span className="font-semibold text-zinc-200">{last7.comments || 0}</span> comments
            received
          </span>
        </div>
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {week.map((day) => {
            const count = (day.posts || 0) + (day.reels || 0)
            const height = count === 0 ? 4 : Math.max(8, Math.round((count / maxDay) * 100))
            const label = new Date(day.date).toLocaleDateString(undefined, { weekday: 'narrow' })
            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  title={`${count} published`}
                  style={{ height: `${height}%` }}
                  className={`w-full rounded-t ${count ? 'bg-wchat/70' : 'bg-zinc-800'}`}
                />
                <span className="text-[10px] text-zinc-600">{label}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <Heart size={14} className="text-wchat" /> Your top posts
        </h3>
        {data.topPosts?.length ? (
          <ul className="mt-3 divide-y divide-zinc-800/70">
            {data.topPosts.map((post) => (
              <li key={post._id} className="flex items-center gap-3 py-2.5">
                {post.media ? (
                  post.mediaType === 'video' ? (
                    <video
                      src={getFileUrl(post.media)}
                      className="h-12 w-12 shrink-0 rounded-lg bg-black object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={getFileUrl(post.media)}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  )
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-zinc-800 text-[10px] text-zinc-500">
                    Text
                  </span>
                )}
                <p className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                  {post.excerpt || 'Media post'}
                </p>
                <span className="shrink-0 text-[11px] text-zinc-500">
                  {post.sparks} ♥ · {post.comments} 💬
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-zinc-500">
            Post something and its reach will show up here.
          </p>
        )}
      </section>

      <p className="text-[11px] text-zinc-600">
        You have {totals.circles || 0} Circles and follow {totals.following || 0} people.
      </p>
    </div>
  )
}
