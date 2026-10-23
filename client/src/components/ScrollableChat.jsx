import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Languages,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Pin,
  PinOff,
  Radio,
  Reply,
  Smile,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from './Avatar'
import { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import {
  formatDateLabel,
  formatTime,
  getFileUrl,
  getId,
  getSenderName,
} from '../utils/api'
import { hasHiddenWord } from '../utils/contentFilter'
import {
  TRANSLATE_EVENT,
  getAutoTranslate,
  getGlobalTarget,
  languageName,
  translateText,
  translationSupported,
} from '../utils/translate'
import { MESSAGE_REACTIONS, chatBubbleStyle } from '../config/chatThemes'

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function linkify(text) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, index) =>
    part.match(/^https?:\/\//) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-current/40 underline-offset-2 hover:decoration-current"
      >
        {part}
      </a>
    ) : (
      part
    )
  )
}

/** Short one-line preview of a quoted message. */
function previewOf(message) {
  if (!message) return ''
  switch (message.contentType) {
    case 'image':
      return '📷 Photo'
    case 'audio':
      return '🎤 Voice message'
    case 'video':
      return '🎬 Video'
    case 'file':
      return `📄 ${message.fileName || 'File'}`
    case 'location':
      return '📍 Live location'
    default:
      return message.content || ''
  }
}

/** Live or last-known position shared into the chat. */
function LocationCard({ message }) {
  let spot = {}
  try {
    spot = JSON.parse(message.content)
  } catch {
    spot = {}
  }

  const hasPosition = Number.isFinite(Number(spot.latitude)) && Number.isFinite(Number(spot.longitude))
  const live = Boolean(spot.live) && (!spot.expiresAt || new Date(spot.expiresAt) > new Date())
  const until = spot.expiresAt ? new Date(spot.expiresAt) : null
  const href = hasPosition
    ? `https://www.openstreetmap.org/?mlat=${spot.latitude}&mlon=${spot.longitude}#map=16/${spot.latitude}/${spot.longitude}`
    : 'https://www.openstreetmap.org'

  return (
    <div className="w-64 max-w-full overflow-hidden rounded-xl border border-white/15 bg-black/25">
      <div className="relative grid h-24 place-items-center overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950">
        <span className="absolute h-24 w-24 rounded-full border border-white/10" />
        <span className="absolute h-16 w-16 rounded-full border border-white/10" />
        <span className="absolute h-8 w-8 rounded-full border border-white/10" />
        <span className="absolute h-px w-full bg-white/10" />
        <span className="absolute h-full w-px bg-white/10" />
        {live ? (
          <span className="absolute h-10 w-10 animate-ping rounded-full bg-emerald-400/30" />
        ) : null}
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-zinc-900 shadow-lg">
          <MapPin size={16} />
        </span>
      </div>

      <div className="px-3 py-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
          {live ? (
            <>
              <Radio size={13} className="text-emerald-300" /> Live location
            </>
          ) : (
            <>
              <MapPin size={13} className="text-amber-300" /> Location
            </>
          )}
          {live ? (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              LIVE
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          {hasPosition
            ? `${Number(spot.latitude).toFixed(4)}, ${Number(spot.longitude).toFixed(4)}`
            : 'Position unavailable'}
        </p>
        <p className="text-[10px] text-slate-500">
          {live && until
            ? `Live until ${until.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Sharing ended'}
        </p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white/90 hover:border-amber-400/60"
        >
          <Navigation size={12} /> Open in Maps
        </a>
      </div>
    </div>
  )
}

function MessageContent({ message, editing, draft, onSave, onCancel, overrideText }) {
  if (editing) {
    return (
      <div className="min-w-[220px]">
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={Math.min(5, draft.split('\n').length + 1)}
          className="w-full resize-none rounded-lg border border-white/15 bg-black/30 p-2 text-sm text-white outline-none focus:border-amber-400"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSave()
            }
            if (event.key === 'Escape') onCancel()
          }}
        />
        <div className="mt-1.5 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10"
          >
            <X size={13} /> Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-500"
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  switch (message.contentType) {
    case 'image':
      return (
        <button
          type="button"
          onClick={() => window.open(getFileUrl(message.content), '_blank')}
          className="group/img relative block overflow-hidden rounded-lg"
          title="Open image"
        >
          <img
            src={getFileUrl(message.content)}
            alt={message.fileName || 'Shared'}
            className="max-h-72 w-auto max-w-[240px] rounded-lg object-cover"
          />
          <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover/img:opacity-100">
            <Download size={12} />
          </span>
        </button>
      )
    case 'audio':
      return (
        <audio
          controls
          preload="metadata"
          src={getFileUrl(message.content)}
          className="w-56"
        />
      )
    case 'video':
      return (
        <video
          controls
          preload="metadata"
          src={getFileUrl(message.content)}
          className="max-h-72 w-auto max-w-[260px] rounded-lg"
        />
      )
    case 'file':
      return (
        <a
          href={getFileUrl(message.content)}
          target="_blank"
          rel="noreferrer"
          download={message.fileName || undefined}
          className="flex w-60 max-w-full items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-3 py-2.5 hover:border-amber-400/50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-amber-400/15 text-amber-300">
            <FileText size={17} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-xs font-semibold text-white">
              {message.fileName || 'File'}
            </span>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">
              {message.fileName?.split('.').pop() || 'file'}
              {message.fileSize ? ` · ${formatFileSize(message.fileSize)}` : ''}
            </span>
          </span>
          <Download size={15} className="shrink-0 text-slate-400" />
        </a>
      )
    case 'location':
      return <LocationCard message={message} />
    default:
      return (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {linkify(overrideText || message.content)}
        </p>
      )
  }
}

/** The hover/long-press action rail next to a message. */
function MessageActions({
  isMine,
  canEdit,
  canDelete,
  confirming,
  busy,
  isPinned,
  onStartEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
  onReply,
  onTogglePin,
  onTogglePicker,
  canTranslate,
  onTranslate,
}) {
  return (
    <div
      className={`mb-1 flex shrink-0 items-center gap-0.5 opacity-70 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${
        isMine ? '' : 'order-2'
      }`}
    >
      <button
        type="button"
        onClick={onTogglePicker}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        title="React"
      >
        <Smile size={14} />
      </button>
      <button
        type="button"
        onClick={onReply}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        title="Reply"
      >
        <Reply size={14} />
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        title={isPinned ? 'Unpin message' : 'Pin message'}
      >
        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
      {canTranslate ? (
        <button
          type="button"
          onClick={onTranslate}
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          title="Translate"
        >
          <Languages size={14} />
        </button>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          onClick={onStartEdit}
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          title="Edit message"
          disabled={busy}
        >
          <Pencil size={14} />
        </button>
      ) : null}
      {canDelete ? (
        confirming ? (
          <div className="flex items-center gap-1 rounded-md bg-red-500/15 px-1.5 py-1">
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="text-[11px] font-semibold text-red-300 hover:text-red-200"
            >
              {busy ? '…' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="text-slate-400 hover:text-white"
              title="Cancel"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAskDelete}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-red-300"
            title="Delete message"
            disabled={busy}
          >
            <Trash2 size={14} />
          </button>
        )
      ) : null}
    </div>
  )
}

function MessageRow({
  message,
  isGroup,
  isMine,
  currentUserId,
  theme,
  isPinned,
  onUserClick,
  onEdit,
  onDelete,
  onReply,
  onReact,
  onTogglePin,
  translation,
  autoLang,
  onTranslate,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  const sender = message.sender
  const senderObject = typeof sender === 'object' ? sender : null
  const senderName = senderObject
    ? `${senderObject.firstName || ''} ${senderObject.lastName || ''}`.trim() ||
      senderObject.username
    : 'Unknown'

  const seenByIds = (message.seenBy || []).map(getId).filter(Boolean)
  const othersSeen = seenByIds.filter((id) => id !== currentUserId)
  const seenByOthers = othersSeen.length > 0

  const editable = isMine && message.contentType === 'text'
  const deletable = isMine

  // Group the reactions: emoji -> how many people picked it.
  const reactionCounts = (message.reactions || []).reduce((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1
    return acc
  }, {})
  const myReaction = (message.reactions || []).find(
    (reaction) => getId(reaction.user) === currentUserId
  )?.emoji

  const quoted = message.replyTo
  const customTheme = theme && theme !== 'wchat' ? chatBubbleStyle(theme) : null

  const startEdit = () => {
    setDraft(message.content)
    setConfirming(false)
    setEditing(true)
  }

  const saveEdit = async () => {
    const value = draft.trim()
    if (!value || value === message.content) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await onEdit(message._id, value)
      setEditing(false)
    } catch (error) {
      toast.error(getApiError(error, 'Could not edit message'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await onDelete(message._id)
      setConfirming(false)
    } catch (error) {
      toast.error(getApiError(error, 'Could not delete message'))
    } finally {
      setBusy(false)
    }
  }

  const react = (emoji) => {
    setPickerOpen(false)
    onReact(message._id, emoji === myReaction ? '' : emoji).catch((error) =>
      toast.error(getApiError(error, 'Could not react'))
    )
  }

  const jumpToQuoted = () => {
    const target = document.getElementById(`msg-${getId(quoted)}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div
      id={`msg-${message._id}`}
      className={`group flex w-full items-end gap-2 ${
        isMine ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isMine && isGroup ? (
        <button
          type="button"
          onClick={() => senderObject && onUserClick?.(senderObject)}
          className="mb-0.5"
          title={senderName}
        >
          <Avatar src={senderObject?.profilePicture} name={senderName} size={30} />
        </button>
      ) : null}

      {isMine && !editing ? (
        <MessageActions
          isMine
          canEdit={editable}
          canDelete={deletable}
          confirming={confirming}
          busy={busy}
          isPinned={isPinned}
          onStartEdit={startEdit}
          onAskDelete={() => setConfirming(true)}
          onCancelDelete={() => setConfirming(false)}
          onDelete={remove}
          onReply={() => onReply(message)}
          onTogglePin={() => onTogglePin(message)}
          onTogglePicker={() => setPickerOpen((v) => !v)}
          canTranslate={message.contentType === 'text'}
          onTranslate={onTranslate}
        />
      ) : null}

      <div
        style={customTheme || undefined}
        className={`relative max-w-[78%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[68%] ${
          isMine
            ? 'rounded-br-md bg-amber-400 text-white'
            : 'rounded-bl-md bg-slate-700/80 text-slate-50'
        }`}
      >
        {isPinned ? (
          <span
            className={`mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
              isMine ? 'text-white/80' : 'text-amber-300'
            }`}
          >
            <Pin size={11} /> Pinned
          </span>
        ) : null}

        {message.delivered === false ? (
          <span
            className={`mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
              isMine ? 'text-white/80' : 'text-amber-300'
            }`}
          >
            <Clock size={11} />
            {message.scheduledAt
              ? `Scheduled ${new Date(message.scheduledAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Scheduled'}
          </span>
        ) : null}

        {quoted ? (
          <button
            type="button"
            onClick={jumpToQuoted}
            className={`mb-1.5 flex w-full min-w-[160px] flex-col rounded-lg border-l-2 px-2 py-1 text-left ${
              isMine
                ? 'border-white/60 bg-black/15'
                : 'border-amber-300 bg-black/20'
            }`}
            title="Go to quoted message"
          >
            <span
              className={`truncate text-[10px] font-semibold ${
                isMine ? 'text-white/90' : 'text-amber-300'
              }`}
            >
              {getSenderName(quoted)}
            </span>
            <span
              className={`truncate text-[11px] ${
                isMine ? 'text-white/70' : 'text-slate-300'
              }`}
            >
              {previewOf(quoted)}
            </span>
          </button>
        ) : null}

        {isGroup && !isMine ? (
          <button
            type="button"
            onClick={() => senderObject && onUserClick?.(senderObject)}
            className="mb-1 block text-[11px] font-semibold text-amber-300"
          >
            {senderName}
          </button>
        ) : null}

        <MessageContent
          message={message}
          editing={editing}
          draft={draft}
          onSave={saveEdit}
          onCancel={() => setEditing(false)}
          overrideText={
            translation?.status === 'done' && translation.translated && !showOriginal
              ? translation.text
              : null
          }
        />

        {message.contentType === 'text' && translation ? (
          <div
            className={`mt-1 flex flex-wrap items-center gap-1.5 text-[10px] ${
              isMine ? 'text-white/70' : 'text-slate-400'
            }`}
          >
            {translation.status === 'loading' ? (
              <span className="flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Translating…
              </span>
            ) : null}
            {translation.status === 'error' ? (
              <span className={isMine ? 'text-white/80' : 'text-rose-300'}>
                {translation.error}
              </span>
            ) : null}
            {translation.status === 'done' ? (
              <>
                <Languages size={10} />
                <span>
                  {translation.translated
                    ? `Translated from ${languageName(translation.source)}`
                    : 'Already in your language'}
                </span>
                {translation.translated ? (
                  <button
                    type="button"
                    onClick={() => setShowOriginal((value) => !value)}
                    className="font-semibold underline"
                  >
                    {showOriginal ? 'Show translation' : 'Show original'}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {Object.keys(reactionCounts).length ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => react(emoji)}
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition ${
                  myReaction === emoji
                    ? 'bg-white/25 ring-1 ring-white/50'
                    : 'bg-black/20 hover:bg-black/30'
                }`}
                title={`${count} reaction${count === 1 ? '' : 's'}`}
              >
                <span>{emoji}</span>
                {count > 1 ? <span>{count}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
            isMine ? 'text-white/70' : 'text-slate-300/70'
          }`}
        >
          {editing ? null : (
            <>
              {message.editedAt ? <span className="opacity-70">edited</span> : null}
              <span>{formatTime(message.createdAt)}</span>
              {isMine ? (
                seenByOthers ? (
                  <span
                    className="flex items-center gap-0.5"
                    title={
                      isGroup
                        ? `Seen by ${othersSeen.length} ${othersSeen.length === 1 ? 'person' : 'people'}`
                        : 'Seen'
                    }
                  >
                    {!isGroup ? <span className="font-medium">Seen</span> : null}
                    <CheckCheck size={13} strokeWidth={2.6} />
                  </span>
                ) : (
                  <span title="Sent">
                    <Check size={13} strokeWidth={2.6} />
                  </span>
                )
              ) : null}
            </>
          )}
        </div>

        {pickerOpen ? (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setPickerOpen(false)}
              aria-hidden="true"
            />
            <div
              className={`animate-scale-in absolute bottom-full z-40 mb-1 flex items-center gap-0.5 rounded-full border border-zinc-800 bg-zinc-900 px-1.5 py-1 shadow-2xl ${
                isMine ? 'right-0' : 'left-0'
              }`}
            >
              {MESSAGE_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  className="rounded-full px-1.5 py-1 text-base transition hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {!isMine && !editing ? (
        <MessageActions
          isMine={false}
          canEdit={false}
          canDelete={false}
          confirming={false}
          busy={false}
          isPinned={isPinned}
          onReply={() => onReply(message)}
          onTogglePin={() => onTogglePin(message)}
          onTogglePicker={() => setPickerOpen((v) => !v)}
          canTranslate={message.contentType === 'text'}
          onTranslate={onTranslate}
        />
      ) : null}
    </div>
  )
}

export default function ScrollableChat({ messages = [], onUserClick, loading }) {
  const { user } = useAuth()
  const {
    selectedChat,
    editMessage,
    deleteMessage,
    setReplyTo,
    reactToMessage,
    togglePinMessage,
    chatSettings,
  } = useChat()
  const bottomRef = useRef(null)
  const isGroup = Boolean(selectedChat?.isGroupChat)

  const settings = chatSettings?.[selectedChat?._id]
  const pinnedMessages = settings?.pinnedMessages || []
  const pinnedIds = new Set(pinnedMessages.map((pin) => getId(pin.message)))
  const theme = selectedChat?.theme || ''

  // ---------------------------------------------------------------- translate
  const [translations, setTranslations] = useState({})
  const [autoLang, setAutoLang] = useState(() => getAutoTranslate(selectedChat?._id))

  useEffect(() => {
    setAutoLang(getAutoTranslate(selectedChat?._id))
    setTranslations({})
  }, [selectedChat?._id])

  useEffect(() => {
    const sync = () => setAutoLang(getAutoTranslate(selectedChat?._id))
    window.addEventListener(TRANSLATE_EVENT, sync)
    return () => window.removeEventListener(TRANSLATE_EVENT, sync)
  }, [selectedChat?._id])

  const runTranslation = useCallback(
    async (message, language) => {
      if (!message || message.contentType !== 'text') return
      setTranslations((prev) => ({ ...prev, [message._id]: { status: 'loading' } }))
      try {
        const result = await translateText(message.content, language || getGlobalTarget())
        setTranslations((prev) => ({
          ...prev,
          [message._id]: {
            status: 'done',
            text: result.text,
            source: result.source,
            translated: result.translated,
          },
        }))
      } catch (error) {
        setTranslations((prev) => ({
          ...prev,
          [message._id]: { status: 'error', error: error.message },
        }))
      }
    },
    []
  )

  // Auto-translate incoming text while the chat has it switched on.
  useEffect(() => {
    if (!autoLang || !translationSupported()) return undefined
    const pending = messages.filter(
      (message) =>
        message.contentType === 'text' &&
        getId(message.sender) !== user?._id &&
        !translations[message._id]
    )
    if (!pending.length) return undefined

    let cancelled = false
    ;(async () => {
      for (const message of pending.slice(0, 4)) {
        if (cancelled) return
        // eslint-disable-next-line no-await-in-loop
        await runTranslation(message, autoLang)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [autoLang, messages, translations, user?._id, runTranslation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, selectedChat?._id])

  const handleTogglePin = (message) => {
    if (!selectedChat?._id) return
    togglePinMessage(selectedChat._id, message._id, pinnedIds.has(message._id)).catch(
      (error) => toast.error(getApiError(error, 'Could not update the pin'))
    )
  }

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  const rows = []
  let lastLabel = null
  messages.forEach((message) => {
    // Mute messages that contain one of the member's hidden words.
    if (message.contentType === 'text' && hasHiddenWord(message.content)) return
    const label = formatDateLabel(message.createdAt)
    if (label !== lastLabel) {
      rows.push({ kind: 'date', id: `date-${label}-${message._id}`, label })
      lastLabel = label
    }
    rows.push({ kind: 'message', id: message._id, message })
  })

  return (
    <div className="chat-scroll flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-6">
      {rows.map((row) =>
        row.kind === 'date' ? (
          <div key={row.id} className="flex justify-center py-1">
            <span className="rounded-full bg-zinc-800/90 px-3 py-1 text-[11px] font-medium text-zinc-400">
              {row.label}
            </span>
          </div>
        ) : (
          <MessageRow
            key={row.id}
            message={row.message}
            isGroup={isGroup}
            isMine={getId(row.message.sender) === user?._id}
            currentUserId={user?._id}
            theme={theme}
            isPinned={pinnedIds.has(row.message._id)}
            onUserClick={onUserClick}
            onEdit={editMessage}
            onDelete={deleteMessage}
            onReply={setReplyTo}
            onReact={reactToMessage}
            onTogglePin={handleTogglePin}
            translation={translations[row.message._id]}
            autoLang={autoLang}
            onTranslate={() => runTranslation(row.message, autoLang || getGlobalTarget())}
          />
        )
      )}
      <div ref={bottomRef} />
    </div>
  )
}
