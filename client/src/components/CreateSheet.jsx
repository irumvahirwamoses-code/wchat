import { Clapperboard, Image, Plus, Users, X } from 'lucide-react'

const OPTIONS = [
  { id: 'post', title: 'Post', hint: 'Photo or video — up to 10 in a carousel', icon: Image },
  { id: 'story', title: 'Story', hint: 'Disappears after 24 hours', icon: Plus },
  { id: 'reel', title: 'Reel', hint: 'Short video with music, filters and text', icon: Clapperboard },
  { id: 'community', title: 'Community', hint: 'Create a Circle and invite people', icon: Users },
]

/**
 * The Create chooser: what do you want to make?
 * Post (carousel) · Story (24h) · Reel (short video).
 */
export default function CreateSheet({ onClose, onPick }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-scale-in w-full max-w-md overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-950 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Create</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </header>

        <div className="grid gap-3 p-4">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPick?.(opt.id)}
                className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition hover:border-wchat/50 hover:bg-zinc-900"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-wchat-400 to-wchat text-white">
                  <Icon size={20} strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-100">{opt.title}</span>
                  <span className="block text-xs text-zinc-500">{opt.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
