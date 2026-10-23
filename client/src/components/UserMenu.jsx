import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Compass,
  LogOut,
  Plus,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useSocket } from '../context/SocketContext'
import { formatHandle } from '../utils/handle'

export default function UserMenu({
  triggerClassName = '',
  showNewGroup = false,
  onNewGroup,
  showJoinRequests = true,
  showDiscover = false,
  onOpenDiscover,
  onOpenProfile,
}) {
  const { user, logout } = useAuth()
  const { fetchJoinRequests, pendingJoinRequestCount } = useChat()
  const { onlineUsers } = useSocket()

  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    setOpen(false)
    logout()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full ring-2 ring-transparent transition hover:ring-amber-400/60 ${triggerClassName}`}
      >
        <Avatar
          src={user?.profilePicture}
          name={`${user?.firstName || ''} ${user?.lastName || ''}`}
          size={36}
          online={onlineUsers.includes(user?._id)}
        />
      </button>
      {open ? (
        <div className="animate-scale-in absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="border-b border-zinc-800 px-4 py-3">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
            </p>
            <p className="truncate text-xs font-semibold text-wchat">
              {formatHandle(user?.username)}
            </p>
          </div>
          <MenuItem
            icon={<User size={16} />}
            label="Profile"
            onClick={() => {
              setOpen(false)
              onOpenProfile?.(user)
            }}
          />
          {showNewGroup ? (
            <MenuItem
              icon={<Plus size={16} />}
              label="New Circle"
              onClick={() => {
                setOpen(false)
                onNewGroup?.()
              }}
            />
          ) : null}
          {showJoinRequests ? (
            <MenuItem
              icon={<Bell size={16} />}
              label="Join requests"
              onClick={() => {
                setOpen(false)
                fetchJoinRequests()
                toast('Open a Circle you administer to review requests', { icon: '👋' })
              }}
              badge={pendingJoinRequestCount}
            />
          ) : null}
          {showDiscover ? (
            <MenuItem
              icon={<Compass size={16} />}
              label="Discover"
              onClick={() => {
                setOpen(false)
                onOpenDiscover?.()
              }}
            />
          ) : null}
          <MenuItem icon={<LogOut size={16} />} label="Log out" onClick={handleLogout} danger />
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({ icon, label, onClick, badge = 0, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-200 hover:bg-zinc-800/70'
      }`}
    >
      <span className="text-zinc-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge > 0 ? (
        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  )
}
