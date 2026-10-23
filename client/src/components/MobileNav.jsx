import { Plus } from 'lucide-react'
import { PRIMARY_NAV } from '../config/nav'

/**
 * Mobile bottom navigation: Home · Explore · **Create** · Reels · Profile.
 * Honours the iOS home-indicator safe area and never exceeds five targets.
 */
export default function MobileNav({ active = 'home', onChange }) {
  return (
    <nav className="pb-safe border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id

          if (item.action) {
            return (
              <li key={item.id} className="flex-1">
                <button
                  type="button"
                  aria-label="Create"
                  onClick={() => onChange?.(item.id)}
                  className="flex w-full flex-col items-center gap-0.5 py-1.5"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-wchat-400 to-wchat text-white shadow-sm shadow-wchat/30">
                    <Plus size={17} strokeWidth={2.6} />
                  </span>
                  <span className="text-[10px] font-medium text-zinc-500">{item.label}</span>
                </button>
              </li>
            )
          }

          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange?.(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition ${
                  isActive ? 'text-wchat' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
