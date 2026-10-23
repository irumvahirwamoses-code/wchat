import { useState } from 'react'
import {
  HelpCircle,
  MapPin,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react'

/**
 * Each feed reason code maps to an icon and a plain-language explanation, so
 * a member can always answer "why am I seeing this?".
 */
const REASONS = {
  self: {
    icon: Users,
    hint: 'This is your own post.',
  },
  circle: {
    icon: Users,
    hint: 'It was shared in a Circle you belong to.',
  },
  creator: {
    icon: UserCheck,
    hint: 'You joined this creator, so their posts reach you early.',
  },
  tag: {
    icon: Sparkles,
    hint: 'It matches a topic you told Wchat you are interested in.',
  },
  nearby: {
    icon: MapPin,
    hint: 'It is happening around the place you are part of.',
  },
  trending: {
    icon: TrendingUp,
    hint: 'It is getting a lot of Sparks and comments on Wchat right now.',
  },
}

const HOW_IT_WORKS =
  'Wchat builds your stream from the Circles you are in, the people you joined, and what matches your interests and area. Fresh posts get a small boost so you see news as it happens — nothing is shown purely because it is popular.'

/**
 * The "why you're seeing this" line shown under a post or Reel.
 *
 * @param reason  Short sentence, e.g. "From Technology Rwanda".
 * @param code    Reason code from the server (`circle`, `creator`, `tag`…).
 * @param detail  The specific Circle / person / tag behind the decision.
 * @param onHide  Optional "not interested" handler.
 */
export default function ReasonBadge({
  reason,
  code = 'trending',
  detail = '',
  className = '',
  onHide,
}) {
  const [open, setOpen] = useState(false)

  if (!reason) return null

  const meta = REASONS[code] || REASONS.trending
  const Icon = meta.icon
  const showDetail = detail && !String(reason).includes(detail)

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Icon size={12} className="shrink-0 text-wchat" />
        <span className="min-w-0 truncate">
          {reason}
          {showDetail ? <span className="text-zinc-600"> · {detail}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Why am I seeing this?"
          className="shrink-0 rounded-full p-0.5 text-zinc-500 transition hover:text-zinc-200"
        >
          <HelpCircle size={12} />
        </button>
        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            aria-label="Not interested"
            title="Show me less like this"
            className="shrink-0 rounded-full p-0.5 text-zinc-500 transition hover:text-zinc-200"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left shadow-2xl">
            <p className="text-[11px] font-semibold text-zinc-100">
              Why you&apos;re seeing this
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
              {meta.hint}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              {HOW_IT_WORKS}
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
