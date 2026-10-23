/**
 * Wchat brand mark + wordmark.
 *
 * The mark is two interlocking rings — "circles" connecting — on the Wchat
 * gradient (electric blue #245BFF → deep indigo #24145B).
 */

export function WchatMark({ size = 40, className = '', rounded = 'rounded-2xl' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center wchat-gradient text-white shadow-lg shadow-wchat/25 ${rounded} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" width={size * 0.62} height={size * 0.62} fill="none">
        <circle cx="19" cy="24" r="7.5" stroke="currentColor" strokeWidth="3.4" />
        <circle cx="29" cy="24" r="7.5" stroke="currentColor" strokeWidth="3.4" opacity="0.72" />
      </svg>
    </span>
  )
}

export default function Logo({
  size = 40,
  showWord = true,
  tagline = '',
  className = '',
  textClassName = '',
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <WchatMark size={size} />
      {showWord ? (
        <span className="flex flex-col leading-none">
          <span
            className={`text-[1.35rem] font-extrabold tracking-tight text-ink ${textClassName}`}
          >
            Wchat
          </span>
          {tagline ? (
            <span className="mt-1 text-[11px] font-medium text-ink/50">{tagline}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
