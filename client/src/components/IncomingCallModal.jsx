import { Phone, PhoneOff, Video } from 'lucide-react'
import Avatar from './Avatar'

export default function IncomingCallModal({ call, onAccept, onReject }) {
  if (!call) return null
  const isVideo = call.callType === 'video'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-zinc-950/90 px-6 backdrop-blur">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="animate-ring rounded-full">
          <Avatar name={call.name} size={112} />
        </span>
        <div>
          <p className="text-xl font-semibold text-zinc-100">{call.name}</p>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-zinc-400">
            {isVideo ? <Video size={15} /> : <Phone size={15} />}
            Incoming {isVideo ? 'video' : 'voice'} call…
          </p>
        </div>
      </div>

      <div className="flex items-center gap-10">
        <button
          type="button"
          onClick={onReject}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition hover:bg-red-400"
          title="Decline"
        >
          <PhoneOff size={26} />
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
          title="Accept"
        >
          {isVideo ? <Video size={26} /> : <Phone size={26} />}
        </button>
      </div>
    </div>
  )
}
