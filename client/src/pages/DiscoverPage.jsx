import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase,
  Calendar,
  Check,
  Compass,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from '../components/Avatar'
import PostCard from '../components/PostCard'
import ReasonBadge from '../components/ReasonBadge'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { formatHandle } from '../utils/handle'
import { getId } from '../utils/api'

const TABS = [
  { id: 'posts', label: 'Buzz', icon: Sparkles },
  { id: 'people', label: 'People', icon: UserPlus },
  { id: 'circles', label: 'Circles', icon: Users },
  { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
]

const OPP_FILTERS = [
  { id: 'opportunity', label: 'Opportunities', icon: Briefcase },
  { id: 'event', label: 'Events', icon: Calendar },
  { id: 'challenge', label: 'Challenges', icon: Trophy },
]

function PeopleTab({ onOpenProfile, onError }) {
  const { fetchChats } = useChat()
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [following, setFollowing] = useState({})
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/users', {
        params: term.trim() ? { search: term.trim() } : {},
      })
      setUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      onError?.(getApiError(error, 'Could not search people'))
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [term, onError])

  useEffect(() => {
    load()
  }, [load])

  const toggleJoin = async (person) => {
    setBusy(person._id)
    try {
      const { data } = await api.post(`/users/${person._id}/follow`)
      setFollowing((prev) => ({ ...prev, [person._id]: data.following }))
      toast.success(data.following ? `Joined ${person.firstName}` : 'Left')
      fetchChats()
    } catch (error) {
      toast.error(getApiError(error, 'Could not update'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="relative mb-3">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search people by name or @username"
          className={`${fieldClass} pl-9`}
        />
      </div>

      {loading ? (
        <Center><div className="spinner" /></Center>
      ) : users.length === 0 ? (
        <Empty
          icon={UserPlus}
          title="No people found"
          hint="Try another name or username."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((person) => {
            const isJoined = following[person._id]
            const name = `${person.firstName || ''} ${person.lastName || ''}`.trim()
            return (
              <div
                key={person._id}
                className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3"
              >
                <button type="button" onClick={() => onOpenProfile?.(person)}>
                  <Avatar src={person.profilePicture} name={name} size={44} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {name || person.username}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {formatHandle(person.username)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleJoin(person)}
                  disabled={busy === person._id}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                    isJoined
                      ? 'border-zinc-700 bg-zinc-800 text-zinc-100'
                      : 'border-amber-400/60 text-amber-300 hover:bg-amber-400/10'
                  }`}
                >
                  {busy === person._id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : isJoined ? (
                    <Check size={13} />
                  ) : (
                    <UserPlus size={13} />
                  )}
                  {isJoined ? 'Joined' : 'Join'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function CirclesTab({ onOpenHub, onError }) {
  const { user } = useAuth()
  const { chats, fetchChats } = useChat()
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [requested, setRequested] = useState({})
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/chats/discover', {
        params: term.trim() ? { search: term.trim() } : {},
      })
      setGroups(Array.isArray(data) ? data : [])
    } catch (error) {
      onError?.(getApiError(error, 'Could not load Circles'))
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [term, onError])

  useEffect(() => {
    load()
  }, [load])

  const requestJoin = async (group) => {
    setBusy(group._id)
    try {
      const { data } = await api.post(`/chats/${group._id}/join-request`)
      setRequested((prev) => ({ ...prev, [group._id]: true }))
      toast.success(data?.message || 'Join request sent')
      fetchChats()
    } catch (error) {
      toast.error(getApiError(error, 'Could not send the join request'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="relative mb-3">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search public Circles"
          className={`${fieldClass} pl-9`}
        />
      </div>

      {loading ? (
        <Center><div className="spinner" /></Center>
      ) : groups.length === 0 ? (
        <Empty
          icon={Compass}
          title="No Circles found"
          hint="Try a different search."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => {
            const isMember = chats.some((chat) => chat._id === group._id)
            const isRequested = Boolean(requested[group._id])
            const interests = (user?.interests || []).map((interest) =>
              String(interest).toLowerCase()
            )
            const fitReason =
              group.category && interests.includes(String(group.category).toLowerCase())
                ? `Because you're into ${group.category}`
                : ''
            return (
              <div
                key={group._id}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={group.groupAvatar} name={group.chatName} size={46} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {group.chatName}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {group.memberCount ?? 0} members
                      {group.category ? ` · ${group.category}` : ''}
                      {group.joinPolicy === 'open' ? ' · open' : ''}
                    </p>
                    {fitReason ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-wchat/80">
                        <Sparkles size={11} /> {fitReason}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      isMember ? onOpenHub?.(group) : requestJoin(group)
                    }
                    disabled={isRequested || busy === group._id}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {busy === group._id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : null}
                    {isMember
                      ? 'Open Circle'
                      : isRequested
                        ? 'Requested'
                        : group.joinPolicy === 'open'
                          ? 'Join'
                          : 'Request to join'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function OpportunitiesTab({ onOpenHub, onError }) {
  const { user } = useAuth()
  const [kind, setKind] = useState('opportunity')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [sparks, setSparks] = useState({})
  const [taking, setTaking] = useState({})
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/circles/feed/discover', {
        params: { kind },
      })
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      onError?.(getApiError(error, 'Could not load'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [kind, onError])

  useEffect(() => {
    load()
  }, [load])

  const spark = async (item) => {
    const chatId = getId(item.chat)
    try {
      const { data } = await api.post(
        `/circles/${chatId}/items/${item._id}/spark`
      )
      setSparks((prev) => ({ ...prev, [item._id]: data }))
    } catch (error) {
      toast.error(getApiError(error, 'Could not save your Spark'))
    }
  }

  // Turning discovery into taking part: join a challenge or say you're going to
  // an event straight from Explore, without opening the Circle first.
  const takePart = async (item) => {
    const chatId = getId(item.chat)
    if (!chatId) return
    setBusy(item._id)
    try {
      const { data } = await api.post(`/circles/${chatId}/items/${item._id}/join`)
      setTaking((prev) => ({ ...prev, [item._id]: data }))
      toast.success(data?.participating ? 'You are taking part' : 'You left')
    } catch (error) {
      toast.error(getApiError(error, 'Could not update your place'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {OPP_FILTERS.map((filter) => {
          const Icon = filter.icon
          const on = filter.id === kind
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setKind(filter.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                on
                  ? 'bg-amber-400 text-white'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={13} />
              {filter.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <Center><div className="spinner" /></Center>
      ) : items.length === 0 ? (
        <Empty
          icon={Briefcase}
          title={`No ${kind === 'opportunity' ? 'opportunities' : `${kind}s`} yet`}
          hint="They appear here when posted inside your Circles."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const author = item.author || {}
            const authorName =
              `${author.firstName || ''} ${author.lastName || ''}`.trim() ||
              author.username
            const sparkState = sparks[item._id]
            const count =
              sparkState?.sparkCount ?? item.sparkCount ?? (item.sparks || []).length
            const sparked = sparkState
              ? sparkState.sparked
              : (item.sparks || []).some((id) => getId(id) === getId(user?._id))
            const takeState = taking[item._id]
            const participantCount =
              takeState?.count ?? (item.participants || []).length
            const joined = takeState
              ? takeState.participated
              : (item.participants || []).some(
                  (id) => getId(id) === getId(user?._id)
                )
            const canTakePart =
              item.kind === 'event' || item.kind === 'challenge'
            return (
              <article
                key={item._id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    {item.kind}
                  </span>
                  {item.chat?.chatName ? (
                    <ReasonBadge
                      reason={`From ${item.chat.chatName}`}
                      code="circle"
                    />
                  ) : null}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-zinc-100">
                  {item.title}
                </h3>
                {item.description ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-400">
                    {item.description}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                  {authorName ? <span>By {authorName}</span> : null}
                  {item.date ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />{' '}
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  ) : null}
                  {item.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {item.location}
                    </span>
                  ) : null}
                </div>
                {item.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => spark(item)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      sparked
                        ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                        : 'border-zinc-700 text-zinc-400 hover:border-amber-400/50 hover:text-amber-300'
                    }`}
                  >
                    <Sparkles size={14} /> {count}
                  </button>

                  {canTakePart ? (
                    <button
                      type="button"
                      onClick={() => takePart(item)}
                      disabled={busy === item._id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
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
                      {participantCount > 0 ? (
                        <span className="text-[10px] font-normal opacity-80">
                          {participantCount}
                        </span>
                      ) : null}
                    </button>
                  ) : null}

                  {onOpenHub && item.chat?._id ? (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenHub({ _id: getId(item.chat), chatName: item.chat.chatName })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-wchat/60 hover:text-white"
                    >
                      <Users size={13} /> Open Circle
                    </button>
                  ) : null}

                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs font-semibold text-amber-300 hover:underline"
                    >
                      Open link
                    </a>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

function PostsTab({ onError }) {
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(
    async (nextPage = 1, replace = true) => {
      setLoading(true)
      try {
        const { data } = await api.get('/posts/explore', {
          params: { page: nextPage, limit: 10, ...(term.trim() ? { q: term.trim() } : {}) },
        })
        setPosts((prev) => (replace ? data.posts || [] : [...prev, ...(data.posts || [])]))
        setHasMore(Boolean(data.hasMore))
        setPage(nextPage + 1)
      } catch (error) {
        onError?.(getApiError(error, 'Could not load Buzz'))
        if (replace) setPosts([])
      } finally {
        setLoading(false)
      }
    },
    [term, onError]
  )

  useEffect(() => {
    load(1, true)
  }, [load])

  return (
    <>
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts, #hashtags or locations"
          className={`${fieldClass} pl-9`}
        />
      </div>

      {loading && posts.length === 0 ? (
        <Center><div className="spinner" /></Center>
      ) : posts.length === 0 ? (
        <Empty icon={Sparkles} title="Nothing buzzing yet" hint="Public posts you haven't joined appear here." />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} showReason />
            ))}
          </div>
          {hasMore ? (
            <button
              type="button"
              onClick={() => load(page, false)}
              className="mt-4 w-full rounded-lg border border-zinc-800 py-2 text-xs text-zinc-400 hover:bg-zinc-900"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </>
      )}
    </>
  )
}

export default function DiscoverPage({ onOpenProfile, onOpenHub, onOpenCommunities, onError }) {
  const [tab, setTab] = useState('posts')

  useEffect(() => {
    document.title = 'Discover | Wchat'
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <header className="border-b border-zinc-800/80 px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <Compass size={20} className="text-wchat" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-zinc-100">Explore</h1>
            <p className="text-[11px] text-zinc-500">
              People, public Circles, events and opportunities
            </p>
          </div>
          {onOpenCommunities ? (
            <button
              type="button"
              onClick={onOpenCommunities}
              className="shrink-0 rounded-xl border border-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-wchat/50 hover:text-wchat"
            >
              Your Communities
            </button>
          ) : null}
        </div>
        <nav className="no-scrollbar mx-auto mt-3 flex max-w-xl gap-1.5 overflow-x-auto">
          {TABS.map((entry) => {
            const Icon = entry.icon
            const on = entry.id === tab
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  on
                    ? 'bg-wchat text-white'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon size={13} />
                {entry.label}
              </button>
            )
          })}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl">
          {tab === 'posts' ? <PostsTab onError={onError} /> : null}
          {tab === 'people' ? (
            <PeopleTab onOpenProfile={onOpenProfile} onError={onError} />
          ) : null}
          {tab === 'circles' ? (
            <CirclesTab onOpenHub={onOpenHub} onError={onError} />
          ) : null}
          {tab === 'opportunities' ? (
            <OpportunitiesTab onOpenHub={onOpenHub} onError={onError} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Center({ children }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-zinc-500">
      {children}
    </div>
  )
}

function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Icon size={28} className="text-zinc-600" />
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="max-w-xs text-xs text-zinc-600">{hint}</p>
    </div>
  )
}

const fieldClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/60'
