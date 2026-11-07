import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try { track.stop() } catch {}
  })
}

async function getMedia(callType) {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  const video = callType === 'video'
    ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
    : false
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video })
  } catch (error) {
    if (callType === 'video') {
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio, video: false })
      audioOnly.__wchatVideoUnavailable = true
      return audioOnly
    }
    throw error
  }
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
  const remoteStreamRef = useRef(null)
  const peerRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const callStateRef = useRef('idle')

  useEffect(() => {
    callStateRef.current = callState
  }, [callState])

  const replaceRemoteStream = useCallback((next) => {
    remoteStreamRef.current = next || null
    setRemoteStream(next || null)
  }, [])

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) {
      try { pcRef.current.close() } catch {}
      pcRef.current = null
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const remote = new MediaStream()
    replaceRemoteStream(remote)

    pc.ontrack = (event) => {
      const target = remoteStreamRef.current || new MediaStream()
      if (!remoteStreamRef.current) replaceRemoteStream(target)
      if (event.streams?.[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!target.getTracks().some((t) => t.id === track.id)) target.addTrack(track)
        })
      } else if (event.track && !target.getTracks().some((t) => t.id === event.track.id)) {
        target.addTrack(event.track)
      }
      replaceRemoteStream(target)
    }

    pc.onicecandidate = (event) => {
      const peerId = peerRef.current?._id
      if (event.candidate && peerId && socket?.connected) {
        socket.emit('ice-candidate', { to: peerId, from: user?._id, candidate: event.candidate })
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(pc.iceConnectionState) && callStateRef.current === 'active') {
        // Keep the call alive briefly for transient disconnects; UI still shows connected state.
      }
      if (pc.iceConnectionState === 'failed') {
        try { pc.restartIce?.() } catch {}
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && callStateRef.current !== 'idle') {
        toast.error('Call connection failed')
      }
    }

    pcRef.current = pc
    return pc
  }, [replaceRemoteStream, socket, user?._id])

  const cleanup = useCallback((notifyPeer = false) => {
    const peerId = peerRef.current?._id
    if (notifyPeer && socket?.connected && peerId) {
      socket.emit('end call', { to: peerId, from: user?._id })
    }
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null
        pcRef.current.onicecandidate = null
        pcRef.current.oniceconnectionstatechange = null
        pcRef.current.onconnectionstatechange = null
        pcRef.current.close()
      } catch {}
      pcRef.current = null
    }
    stopStream(localStreamRef.current)
    localStreamRef.current = null
    pendingCandidatesRef.current = []
    remoteStreamRef.current = null
    peerRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setIncomingCall(null)
    setPeer(null)
    setIsMuted(false)
    setIsCameraOff(false)
    setCallState('idle')
  }, [socket, user?._id])

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
      if (!pc || !signalData) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData))
        while (pendingCandidatesRef.current.length) {
          const candidate = pendingCandidatesRef.current.shift()
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
        }
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

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return
      const pc = pcRef.current
      if (!pc) return
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        pendingCandidatesRef.current.push(candidate)
        return
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
    }

    socket.on('incoming call', handleIncomingCall)
    socket.on('call accepted', handleCallAccepted)
    socket.on('call rejected', handleCallRejected)
    socket.on('call ended', handleCallEnded)
    socket.on('ice-candidate', handleIceCandidate)

    return () => {
      socket.off('incoming call', handleIncomingCall)
      socket.off('call accepted', handleCallAccepted)
      socket.off('call rejected', handleCallRejected)
      socket.off('call ended', handleCallEnded)
      socket.off('ice-candidate', handleIceCandidate)
    }
  }, [socket, cleanup])

  /* ----------------------------------------------------------------- actions */
  const startCall = useCallback(
    async (target, type = 'video') => {
      if (!socket || !user || !target?._id) return
      if (callStateRef.current !== 'idle') return
      const name =
        `${target.firstName || ''} ${target.lastName || ''}`.trim() ||
        target.username ||
        'User'
      let stream
      try {
        setCallType(type)
        const info = { _id: target._id, name }
        peerRef.current = info
        setPeer(info)
        setIsCameraOff(false)
        setIsMuted(false)

        stream = await getMedia(type)
        localStreamRef.current = stream
        setLocalStream(stream)
        if (stream.__wchatVideoUnavailable) {
          toast.error('Camera unavailable; starting with audio only')
          setIsCameraOff(true)
        }

        const pc = createPeerConnection()
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === 'video' })
        await pc.setLocalDescription(offer)

        socket.emit('callUser', {
          to: target._id,
          from: user._id,
          callType: type,
          signalData: pc.localDescription?.toJSON ? pc.localDescription.toJSON() : pc.localDescription,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        })
        setCallState('outgoing')
      } catch (error) {
        stopStream(stream)
        console.error('startCall failed', error)
        toast.error('Could not start the call — check camera/microphone permissions')
        cleanup()
      }
    },
    [socket, user, createPeerConnection, cleanup]
  )

  const acceptCall = useCallback(async () => {
    if (!socket || !incomingCall) return
    let stream
    try {
      const type = incomingCall.callType || 'video'
      setCallType(type)
      peerRef.current = { _id: incomingCall.from, name: incomingCall.name || 'Unknown' }
      setPeer(peerRef.current)
      setIsMuted(false)
      setIsCameraOff(false)

      stream = await getMedia(type)
      localStreamRef.current = stream
      setLocalStream(stream)
      if (stream.__wchatVideoUnavailable) {
        toast.error('Camera unavailable; joining with audio only')
        setIsCameraOff(true)
      }

      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signalData))
      while (pendingCandidatesRef.current.length) {
        const candidate = pendingCandidatesRef.current.shift()
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
      }
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.emit('answer call', {
        to: incomingCall.from,
        from: user?._id,
        signalData: pc.localDescription?.toJSON ? pc.localDescription.toJSON() : pc.localDescription,
      })
      setIncomingCall(null)
      setCallState('active')
    } catch (error) {
      stopStream(stream)
      console.error('acceptCall failed', error)
      toast.error('Could not join the call — check camera/microphone permissions')
      socket.emit('reject call', { to: incomingCall.from, from: user?._id })
      cleanup()
    }
  }, [socket, incomingCall, createPeerConnection, cleanup, user?._id])

  const rejectCall = useCallback(() => {
    if (socket && incomingCall?.from) {
      socket.emit('reject call', { to: incomingCall.from, from: user?._id })
    }
    cleanup()
  }, [socket, incomingCall, cleanup, user?._id])

  const endCall = useCallback(() => {
    cleanup(true)
  }, [cleanup])

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
