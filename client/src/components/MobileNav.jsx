import { Bell, MessageCircle, Plus } from 'lucide-react'
import { PRIMARY_NAV, SECONDARY_NAV } from '../config/nav'

/**
 * Mobile bottom navigation: Home · Explore · **Create** · Reels · Profile · Messages.
 * Honours the iOS home-indicator safe area and never exceeds five targets.
 */
export default function MobileNav({
  active = 'home',
  onChange,
  unread = 0,
  onOpenNotifications,
  unreadNotifications = 0,
  className = '',
}) {
  const secondary = SECONDARY_NAV.filter((item) => item.id === 'chat')
  return (
    <nav className={`pb-safe border-t border-zinc-800/70 wchat-glass md:hidden ${className}`.trim()}>
      <div className="mx-auto flex max-w-lg items-center justify-between px-2 pb-2 pt-1.5">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id

          if (item.action) {
            return (
              <button
                key={item.id}
                type="button"
                aria-label="Create"
                onClick={() => onChange?.(item.id)}
                className="flex flex-col items-center gap-0.5 py-1.5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-2xl wchat-gradient text-white wchat-glow">
                  <Plus size={18} strokeWidth={2.6} />
                </span>
                <span className="text-[10px] font-medium text-zinc-500">{item.label}</span>
              </button>
            )
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange?.(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${
                isActive ? 'text-wchat' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
              {item.label}
            </button>
          )
        })}
        {secondary.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          const count = unread || 0
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange?.(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${
                isActive ? 'text-wchat' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
              {item.label}
              {count > 0 ? (
                <span className="absolute right-0 top-0.5 grid min-w-[14px] place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">
                  {count > 9 ? '9+' : count}
                </span>
              ) : null}
            </button>
          )
        })}
        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium text-zinc-500 transition hover:text-wchat"
          >
            <Bell size={21} />
            {unreadNotifications > 0 ? (
              <span className="absolute right-0 top-0.5 grid min-w-[14px] place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            ) : null}
            <span className="text-[10px]">Alerts</span>
          </button>
        )}
      </div>
    </nav>
  )
}
