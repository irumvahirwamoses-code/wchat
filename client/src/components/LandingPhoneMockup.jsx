import { ChevronLeft, Mic, Phone, Plus, Smile, Video } from 'lucide-react'
import { cn } from '../utils/cn'

const avatar = (seed, bg = 'c7d5ff') =>
  `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`

export default function LandingPhoneMockup({ className = '' }) {
  const eric = avatar('Eric', 'd6ccff')
  const keza = avatar('Keza', 'c7d5ff')
  return (
    <div
      className={cn(
        'relative w-[290px] rounded-[3rem] bg-[color:var(--landing-reel)] p-2.5 shadow-float ring-1 ring-white/15 sm:w-[310px]',
        className,
      )}
    >
      <div className="relative h-[600px] overflow-hidden rounded-[2.5rem] bg-white">
        <div className="absolute left-1/2 top-2.5 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-[color:var(--landing-reel)]" />
        <div className="glass flex items-center gap-2 border-b border-zinc-200/70 px-3 pb-3 pt-10">
          <ChevronLeft className="size-5 text-zinc-900" />
          <span className="relative">
            <img src={eric} alt="" className="size-9 rounded-full bg-zinc-100" />
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-zinc-900">Eric Mugisha</p>
            <p className="text-[11px] font-semibold text-emerald-600">online</p>
          </div>
          <Phone className="size-[18px] text-[color:var(--landing-blue)]" />
          <Video className="ml-2 size-5 text-[color:var(--landing-blue)]" />
        </div>

        <div className="space-y-2.5 px-3 py-4 text-[13px] text-zinc-900">
          <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Today</p>
          <Bubble>Welcome to Wchat. Your Circles are ready.</Bubble>
          <Bubble mine>Looks amazing. Let&apos;s start a Reel.</Bubble>
          <div className="ml-auto flex w-[62%] items-center gap-2 rounded-2xl rounded-br-md bg-gradient-brand px-3 py-2.5 text-white">
            <span className="flex size-6 items-center justify-center rounded-full bg-white/20"><Mic className="size-3.5" /></span>
            <span className="flex flex-1 items-center gap-[2px]">
              {[4, 9, 6, 12, 8, 14, 5, 10, 7, 12, 4, 8, 6].map((h, i) => (
                <span key={i} className="w-[2.5px] rounded-full bg-white/80" style={{ height: h }} />
              ))}
            </span>
            <span className="text-[10px] font-semibold">0:14</span>
          </div>
          <Bubble>Join the call later? The Circle is live.</Bubble>
          <div className="flex items-center gap-2">
            <img src={eric} alt="" className="size-6 rounded-full bg-zinc-100" />
            <span className="flex gap-1 rounded-full bg-white px-3 py-2.5 shadow-card">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-zinc-200/70 bg-white px-3 pb-6 pt-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-[color:var(--landing-blue)]"><Plus className="size-4" /></span>
          <span className="flex flex-1 items-center rounded-full bg-zinc-100 px-3 py-2 text-[12px] text-zinc-500">Message… <Smile className="ml-auto size-4" /></span>
          <img src={keza} alt="" className="size-8 rounded-full bg-zinc-100" />
        </div>
      </div>
    </div>
  )
}

function Bubble({ children, mine }) {
  return (
    <div
      className={cn(
        'w-fit max-w-[78%] rounded-2xl px-3 py-2 leading-snug',
        mine ? 'ml-auto rounded-br-md bg-gradient-brand text-white' : 'rounded-bl-md bg-white text-zinc-900 shadow-card',
      )}
    >
      {children}
    </div>
  )
}
