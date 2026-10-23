import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

/** Resolves once ICE gathering finished (or after a timeout). */
function waitForIceGathering(pc, timeout = 4000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve()
      return
    }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
    pc.addEventListener('icegatheringstatechange', onChange)
    setTimeout(finish, timeout)
  })
}

function getMedia(callType) {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: callType === 'video',
  })
}

/**
 * 1-to-1 WebRTC calling over the Socket.IO signaling channel.
 * `incoming call` -> accept/decline, `call accepted`/`call rejected`/`call ended`.
 */
export default function useWebRTC() {
  const { user } = useAuth()
  const { socket } = useSocket()

  const [callState, setCallState] = useState('idle') // idle | incoming | outgoing | active
  const [callType, setCallType] = useState('video')
  const [peer, setPeer] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerRef = useRef(null)
  const callStateRef = useRef('idle')

  useEffect(() => {
    callStateRef.current = callState
  }, [callState])

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) setRemoteStream(stream)
    }
    pcRef.current = pc
    return pc
  }, [])

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null
        pcRef.current.onicecandidate = null
        pcRef.current.close()
      } catch {
        /* already closed */
      }
      pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    peerRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setIncomingCall(null)
    setPeer(null)
    setIsMuted(false)
    setIsCameraOff(false)
    setCallState('idle')
  }, [])

  /* ------------------------------------------------------------- signalling */
  useEffect(() => {
    if (!socket) return undefined

    const handleIncomingCall = ({ from, callType: type, signalData, name }) => {
      if (callStateRef.current !== 'idle') {
        socket.emit('reject call', { to: from })
        return
      }
      const caller = { _id: from, name: name || 'Unknown' }
      peerRef.current = caller
      setPeer(caller)
      setCallType(type)
      setIncomingCall({ from, callType: type, signalData, name: name || 'Unknown' })
      setCallState('incoming')
    }

    const handleCallAccepted = async ({ signalData }) => {
      const pc = pcRef.current
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData))
        setCallState('active')
      } catch {
        toast.error('Failed to establish the call')
        cleanup()
      }
    }

    const handleCallRejected = () => {
      toast('Call declined', { icon: '📵' })
      cleanup()
    }

    const handleCallEnded = () => {
      toast('Call ended', { icon: '📞' })
      cleanup()
    }

    socket.on('incoming call', handleIncomingCall)
    socket.on('call accepted', handleCallAccepted)
    socket.on('call rejected', handleCallRejected)
    socket.on('call ended', handleCallEnded)

    return () => {
      socket.off('incoming call', handleIncomingCall)
      socket.off('call accepted', handleCallAccepted)
      socket.off('call rejected', handleCallRejected)
      socket.off('call ended', handleCallEnded)
    }
  }, [socket, cleanup])

  /* ----------------------------------------------------------------- actions */
  const startCall = useCallback(
    async (target, type = 'video') => {
      if (!socket || !user || !target?._id) return
      const name =
        `${target.firstName || ''} ${target.lastName || ''}`.trim() ||
        target.username ||
        'User'
      try {
        setCallType(type)
        const info = { _id: target._id, name }
        peerRef.current = info
        setPeer(info)

        const stream = await getMedia(type)
        localStreamRef.current = stream
        setLocalStream(stream)

        const pc = createPeerConnection()
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGathering(pc)

        socket.emit('callUser', {
          to: target._id,
          from: user._id,
          callType: type,
          signalData: pc.localDescription,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        })
        setCallState('outgoing')
      } catch {
        toast.error('Could not start the call — check your camera/microphone')
        cleanup()
      }
    },
    [socket, user, createPeerConnection, cleanup]
  )

  const acceptCall = useCallback(async () => {
    if (!socket || !incomingCall) return
    try {
      const type = incomingCall.callType
      const stream = await getMedia(type)
      localStreamRef.current = stream
      setLocalStream(stream)

      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signalData))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await waitForIceGathering(pc)

      socket.emit('answer call', { to: incomingCall.from, signalData: pc.localDescription })
      setIncomingCall(null)
      setCallState('active')
    } catch {
      toast.error('Could not join the call')
      socket.emit('reject call', { to: incomingCall.from })
      cleanup()
    }
  }, [socket, incomingCall, createPeerConnection, cleanup])

  const rejectCall = useCallback(() => {
    if (socket && incomingCall?.from) {
      socket.emit('reject call', { to: incomingCall.from })
    }
    cleanup()
  }, [socket, incomingCall, cleanup])

  const endCall = useCallback(() => {
    if (socket && peerRef.current?._id) {
      socket.emit('end call', { to: peerRef.current._id })
    }
    cleanup()
  }, [socket, cleanup])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const enabled = !stream.getAudioTracks().every((track) => track.enabled)
    stream.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
    setIsMuted(!enabled)
  }, [])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const enabled = !stream.getVideoTracks().every((track) => track.enabled)
    stream.getVideoTracks().forEach((track) => {
      track.enabled = enabled
    })
    setIsCameraOff(!enabled)
  }, [])

  return {
    callState,
    callType,
    peer,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  }
}
