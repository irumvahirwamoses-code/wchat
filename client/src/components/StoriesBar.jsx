import { Plus } from 'lucide-react'
import Avatar from './Avatar'
import { getId } from '../utils/api'

/**
 * The Stories tray at the top of Home — 24-hour disappearing photos and clips.
 * Horizontally scrollable, with the member's own "add" bubble first.
 */
export default function StoriesBar({ rings = [], currentUser, onAddStory, onOpenStory }) {
  return (
    <div className="no-scrollbar snap-rail flex items-center gap-3 overflow-x-auto border-b border-zinc-800/70 px-4 py-3">
      <button
        type="button"
        onClick={onAddStory}
        className="flex shrink-0 flex-col items-center gap-1.5"
      >
        <span className="relative">
          <Avatar
            src={currentUser?.profilePicture}
            name={`${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`}
            size={62}
          />
          <span className="absolute -bottom-0.5 right-0 grid h-6 w-6 place-items-center rounded-full border-2 border-zinc-950 bg-wchat text-white">
            <Plus size={14} strokeWidth={2.8} />
          </span>
        </span>
        <span className="max-w-[68px] truncate text-[11px] font-medium text-zinc-300">
          Your story
        </span>
      </button>

      {rings.map((ring) => {
        const owner = ring.owner || {}
        const name = `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
        const label = owner.username ? `@${owner.username}` : name || 'Member'
        const seen = ring.seen ?? ring.allSeen
        return (
          <button
            key={getId(ring) || getId(owner)}
            type="button"
            onClick={() => onOpenStory?.(ring)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={`grid h-[68px] w-[68px] place-items-center rounded-full p-[2.5px] ${
                seen
                  ? 'bg-zinc-700'
                  : 'bg-gradient-to-tr from-wchat via-wchat-400 to-ink-400'
              }`}
            >
              <span className="grid h-full w-full place-items-center rounded-full bg-zinc-950 p-[2px]">
                <Avatar src={owner.profilePicture} name={name || label} size={58} />
              </span>
            </span>
            <span className="max-w-[68px] truncate text-[11px] text-zinc-400">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
