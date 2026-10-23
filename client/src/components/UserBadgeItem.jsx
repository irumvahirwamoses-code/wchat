import { X } from 'lucide-react'
import { formatHandle } from '../utils/handle'

/** Selected-member chip with a remove button. */
export default function UserBadgeItem({ user, onRemove }) {
  if (!user) return null
  const name =
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    user.username ||
    'User'
  const username = user.username ? formatHandle(user.username) : ''

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 py-1 pl-2.5 pr-1 text-xs text-zinc-200">
      <span className="max-w-[130px] truncate">{name}</span>
      {username && username !== name ? (
        <span className="text-[10px] text-zinc-500">{username}</span>
      ) : null}
      <button
        type="button"
        onClick={() => onRemove?.(user)}
        aria-label={`Remove ${name}`}
        className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-red-400"
      >
        <X size={12} />
      </button>
    </span>
  )
}
