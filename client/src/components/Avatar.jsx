import { getFileUrl, getInitials } from '../utils/api'

/**
 * Circular avatar with graceful initials fallback and optional online dot.
 */
export default function Avatar({
  src,
  name,
  size = 48,
  online = false,
  className = '',
  rounded = 'rounded-full',
}) {
  const dimension = typeof size === 'number' ? `${size}px` : size
  const fontSize = Math.max(11, Math.round(Number(size) * 0.36) || 14)

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      {src ? (
        <img
          src={getFileUrl(src)}
          alt={name || 'avatar'}
          className={`h-full w-full object-cover ${rounded} bg-zinc-800`}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800 font-semibold text-zinc-200 ${rounded}`}
          style={{ fontSize }}
        >
          {getInitials(name)}
        </div>
      )}
      {online ? (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 bg-emerald-500" />
      ) : null}
    </div>
  )
}
