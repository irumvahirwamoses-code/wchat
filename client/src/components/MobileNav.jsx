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
}) {
  const secondary = SECONDARY_NAV.filter((item) => item.id === 'chat')
  return (
    <nav className="pb-safe border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur md:hidden">
      <div className="flex justify-between px-2 pb-2 pt-1">
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
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-wchat-400 to-wchat text-white shadow-sm shadow-wchat/30">
                  <Plus size={17} strokeWidth={2.6} />
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
              className={`flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition ${
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
              className={`flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition relative ${
                isActive ? 'text-wchat' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
              {item.label}
              {count > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-w-[12px] place-items-center rounded-full bg-rose-500 px-0.5 text-[8px] font-bold text-white">
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
            className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition text-zinc-500 hover:text-amber-400"
          >
            <Bell size={21} />
            {unreadNotifications > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-w-[12px] place-items-center rounded-full bg-rose-500 px-0.5 text-[8px] font-bold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            ) : null}
            <span className="text-[10px]">Notify</span>
          </button>
        )}
      </div>
    </nav>
  )
}
