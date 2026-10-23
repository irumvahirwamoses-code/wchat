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
    if (localRef.current) localRef.current.srcObject = localStream || null
  }, [localStream])

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream || null
  }, [remoteStream])

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null
  }, [remoteStream])

  const isVideo = callType === 'video'
  const status =
    state === 'outgoing'
      ? 'Calling…'
      : !remoteStream
        ? 'Connecting…'
        : 'Connected'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
      <div className="relative flex-1 overflow-hidden">
        {isVideo ? (
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className={`h-full w-full object-cover ${remoteStream ? '' : 'hidden'}`}
          />
        ) : (
          <audio ref={remoteAudioRef} autoPlay playsInline />
        )}

        {isVideo && !remoteStream ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4">
            <Avatar name={peerName} size={112} />
            <p className="text-lg font-medium text-zinc-200">{peerName}</p>
            <p className="text-sm text-amber-400">{status}</p>
          </div>
        ) : null}

        {!isVideo ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4">
            <Avatar name={peerName} size={120} />
            <p className="text-xl font-semibold text-zinc-100">{peerName}</p>
            <p className="text-sm text-amber-400">{status}</p>
          </div>
        ) : null}

        {isVideo && remoteStream ? (
          <span className="absolute left-4 top-4 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-zinc-100 backdrop-blur">
            {peerName}
          </span>
        ) : null}

        {isVideo ? (
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 h-32 w-24 rounded-xl border border-zinc-700 object-cover shadow-xl sm:h-40 sm:w-28"
          />
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-4 bg-zinc-900/80 py-5">
        <button
          type="button"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
            isMuted
              ? 'bg-zinc-700 text-zinc-100'
              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
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
              isCameraOff
                ? 'bg-zinc-700 text-zinc-100'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
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
