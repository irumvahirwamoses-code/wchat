import { useEffect, useRef, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiError } from '../config/api'
import { useChat } from '../context/ChatContext'

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function VoiceRecorder({ chatId, onSent, onCancel }) {
  const { sendMessage } = useChat()
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const intentRef = useRef('send')
  const timerRef = useRef(null)

  function cleanupStream() {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }

  async function handleStop() {
    cleanupStream()
    if (intentRef.current === 'cancel') {
      onCancel?.()
      return
    }
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    if (!blob.size) {
      toast.error('That recording was empty')
      onCancel?.()
      return
    }
    setBusy(true)
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, {
        type: 'audio/webm',
      })
      const formData = new FormData()
      formData.append('chatId', chatId)
      formData.append('contentType', 'audio')
      formData.append('file', file)
      await sendMessage(formData)
      toast.success('Voice note sent')
      onSent?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not send the voice note'))
      onCancel?.()
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const startRecording = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Your browser does not support audio recording')
        onCancel?.()
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const preferred = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
        const recorder = new MediaRecorder(
          stream,
          preferred ? { mimeType: preferred } : undefined
        )
        recorderRef.current = recorder
        chunksRef.current = []
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
        }
        recorder.onstop = handleStop
        recorder.start()
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      } catch {
        toast.error('Microphone permission is required to record voice notes')
        onCancel?.()
      }
    }

    startRecording()

    return () => {
      cancelled = true
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stop = (intent) => {
    intentRef.current = intent
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      if (intent === 'cancel') {
        cleanupStream()
        onCancel?.()
      }
      return
    }
    recorder.stop()
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-zinc-950/60 px-3 py-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
      </span>

      <div className="flex-1">
        <p className="text-sm font-medium text-zinc-100">
          {busy ? 'Sending voice note…' : 'Recording…'}
        </p>
        <p className="text-xs tabular-nums text-zinc-500">{formatDuration(seconds)}</p>
      </div>

      <button
        type="button"
        onClick={() => stop('cancel')}
        disabled={busy}
        title="Discard"
        className="rounded-full p-2 text-zinc-400 transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
      >
        <Trash2 size={18} />
      </button>

      <button
        type="button"
        onClick={() => stop('send')}
        disabled={busy}
        title="Send voice note"
        className="rounded-full bg-amber-400 p-2.5 text-white transition hover:bg-amber-300 disabled:opacity-60"
      >
        {busy ? <span className="spinner spinner-sm spinner-brand-white" /> : <Send size={18} />}
      </button>
    </div>
  )
}
