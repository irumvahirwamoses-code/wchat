import { useEffect, useRef, useState } from 'react'
import {
  Clock,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Mic,
  Music,
  Paperclip,
  Reply,
  Send,
  Smile,
  Video,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiError } from '../config/api'
import { useChat } from '../context/ChatContext'
import { useSocket } from '../context/SocketContext'
import { getLastMessagePreview, getSenderName } from '../utils/api'
import EmojiPicker from './EmojiPicker'
import LiveLocationModal from './LiveLocationModal'
import VoiceRecorder from './VoiceRecorder'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

const DOC_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.json,.zip,.rar,.7z'

export default function MessageInput({ chatId }) {
  const { replyTo, setReplyTo, sendMessage } = useChat()
  const { socket } = useSocket()

  const [text, setText] = useState('')
  const [attachOpen, setAttachOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [liveOpen, setLiveOpen] = useState(false)

  const textareaRef = useRef(null)
  const typingTimerRef = useRef(null)
  const imageInputRef = useRef(null)
  const audioInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setText('')
    setAttachOpen(false)
    setEmojiOpen(false)
    setRecording(false)
    setUploading(null)
    setReplyTo(null)
    setScheduleOpen(false)
    setScheduleAt('')
  }, [chatId])

  // Focus the input when a reply is opened so the user can type immediately.
  useEffect(() => {
    if (replyTo?._id) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
      })
    }
  }, [replyTo?._id])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [text])

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current)
      if (socket && chatId) socket.emit('stop typing', chatId)
    }
  }, [socket, chatId])

  const emitTyping = () => {
    if (!socket || !chatId) return
    socket.emit('typing', chatId)
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      socket.emit('stop typing', chatId)
    }, 2000)
  }

  const stopTyping = () => {
    clearTimeout(typingTimerRef.current)
    if (socket && chatId) socket.emit('stop typing', chatId)
  }

  /** Insert an emoji at the caret (falls back to the end of the text). */
  const insertEmoji = (symbol) => {
    const el = textareaRef.current
    if (!el) {
      setText((prev) => prev + symbol)
      return
    }
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    setText(text.slice(0, start) + symbol + text.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + symbol.length
      el.selectionStart = caret
      el.selectionEnd = caret
    })
  }

  const submitText = async () => {
    const value = text.trim()
    if (!value || uploading) return
    setText('')
    stopTyping()
    try {
      const formData = new FormData()
      formData.append('chatId', chatId)
      formData.append('contentType', 'text')
      formData.append('text', value)
      if (replyTo?._id) formData.append('replyTo', replyTo._id)
      await sendMessage(formData)
      setReplyTo(null)
    } catch (error) {
      toast.error(getApiError(error, 'Message failed to send'))
      setText(value)
    }
  }

  /** Queue the current text to go out at a chosen time (max 29 days ahead). */
  const submitScheduled = async () => {
    const value = text.trim()
    if (!value || !scheduleAt) return
    const when = new Date(scheduleAt)
    if (Number.isNaN(when.getTime())) {
      toast.error('Pick a valid date and time')
      return
    }
    setText('')
    stopTyping()
    try {
      const formData = new FormData()
      formData.append('chatId', chatId)
      formData.append('contentType', 'text')
      formData.append('text', value)
      formData.append('scheduledAt', when.toISOString())
      if (replyTo?._id) formData.append('replyTo', replyTo._id)
      await sendMessage(formData)
      setReplyTo(null)
      setScheduleOpen(false)
      setScheduleAt('')
      toast.success('Message scheduled')
    } catch (error) {
      toast.error(getApiError(error, 'Could not schedule the message'))
      setText(value)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitText()
    }
  }

  const handleFile = async (contentType, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setAttachOpen(false)
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      toast.error('That file is larger than 25 MB')
      return
    }
    setUploading(contentType)
    try {
      const formData = new FormData()
      formData.append('chatId', chatId)
      formData.append('contentType', contentType)
      formData.append('file', file)
      if (replyTo?._id) formData.append('replyTo', replyTo._id)
      await sendMessage(formData)
      setReplyTo(null)
    } catch (error) {
      toast.error(getApiError(error, `Could not send the ${contentType}`))
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="border-t border-zinc-800/80 bg-zinc-900/60 p-3">
      {replyTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-wchat bg-zinc-950/60 px-3 py-1.5">
          <Reply size={14} className="shrink-0 text-wchat" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-wchat">
              {getSenderName(replyTo)}
            </p>
            <p className="truncate text-[11px] text-zinc-400">
              {getLastMessagePreview(replyTo)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            title="Cancel reply"
            className="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {scheduleOpen ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2">
          <Clock size={15} className="shrink-0 text-wchat" />
          <span className="shrink-0 text-[11px] font-semibold text-zinc-400">
            Send later
          </span>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-wchat/60"
          />
          <button
            type="button"
            onClick={submitScheduled}
            disabled={!text.trim() || !scheduleAt}
            className="shrink-0 rounded-lg bg-wchat px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-wchat-600 disabled:opacity-50"
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={() => setScheduleOpen(false)}
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:text-zinc-200"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {recording ? (
        <VoiceRecorder
          chatId={chatId}
          onSent={() => setRecording(false)}
          onCancel={() => setRecording(false)}
        />
      ) : (
        <div className="flex items-end gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAttachOpen((v) => !v)}
              disabled={Boolean(uploading)}
              title="Attach"
              className="rounded-full p-2.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-400 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin text-amber-400" />
              ) : (
                <Paperclip size={20} />
              )}
            </button>

            {attachOpen ? (
              <div className="animate-scale-in absolute bottom-12 left-0 z-30 w-44 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                <AttachOption
                  icon={<ImageIcon size={16} />}
                  label="Image"
                  onClick={() => imageInputRef.current?.click()}
                />
                <AttachOption
                  icon={<Music size={16} />}
                  label="Audio"
                  onClick={() => audioInputRef.current?.click()}
                />
                <AttachOption
                  icon={<Video size={16} />}
                  label="Video"
                  onClick={() => videoInputRef.current?.click()}
                />
                <AttachOption
                  icon={<FileText size={16} />}
                  label="Document"
                  onClick={() => fileInputRef.current?.click()}
                />
                <AttachOption
                  icon={<MapPin size={16} />}
                  label="Live location"
                  onClick={() => {
                    setAttachOpen(false)
                    setLiveOpen(true)
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="relative min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                if (event.target.value.trim()) emitTyping()
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              className="max-h-36 min-h-[42px] w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/70 py-2.5 pl-3 pr-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/60"
            />

            <button
              type="button"
              onClick={() => {
                setAttachOpen(false)
                setEmojiOpen((v) => !v)
              }}
              title="Emoji"
              className="absolute bottom-1.5 right-1.5 rounded-md p-2 text-zinc-400 transition hover:text-amber-400"
            >
              <Smile size={19} />
            </button>

            {emojiOpen ? (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setEmojiOpen(false)}
                  aria-hidden="true"
                />
                <EmojiPicker
                  onPick={insertEmoji}
                  onClose={() => setEmojiOpen(false)}
                />
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setScheduleOpen((v) => !v)}
            title="Send later"
            className={`rounded-full p-2.5 transition hover:bg-zinc-800 ${
              scheduleOpen ? 'text-wchat' : 'text-zinc-400 hover:text-wchat'
            }`}
          >
            <Clock size={20} />
          </button>

          <button
            type="button"
            onClick={() => setRecording(true)}
            title="Record voice note"
            className="rounded-full p-2.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-400"
          >
            <Mic size={20} />
          </button>

          <button
            type="button"
            onClick={submitText}
            disabled={!text.trim() || Boolean(uploading)}
            title="Send"
            className="rounded-full bg-amber-400 p-2.5 text-white transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleFile('image', event)}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => handleFile('audio', event)}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => handleFile('video', event)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(event) => handleFile('file', event)}
      />

      {liveOpen ? (
        <LiveLocationModal chatId={chatId} onClose={() => setLiveOpen(false)} />
      ) : null}
    </div>
  )
}

function AttachOption({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800/70"
    >
      <span className="text-amber-400">{icon}</span>
      {label}
    </button>
  )
}
