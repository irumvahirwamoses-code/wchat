import { useCallback, useEffect, useState } from 'react'
import { Compass, Loader2, Search, UserCheck, UserPlus, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useChat } from '../context/ChatContext'
import Avatar from './Avatar'
import Modal, { ModalHeader } from './Modal'

const SORT_OPTIONS = [
  { value: 'followers', label: 'Most followers' },
  { value: 'members', label: 'Most members' },
  { value: 'recent', label: 'Most recent' },
]

export default function GroupDiscovery({ onClose }) {
  const { chats } = useChat()

  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('')
  const [feature, setFeature] = useState('')
  const [sort, setSort] = useState('followers')
  const [options, setOptions] = useState({ categories: [], features: [] })
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [followMap, setFollowMap] = useState({})
  const [requested, setRequested] = useState({})
  const [busy, setBusy] = useState(null)

  // Debounce the free-text search.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    api
      .get('/options')
      .then(({ data }) =>
        setOptions({
          categories: Array.isArray(data?.categories) ? data.categories : [],
          features: Array.isArray(data?.features) ? data.features : [],
        })
      )
      .catch(() => {
        /* filters fall back to All */
      })
  }, [])

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (term.trim()) params.search = term.trim()
      if (category) params.category = category
      if (feature) params.feature = feature
      if (sort) params.sort = sort
      const { data } = await api.get('/chats/discover', { params })
      setGroups(Array.isArray(data) ? data : [])
    } catch (error) {
      toast.error(getApiError(error, 'Could not load groups'))
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [term, category, feature, sort])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const toggleFollow = async (group) => {
    const id = group._id
    const current = followMap[id] ?? Boolean(group.isFollowing)
    setBusy(`follow-${id}`)
    try {
      const { data } = await api.post(`/chats/${id}/follow`)
      const next =
        typeof data?.isFollowing === 'boolean' ? data.isFollowing : !current
      setFollowMap((prev) => ({ ...prev, [id]: next }))
      toast.success(
        next ? `Joined ${group.chatName}` : `Left ${group.chatName}`
      )
    } catch (error) {
      toast.error(getApiError(error, 'Could not update your membership'))
    } finally {
      setBusy(null)
    }
  }

  const requestJoin = async (group) => {
    setBusy(`join-${group._id}`)
    try {
      const { data } = await api.post(`/chats/${group._id}/join-request`)
      setRequested((prev) => ({ ...prev, [group._id]: true }))
      toast.success(data?.message || 'Join request sent to the admin')
    } catch (error) {
      toast.error(getApiError(error, 'Could not send the join request'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal onClose={onClose} size="max-w-3xl">
      <ModalHeader
        icon={<Compass size={20} />}
        title="Discover Circles"
        subtitle="Find communities to join"
        onClose={onClose}
      />

      <div className="space-y-4 px-5 py-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Circles"
              className={`${inputClass} pl-9`}
            />
          </div>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={inputClass}
          >
            <option value="">All categories</option>
            {options.categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={feature}
            onChange={(event) => setFeature(event.target.value)}
            className={inputClass}
          >
            <option value="">All features</option>
            {options.features.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className={inputClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
            <div className="spinner" />
            <p className="text-sm">Loading groups…</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-zinc-500">
            <Users size={28} className="text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">No groups found</p>
            <p className="text-xs">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => {
              const isMember = chats.some((chat) => chat._id === group._id)
              const isFollowing = followMap[group._id] ?? Boolean(group.isFollowing)
              const isRequested = Boolean(requested[group._id])
              return (
                <div
                  key={group._id}
                  className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={group.groupAvatar} name={group.chatName} size={48} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {group.chatName}
                      </p>
                      {group.category ? (
                        <span className="mt-0.5 inline-block rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          {group.category}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {group.features?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {group.features.slice(0, 3).map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="text-xs text-zinc-500">
                    {group.memberCount ?? 0} members · {group.followerCount ?? 0}{' '}
                    followers
                  </p>

                  <div className="mt-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFollow(group)}
                      disabled={busy === `follow-${group._id}`}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                        isFollowing
                          ? 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                          : 'border-amber-400/50 text-amber-300 hover:bg-amber-400/10'
                      }`}
                    >
                      {busy === `follow-${group._id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isFollowing ? (
                        <UserCheck size={14} />
                      ) : (
                        <UserPlus size={14} />
                      )}
                      {isFollowing ? 'Joined' : 'Join'}
                    </button>

                    <button
                      type="button"
                      onClick={() => requestJoin(group)}
                      disabled={
                        isMember || isRequested || busy === `join-${group._id}`
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      {busy === `join-${group._id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                      {isMember ? 'Member' : isRequested ? 'Requested' : 'Request to join'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/60'
