import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Shared modal shell: dark card, backdrop click + Escape to close.
 */
export default function Modal({ children, onClose, size = 'max-w-lg' }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        className={`animate-scale-in max-h-[92vh] w-full ${size} overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-2xl`}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ icon, title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <X size={18} />
      </button>
    </div>
  )
}
