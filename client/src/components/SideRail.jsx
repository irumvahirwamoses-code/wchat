import { MessageSquareHeart, Palette, Plus, ShieldCheck } from 'lucide-react'
import { PRIMARY_NAV, SECONDARY_NAV } from '../config/nav'
import Logo from './Logo'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'
import { applyTheme, getTheme, nextTheme } from '../utils/theme'

export const NAV_ITEMS = [...PRIMARY_NAV, ...SECONDARY_NAV]

/**
 * Desktop / tablet rail. Icon-only on medium screens, icon + label on large.
 * The five primary sections come first, with Messages and Communities grouped
 * underneath.
 */
export default function SideRail({
  active = 'home',
  onChange,
  onNewPost,
  onOpenProfile,
  onOpenAdmin,
  onOpenFeedback,
  unreadChat = 0,
}) {
  const { user } = useAuth()
  const primary = PRIMARY_NAV.filter((item) => !item.action)

  const renderItem = (item) => {
    const Icon = item.icon
    const on = item.id === active
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onChange?.(item.id)}
        title={item.label}
        aria-current={on ? 'page' : undefined}
        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
          on
            ? 'bg-wchat/10 text-wchat'
            : 'text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-200'
        }`}
      >
        <span className="relative shrink-0">
          <Icon size={22} strokeWidth={on ? 2.4 : 1.9} />
          {item.id === 'chat' && unreadChat > 0 ? (
            <span className="absolute -right-2 -top-1.5 grid min-w-[15px] place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {unreadChat > 99 ? '99+' : unreadChat}
            </span>
          ) : null}
        </span>
        <span className="hidden lg:inline">{item.label}</span>
      </button>
    )
  }

  return (
    <aside className="hidden h-full w-[76px] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-900/40 md:flex lg:w-64">
      <div className="flex items-center gap-3 px-3 py-4 lg:px-4">
        <Logo size={34} />
        <span className="hidden text-lg font-extrabold tracking-tight text-zinc-100 lg:inline">
          Wchat
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 lg:px-3">
        {primary.map(renderItem)}

        <button
          type="button"
          onClick={onNewPost}
          title="Create"
          className="mt-1 flex w-full items-center gap-3 rounded-xl bg-gradient-to-br from-wchat-400 to-wchat px-3 py-2.5 text-left text-sm font-semibold text-white shadow-sm shadow-wchat/30 transition hover:brightness-105"
        >
          <Plus size={21} strokeWidth={2.6} className="shrink-0" />
          <span className="hidden lg:inline">Create</span>
        </button>

        <div className="my-2 hidden border-t border-zinc-800/80 lg:block" />

        {SECONDARY_NAV.map(renderItem)}
      </nav>

      <div className="flex flex-col gap-1 border-t border-zinc-800/80 px-2 py-3 lg:px-3">
        {onOpenAdmin ? (
          <button
            type="button"
            onClick={onOpenAdmin}
            title="Super admin console"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-wchat transition hover:bg-wchat/10"
          >
            <ShieldCheck size={20} className="shrink-0" />
            <span className="hidden lg:inline">Admin</span>
          </button>
        ) : null}

        {onOpenFeedback ? (
          <button
            type="button"
            onClick={onOpenFeedback}
            title="Send feedback"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-500 transition hover:bg-zinc-800/70 hover:text-zinc-200"
          >
            <MessageSquareHeart size={20} className="shrink-0" />
            <span className="hidden lg:inline">Feedback</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => applyTheme(nextTheme(getTheme()))}
          title="Switch theme"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-500 transition hover:bg-zinc-800/70 hover:text-zinc-200"
        >
          <Palette size={20} className="shrink-0" />
          <span className="hidden lg:inline">Theme</span>
        </button>

        <button
          type="button"
          onClick={onOpenProfile}
          title="Your profile"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-zinc-800/70"
        >
          <Avatar
            src={user?.profilePicture}
            name={`${user?.firstName || ''} ${user?.lastName || ''}`}
            size={28}
          />
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-semibold text-zinc-200">
              {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'You'}
            </span>
            <span className="block truncate text-[11px] text-zinc-500">
              @{user?.username || 'wchat'}
            </span>
          </span>
        </button>
      </div>
    </aside>
  )
}
