import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Compass,
  Loader2,
  LogOut,
  MessageCircle,
  MessageSquareHeart,
  Plus,
  Search,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useSocket } from '../context/SocketContext'
import Avatar from './Avatar'
import Logo from './Logo'
import { formatHandle } from '../utils/handle'

export default function SideDrawer({ onOpenProfile, onOpenDiscovery, onNewGroup, onOpenAdmin, onOpenFeedback }) {
  const { user, logout } = useAuth()
  const { selectChat, fetchChats, pendingJoinRequestCount, fetchJoinRequests } =
    useChat()
  const { onlineUsers } = useSocket()

  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [startingChat, setStartingChat] = useState(null)

  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setMenuOpen(false)
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced user search.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 1) {
      setResults([])
      setSearching(false)
      return undefined
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/users', { params: { search: term } })
        setResults(Array.isArray(data) ? data : [])
        setSearchOpen(true)
      } catch (error) {
        toast.error(getApiError(error, 'Search failed'))
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  const openPrivateChat = async (target) => {
    if (startingChat) return
    setStartingChat(target._id)
    try {
      const { data } = await api.post('/chats', { userId: target._id })
      await fetchChats()
      selectChat(data)
      setQuery('')
      setResults([])
      setSearchOpen(false)
      setMenuOpen(false)
    } catch (error) {
      toast.error(getApiError(error, 'Could not open that conversation'))
    } finally {
      setStartingChat(null)
    }
  }

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
  }

  const handleOpenProfile = () => {
    setMenuOpen(false)
    onOpenProfile?.(user)
  }

  const handleOpenDiscovery = () => {
    setMenuOpen(false)
    onOpenDiscovery?.()
  }

  const handleOpenJoinRequests = () => {
    setMenuOpen(false)
    fetchJoinRequests()
    toast('Open a group you administer to review requests', { icon: '👋' })
  }

  return (
    <div
      ref={containerRef}
      className="relative z-20 border-b border-zinc-800/80 bg-zinc-900/60 px-3 pb-3 pt-3 backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <Logo size={36} textClassName="text-zinc-100" />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onNewGroup}
            title="New group"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-400"
          >
            <Plus size={18} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((v) => !v)
                setSearchOpen(false)
              }}
              className="rounded-full ring-2 ring-transparent transition hover:ring-amber-400/60"
              title="My account"
            >
              <Avatar
                src={user?.profilePicture}
                name={`${user?.firstName || ''} ${user?.lastName || ''}`}
                size={36}
                online={onlineUsers.includes(user?._id)}
              />
            </button>

            {menuOpen ? (
              <div className="animate-scale-in absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
                  </p>
                  <p className="truncate text-xs font-semibold text-wchat">
                    {formatHandle(user?.username)}
                  </p>
                </div>
                <MenuItem icon={<User size={16} />} label="Profile" onClick={handleOpenProfile} />
                <MenuItem
                  icon={<Bell size={16} />}
                  label="Join requests"
                  onClick={handleOpenJoinRequests}
                  badge={pendingJoinRequestCount}
                />
                <MenuItem
                  icon={<Compass size={16} />}
                  label="Discover groups"
                  onClick={handleOpenDiscovery}
                />
                {onOpenAdmin ? (
                  <MenuItem
                    icon={<ShieldCheck size={16} />}
                    label="Admin console"
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenAdmin()
                    }}
                  />
                ) : null}
                {onOpenFeedback ? (
                  <MenuItem
                    icon={<MessageSquareHeart size={16} />}
                    label="Send feedback"
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenFeedback()
                    }}
                  />
                ) : null}
                <MenuItem
                  icon={<LogOut size={16} />}
                  label="Log out"
                  onClick={handleLogout}
                  danger
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative mt-3">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query.trim() && setSearchOpen(true)}
          placeholder="Search people by name or @username"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/70 py-2.5 pl-9 pr-9 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/60"
        />
        {searching ? (
          <Loader2
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-400"
          />
        ) : null}

        {searchOpen && query.trim() ? (
          <div className="animate-scale-in absolute left-0 right-0 top-12 z-30 max-h-80 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">
                {searching ? 'Searching…' : 'No people found'}
              </p>
            ) : (
              results.map((result) => (
                <button
                  key={result._id}
                  type="button"
                  onClick={() => openPrivateChat(result)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-zinc-800/70"
                >
                  <Avatar
                    src={result.profilePicture}
                    name={`${result.firstName || ''} ${result.lastName || ''}`}
                    size={40}
                    online={onlineUsers.includes(result._id) || result.isOnline}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-100">
                      {`${result.firstName || ''} ${result.lastName || ''}`.trim()}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {formatHandle(result.username)}
                    </span>
                  </span>
                  {startingChat === result._id ? (
                    <Loader2 size={16} className="animate-spin text-amber-400" />
                  ) : (
                    <MessageCircle size={16} className="text-zinc-500" />
                  )}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MenuItem({ icon, label, onClick, badge = 0, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-zinc-200 hover:bg-zinc-800/70'
      }`}
    >
      <span className="text-zinc-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge > 0 ? (
        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
      {label === 'Discover groups' && badge === 0 ? (
        <Users size={13} className="text-zinc-600" />
      ) : null}
    </button>
  )
}
