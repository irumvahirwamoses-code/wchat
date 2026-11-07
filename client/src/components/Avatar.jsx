import { useEffect, useState } from 'react'
import { getFileUrl, getInitials } from '../utils/api'

function normalizeFrame(frame) {
  if (!frame || typeof frame !== 'object') return null
  const zoom = Math.min(4, Math.max(1, Number(frame.zoom) || 1))
  const x = Math.min(100, Math.max(-100, Number(frame.x) || 0))
  const y = Math.min(100, Math.max(-100, Number(frame.y) || 0))
  if (zoom === 1 && x === 0 && y === 0) return null
  return { zoom, x, y }
}

/**
 * Circular avatar with graceful initials fallback and optional online dot.
 * `frame` is non-destructive positioning for profile photos:
 * `{ zoom, x, y }` where x/y are percentages of image size.
 */
export default function Avatar({
  src,
  frame,
  name,
  size = 48,
  online = false,
  className = '',
  rounded = 'rounded-full',
  imgClassName = '',
}) {
  const dimension = typeof size === 'number' ? `${size}px` : size
  const fontSize = Math.max(11, Math.round(Number(size) * 0.36) || 14)
  const [hasImage, setHasImage] = useState(Boolean(src))
  const f = normalizeFrame(frame)

  useEffect(() => {
    setHasImage(Boolean(src))
  }, [src])

  const imageStyle = f
    ? {
        width: `${100 * f.zoom}%`,
        height: `${100 * f.zoom}%`,
        maxWidth: 'none',
        transform: `translate(calc(-50% + ${f.x}%), calc(-50% + ${f.y}%))`,
      }
    : undefined

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: dimension, height: dimension }}
      title={name || undefined}
    >
      <div className={`relative h-full w-full overflow-hidden ${rounded} bg-zinc-800`}>
        {src && hasImage ? (
          <img
            src={getFileUrl(src)}
            alt={name || 'avatar'}
            className={`${f ? 'absolute left-1/2 top-1/2 h-full w-full select-none object-cover' : 'h-full w-full object-cover'} ${imgClassName}`}
            style={imageStyle}
            onError={() => setHasImage(false)}
            onLoad={() => setHasImage(true)}
            draggable={false}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-semibold text-zinc-200"
            style={{ fontSize }}
          >
            {getInitials(name)}
          </div>
        )}
      </div>
      {online ? (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 bg-emerald-500" />
      ) : null}
    </div>
  )
}
