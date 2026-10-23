import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import Avatar from './Avatar'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function VideoTile({ stream, name, muted = false, mirror = false, isLocal = false }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null
  }, [stream])

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      {stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${mirror ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
          <Avatar name={name} size={56} />
          <span className="text-xs">
            {isLocal ? 'Starting camera…' : 'Connecting…'}
          </span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-zinc-100">
        {name}
      </span>
    </div>
  )
}

/**
 * Multi-party WebRTC "mesh" meeting for group chats and Circles.
 *
 * Signalling uses the WebRTC "perfect negotiation" pattern:
 *   • Each pair of members shares one RTCPeerConnection.
 *   • Membership is deterministic — the member with the "greater" user id is
 *     polite and only answers; the impolite side starts the offer — so the two
 *     ends can never race. There is no timer, so joining is immediate.
 *   • The offer is (re)created from `onnegotiationneeded`, which keeps media
 *     flowing in real time as peers join/leave and tracks change.
 *   • After a socket reconnect we simply announce ourselves again, and the
 *     existing members negotiate with us as if we had just joined.
 */
export default function MeetingModal({ chat, onClose }) {
  const { user } = useAuth()
  const { socket } = useSocket()

  const [localStream, setLocalStream] = useState(null)
  const [peers, setPeers] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [starting, setStarting] = useState(true)

  const pcMapRef = useRef(new Map()) // peerId -> { pc, name, polite, pending, makingOffer, ignoreOffer }
  const localStreamRef = useRef(null)
  const chatIdRef = useRef(chat?._id)
  const socketRef = useRef(socket)
  const userRef = useRef(user)

  useEffect(() => {
    chatIdRef.current = chat?._id
  }, [chat?._id])
  useEffect(() => {
    socketRef.current = socket
  }, [socket])
  useEffect(() => {
    userRef.current = user
  }, [user])

  const displayName =
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || 'Guest'

  const upsertTile = useCallback((userId, name) => {
    setPeers((prev) => {
      if (prev.some((p) => p.userId === userId)) {
        return name ? prev.map((p) => (p.userId === userId ? { ...p, name } : p)) : prev
      }
      return [...prev, { userId, name: name || 'Guest', stream: null }]
    })
  }, [])

  const sendSignal = useCallback((to, signal) => {
    socketRef.current?.emit('meeting signal', {
      meetingId: chatIdRef.current,
      to,
      from: String(userRef.current?._id || ''),
      signal,
    })
  }, [])

  const createPeer = useCallback(
    (peerId, name) => {
      const id = String(peerId)
      const existing = pcMapRef.current.get(id)
      if (existing) {
        if (name) existing.name = name
        upsertTile(id, name)
        return existing
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      const entry = {
        pc,
        name: name || 'Guest',
        // Greater id is polite → waits for the other side's offer.
        polite: String(userRef.current?._id || '') > id,
        pending: [],
        makingOffer: false,
        ignoreOffer: false,
      }
      pcMapRef.current.set(id, entry)

      const stream = localStreamRef.current
      if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.onicecandidate = (event) => {
        if (!event.candidate) return
        const candidate =
          typeof event.candidate.toJSON === 'function'
            ? event.candidate.toJSON()
            : event.candidate
        sendSignal(id, { candidate })
      }

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams
        if (!remoteStream) return
        setPeers((prev) =>
          prev.map((p) => (p.userId === id ? { ...p, stream: remoteStream } : p))
        )
      }

      pc.onnegotiationneeded = async () => {
        // Only the impolite side initiates, which makes negotiation collision-free.
        if (entry.polite) return
        try {
          entry.makingOffer = true
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          sendSignal(id, pc.localDescription)
        } catch {
          /* the other side may have left */
        } finally {
          entry.makingOffer = false
        }
      }

      upsertTile(id, name)
      return entry
    },
    [sendSignal, upsertTile]
  )

  const handleSignal = useCallback(
    async ({ from, signal } = {}) => {
      if (!from || !signal) return
      const fromId = String(from)
      if (fromId === String(userRef.current?._id || '')) return

      const entry = createPeer(fromId, null)
      const { pc } = entry

      try {
        if (signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(signal.candidate)
          } else {
            entry.pending.push(signal.candidate)
          }
          return
        }

        if (signal.type === 'offer') {
          const collision = entry.makingOffer || pc.signalingState !== 'stable'
          entry.ignoreOffer = !entry.polite && collision
          if (entry.ignoreOffer) return
          await pc.setRemoteDescription(signal)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendSignal(fromId, pc.localDescription)
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(signal)
        }

        // Flush candidates that arrived before the remote description existed.
        while (entry.pending.length) {
          const candidate = entry.pending.shift()
          try {
            await pc.addIceCandidate(candidate)
          } catch {
            /* ignore malformed candidates */
          }
        }
      } catch {
        /* signalling races are expected while peers join and leave */
      }
    },
    [createPeer, sendSignal]
  )

  /* --------------------------------------------------------- signalling bus */
  useEffect(() => {
    if (!socket) return undefined

    const handlePeers = (list) => {
      ;(Array.isArray(list) ? list : []).forEach((peerInfo) => {
        if (
          peerInfo?.userId &&
          String(peerInfo.userId) !== String(userRef.current?._id || '')
        ) {
          createPeer(peerInfo.userId, peerInfo.name)
        }
      })
    }

    const handlePeerJoined = ({ userId, name } = {}) => {
      if (!userId || String(userId) === String(userRef.current?._id || '')) return
      createPeer(userId, name)
    }

    const handlePeerLeft = ({ userId } = {}) => {
      const key = String(userId)
      const entry = pcMapRef.current.get(key)
      if (entry) {
        try {
          entry.pc.close()
        } catch {
          /* ignore */
        }
        pcMapRef.current.delete(key)
      }
      setPeers((prev) => prev.filter((p) => String(p.userId) !== key))
    }

    socket.on('meeting peers', handlePeers)
    socket.on('meeting peer joined', handlePeerJoined)
    socket.on('meeting signal', handleSignal)
    socket.on('meeting peer left', handlePeerLeft)

    return () => {
      socket.off('meeting peers', handlePeers)
      socket.off('meeting peer joined', handlePeerJoined)
      socket.off('meeting signal', handleSignal)
      socket.off('meeting peer left', handlePeerLeft)
    }
  }, [socket, createPeer, handleSignal])

  const emitJoin = useCallback(() => {
    socketRef.current?.emit('join meeting', {
      meetingId: chatIdRef.current,
      userId: userRef.current?._id,
      name:
        `${userRef.current?.firstName || ''} ${userRef.current?.lastName || ''}`.trim() ||
        userRef.current?.username,
    })
  }, [])

  /* ----------------------------------------------------------- camera + mic */
  useEffect(() => {
    let cancelled = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        localStreamRef.current = stream
        setLocalStream(stream)
        setStarting(false)
      } catch {
        toast.error('Camera and microphone access is required for meetings')
        onClose?.()
      }
    }

    start()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Announce ourselves as soon as both the socket and the stream are ready. */
  useEffect(() => {
    if (!socket || !localStream) return undefined

    emitJoin()

    const onConnect = () => {
      if (localStreamRef.current) emitJoin()
    }

    socket.on('connect', onConnect)
    return () => socket.off('connect', onConnect)
  }, [socket, localStream, emitJoin])

  /* Tear everything down when the meeting closes. */
  useEffect(
    () => () => {
      socketRef.current?.emit('leave meeting', {
        meetingId: chatIdRef.current,
        userId: userRef.current?._id,
      })
      pcMapRef.current.forEach((entry) => {
        try {
          entry.pc.close()
        } catch {
          /* ignore */
        }
      })
      pcMapRef.current.clear()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    },
    []
  )

  const toggleMute = () => {
    const stream = localStreamRef.current
    if (!stream) return
    const enabled = !stream.getAudioTracks().every((track) => track.enabled)
    stream.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
    setIsMuted(!enabled)
  }

  const toggleCamera = () => {
    const stream = localStreamRef.current
    if (!stream) return
    const enabled = !stream.getVideoTracks().every((track) => track.enabled)
    stream.getVideoTracks().forEach((track) => {
      track.enabled = enabled
    })
    setIsCameraOff(!enabled)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
            <Users size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {chat?.chatName || 'Group meeting'}
            </p>
            <p className="text-xs text-zinc-500">{peers.length + 1} in the meeting</p>
          </div>
        </div>
        {starting ? (
          <span className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 size={14} className="animate-spin" /> Starting…
          </span>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <VideoTile
            stream={localStream}
            name={`${displayName} (you)`}
            muted
            mirror
            isLocal
          />
          {peers.map((peer) => (
            <VideoTile key={peer.userId} stream={peer.stream} name={peer.name} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-zinc-800 py-5">
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
            isMuted
              ? 'bg-zinc-700 text-zinc-100'
              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button
          type="button"
          onClick={toggleCamera}
          title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
            isCameraOff
              ? 'bg-zinc-700 text-zinc-100'
              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        <button
          type="button"
          onClick={onClose}
          title="Leave meeting"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition hover:bg-red-400"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  )
}
