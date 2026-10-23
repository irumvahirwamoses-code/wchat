import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Navigation, Radio, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiError } from '../config/api'
import { useChat } from '../context/ChatContext'

const DURATIONS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
]

const geolocate = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This device cannot share a location'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error('Location permission was denied')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  })

/**
 * Shares a live location into the open chat. Positions are pushed while you
 * move (throttled) and the share ends on its own when the timer runs out.
 */
export default function LiveLocationModal({ chatId, onClose }) {
  const { sendLiveLocation, moveLiveLocation, stopLiveLocation } = useChat()

  const [duration, setDuration] = useState(60)
  const [starting, setStarting] = useState(false)
  const [messageId, setMessageId] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const watchRef = useRef(null)
  const lastSentRef = useRef(0)

  const clearWatch = useCallback(() => {
    if (watchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current)
    }
    watchRef.current = null
  }, [])

  // Tidy up the geolocation watcher whenever the modal unmounts.
  useEffect(() => clearWatch, [clearWatch])

  // Countdown to the end of the share.
  useEffect(() => {
    if (!expiresAt) return undefined
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) clearWatch()
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, clearWatch])

  const endShare = async (silent) => {
    clearWatch()
    if (messageId) {
      try {
        await stopLiveLocation(messageId)
      } catch (error) {
        if (!silent) toast.error(getApiError(error, 'Could not stop sharing'))
      }
    }
    setMessageId(null)
    setExpiresAt(null)
    if (!silent) toast.success('Live location ended')
  }

  const start = async () => {
    setStarting(true)
    try {
      const position = await geolocate()
      const message = await sendLiveLocation(chatId, {
        ...position,
        durationMinutes: duration,
      })

      setMessageId(message._id)
      setExpiresAt(Date.now() + duration * 60 * 1000)
      toast.success('Sharing your live location')

      // Push moves, at most once every 20 seconds.
      watchRef.current = navigator.geolocation.watchPosition(
        (next) => {
          const now = Date.now()
          if (now - lastSentRef.current < 20000) return
          lastSentRef.current = now
          moveLiveLocation(message._id, {
            latitude: next.coords.latitude,
            longitude: next.coords.longitude,
          }).catch(() => {})
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 }
      )
    } catch (error) {
      toast.error(getApiError(error, error.message || 'Could not share your location'))
    } finally {
      setStarting(false)
    }
  }

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-wchat/15 text-wchat">
            <Navigation size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">Live location</h2>
            <p className="text-[11px] text-zinc-500">
              Share where you are for up to one hour.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              endShare(true)
              onClose?.()
            }}
            aria-label="Close"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        {messageId ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
              <Radio size={14} className="animate-pulse" /> Sharing live
            </p>
            <p className="mt-1 text-[11px] text-emerald-200/80">
              {remaining > 0
                ? `Ends in ${minutes}:${String(seconds).padStart(2, '0')}`
                : 'This share has ended.'}
            </p>
            <button
              type="button"
              onClick={() => endShare(false)}
              className="mt-3 w-full rounded-xl border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10"
            >
              Stop sharing
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-1.5">
              {DURATIONS.map((option) => (
                <button
                  key={option.minutes}
                  type="button"
                  onClick={() => setDuration(option.minutes)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                    duration === option.minutes
                      ? 'border-wchat bg-wchat/10 text-zinc-100'
                      : 'border-zinc-800 text-zinc-300 hover:border-wchat/40'
                  }`}
                >
                  {option.label}
                  <MapPin size={14} className="text-wchat" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-wchat px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {starting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Navigation size={15} />
              )}
              Start sharing
            </button>
            <p className="mt-2 text-[11px] text-zinc-500">
              Your browser will ask for permission. The share stops automatically
              when the timer runs out.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
