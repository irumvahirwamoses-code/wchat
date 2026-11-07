import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import Avatar from './Avatar'

export default function CallModal({
  state,
  callType,
  peerName,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  onEnd,
}) {
  const localRef = useRef(null)
  const remoteRef = useRef(null)
  const remoteAudioRef = useRef(null)

  useEffect(() => {
    const el = localRef.current
    if (!el) return
    if (el.srcObject !== localStream) el.srcObject = localStream || null
    el.muted = true
    if (localStream) el.play?.().catch(() => {})
  }, [localStream])

  useEffect(() => {
    const el = remoteRef.current
    if (!el) return
    if (el.srcObject !== remoteStream) el.srcObject = remoteStream || null
    if (remoteStream) el.play?.().catch(() => {})
  }, [remoteStream])

  useEffect(() => {
    const el = remoteAudioRef.current
    if (!el) return
    if (el.srcObject !== remoteStream) el.srcObject = remoteStream || null
    if (remoteStream) el.play?.().catch(() => {})
  }, [remoteStream])

  const isVideo = callType === 'video'
  const hasRemoteVideo = Boolean(remoteStream?.getVideoTracks?.().some((t) => t.readyState === 'live'))
  const hasRemoteAudio = Boolean(remoteStream?.getAudioTracks?.().some((t) => t.readyState === 'live'))
  const status =
    state === 'outgoing'
      ? 'Calling…'
      : remoteStream
        ? (hasRemoteVideo || hasRemoteAudio ? 'Connected' : 'Connecting media…')
        : 'Connecting…'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
      <div className="relative flex-1 overflow-hidden">
        {isVideo ? (
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className={`h-full w-full bg-black object-cover ${hasRemoteVideo ? '' : 'hidden'}`}
          />
        ) : (
          <audio ref={remoteAudioRef} autoPlay playsInline />
        )}

        {(isVideo && !hasRemoteVideo) || !isVideo ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,rgba(37,99,235,.18),transparent_45%),#09090b]">
            <Avatar name={peerName} size={isVideo ? 112 : 120} />
            <p className="text-lg font-semibold text-zinc-100">{peerName}</p>
            <p className="text-sm text-blue-300">{status}</p>
            {isVideo && remoteStream && !hasRemoteVideo ? (
              <p className="max-w-xs text-center text-xs text-zinc-400">Connected, but the other person’s camera is off or not sending video yet.</p>
            ) : null}
          </div>
        ) : null}

        {isVideo && hasRemoteVideo ? (
          <span className="absolute left-4 top-4 rounded-xl border border-white/10 bg-black/45 px-3 py-1.5 text-sm text-zinc-100 backdrop-blur">
            {peerName}
          </span>
        ) : null}

        {isVideo ? (
          <div className="absolute bottom-4 right-4 h-32 w-24 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-xl sm:h-40 sm:w-28">
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${localStream?.getVideoTracks?.().some((t) => t.enabled && t.readyState === 'live') ? '' : 'hidden'}`}
            />
            {!localStream?.getVideoTracks?.().some((t) => t.enabled && t.readyState === 'live') ? (
              <div className="flex h-full items-center justify-center"><Avatar name="You" size={42} /></div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-zinc-800/80 bg-zinc-950/95 py-5">
        <button
          type="button"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
            isMuted ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {isVideo ? (
          <button
            type="button"
            onClick={onToggleCamera}
            title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
              isCameraOff ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onEnd}
          title="End call"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition hover:bg-red-400"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  )
}
