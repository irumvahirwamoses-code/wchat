import { useEffect, useState } from 'react'
import { Wrench, RefreshCw } from 'lucide-react'
import Logo from '../components/Logo'
import api from '../config/api'

/**
 * Full-screen "we'll be right back" page shown to everyone except super admins
 * while the platform is in maintenance mode.
 */
export default function MaintenancePage({ message, until }) {
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    document.title = 'Wchat is under maintenance'
  }, [])

  const recheck = async () => {
    setChecking(true)
    try {
      const { data } = await api.get('/system/status')
      if (!data?.maintenanceEnabled) window.location.reload()
      else window.location.reload()
    } catch {
      window.location.reload()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 text-center text-zinc-100">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-wchat/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 flex max-w-md flex-col items-center">
        <Logo size={54} textClassName="text-zinc-100" />
        <div className="mt-8 grid h-16 w-16 place-items-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
          <Wrench size={30} />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Wchat is getting an upgrade
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {message ||
            'We are temporarily unavailable while we make improvements. Please check back soon.'}
        </p>
        {until ? (
          <p className="mt-3 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-xs text-zinc-400">
            Expected back {new Date(until).toLocaleString()}
          </p>
        ) : null}

        <button
          type="button"
          onClick={recheck}
          disabled={checking}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-wchat-400 to-wchat px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-wchat/25 transition hover:brightness-105 disabled:opacity-60"
        >
          <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
          Check again
        </button>

        <p className="mt-10 text-[11px] text-zinc-600">
          A product of WUT Company · © {new Date().getFullYear()} WUT Company
        </p>
      </div>
    </div>
  )
}
