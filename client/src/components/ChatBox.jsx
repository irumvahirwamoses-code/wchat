import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  EyeOff,
  Info,
  Languages,
  LayoutGrid,
  MessageCircle,
  MoreVertical,
  Palette,
  Phone,
  Pin,
  PinOff,
  QrCode,
  Tag,
  Video,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import GroupInviteModal from './GroupInviteModal'
import { LANGUAGES, getAutoTranslate, setAutoTranslate, setGlobalTarget } from '../utils/translate'
import Avatar from './Avatar'
import MessageInput from './MessageInput'
import ScrollableChat from './ScrollableChat'
import { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useSocket } from '../context/SocketContext'
import { CHAT_THEMES } from '../config/chatThemes'
import {
  formatLastSeen,
  getChatAvatar,
  getChatNickname,
  getChatTitle,
  getOtherUser,
  getId,
  isUserOnline,
} from '../utils/api'

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-400/10 text-amber-400">
        <MessageCircle size={38} strokeWidth={1.8} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-zinc-100">Welcome to Wchat</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          Select a conversation on the left, search for someone new, or create a
          Circle to start chatting in real time.
        </p>
      </div>
    </div>
  )
}

/** Horizontal strip of the conversation's pinned messages. */
function PinnedBar({ pins, onJump }) {
  if (!pins?.length) return null
  return (
    <div className="no-scrollbar flex items-stretch gap-2 overflow-x-auto border-b border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
      <span className="flex items-center gap-1 self-center text-[11px] font-semibold text-amber-400">
        <Pin size={12} /> Pinned
      </span>
      {pins.map((pin) => (
        <button
          key={pin._id || getId(pin.message)}
          type="button"
          onClick={() => onJump(getId(pin.message))}
          className="flex min-w-[150px] max-w-[220px] shrink-0 flex-col rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-left transition hover:border-amber-400/50"
        >
          <span className="truncate text-[10px] font-semibold text-amber-400">
            {`${pin.message?.sender?.firstName || ''} ${pin.message?.sender?.lastName || ''}`.trim() ||
              pin.message?.sender?.username ||
              'Message'}
          </span>
          <span className="truncate text-[11px] text-zinc-400">
            {pin.message?.content || 'Attachment'}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function ChatBox({
  onBack,
  onOpenProfile,
  onStartCall,
  onOpenMeeting,
  onOpenGroupInfo,
  onOpenCircleHub,
}) {
  const { user } = useAuth()
  const { socket, onlineUsers } = useSocket()
  const {
    selectedChat,
    messages,
    loadingMessages,
    typing,
    chatSettings,
    setReplyTo,
    saveChatSettings,
    togglePinChat,
  } = useChat()

  const [menuOpen, setMenuOpen] = useState(false)
  const [panel, setNickname] = useState(null) // 'theme' | 'nickname' | 'translate' | null
  const [nickDraft, setNickDraft] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [autoLang, setAutoLang] = useState('')

  // Keep the translate panel in step with the saved per-chat preference.
  useEffect(() => {
    setAutoLang(getAutoTranslate(selectedChat?._id) || '')
  }, [selectedChat?._id])

  const isGroup = Boolean(selectedChat?.isGroupChat)
  const otherUser = !isGroup ? getOtherUser(selectedChat, user?._id) : null
  const title = getChatTitle(selectedChat, user?._id)
  const avatar = getChatAvatar(selectedChat, user?._id)
  const online = isUserOnline(otherUser, onlineUsers)
  const typingUserId = selectedChat ? typing[selectedChat._id] : null
  const isTyping = Boolean(typingUserId && typingUserId !== user?._id)

  const settings = chatSettings?.[selectedChat?._id]
  const pinnedMessages = settings?.pinnedMessages || []
  const theme = selectedChat?.theme || ''
  const vanishOn = Boolean(settings?.vanishMode ?? selectedChat?.vanishMode)

  // Nicknames apply to the other person (1:1) or the group itself.
  const nickTarget = isGroup ? null : getId(otherUser)
  const nickname = getChatNickname(selectedChat, nickTarget)

  useEffect(() => {
    setReplyTo(null)
  }, [selectedChat?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Let the server know we have seen the latest incoming message.
  useEffect(() => {
    if (!socket || !selectedChat || messages.length === 0) return
    const last = messages[messages.length - 1]
    const senderId = getId(last.sender)
    if (senderId && senderId !== user?._id) {
      socket.emit('message seen', {
        chatId: selectedChat._id,
        messageId: last._id,
        userId: user?._id,
      })
    }
  }, [socket, selectedChat?._id, messages.length, user?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedChat) return <EmptyState />

  const subtitle = isTyping
    ? 'typing…'
    : isGroup
      ? `${selectedChat.users?.length || 0} members`
      : online
        ? 'online'
        : formatLastSeen(otherUser?.lastSeen)

  const otherName = otherUser
    ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() ||
      otherUser.username
    : 'this person'

  const jumpTo = (messageId) => {
    document
      .getElementById(`msg-${messageId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handlePinChatToggle = async () => {
    setMenuOpen(false)
    try {
      const result = await togglePinChat(selectedChat._id)
      toast.success(result.pinned ? 'Conversation pinned' : 'Conversation unpinned')
    } catch (error) {
      toast.error(getApiError(error, 'Could not update the pin'))
    }
  }

  const chooseTheme = async (id) => {
    try {
      await saveChatSettings(selectedChat._id, { theme: id })
    } catch (error) {
      toast.error(getApiError(error, 'Could not save the theme'))
    }
  }

  const handleToggleVanish = async () => {
    try {
      await saveChatSettings(selectedChat._id, { vanishMode: !vanishOn })
      toast.success(!vanishOn ? 'Vanish mode on' : 'Vanish mode off')
    } catch (error) {
      toast.error(getApiError(error, 'Could not change vanish mode'))
    }
  }

  const saveNickname = async () => {
    try {
      await saveChatSettings(selectedChat._id, {
        nickname: { target: nickTarget, name: nickDraft },
      })
      setPanel(null)
      toast.success('Nickname saved')
    } catch (error) {
      toast.error(getApiError(error, 'Could not save the nickname'))
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-zinc-800/80 bg-zinc-900/60 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
          aria-label="Back to chats"
        >
          <ArrowLeft size={20} />
        </button>

        <button
          type="button"
          onClick={() =>
            isGroup ? onOpenGroupInfo?.() : otherUser && onOpenProfile?.(otherUser)
          }
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar src={avatar} name={title} size={42} online={!isGroup && online} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-100">
              {title}
            </span>
            <span
              className={`block truncate text-xs ${
                isTyping ? 'text-amber-400' : online && !isGroup ? 'text-amber-400' : 'text-zinc-500'
              }`}
            >
              {subtitle}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handlePinChatToggle}
            title={selectedChat?.pinned ? 'Unpin chat' : 'Pin chat'}
            className={`rounded-lg p-1.5 transition hover:bg-zinc-800 ${
              selectedChat?.pinned ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {selectedChat?.pinned ? <PinOff size={18} /> : <Pin size={18} />}
          </button>

          {isGroup ? (
            <>
              <button
                type="button"
                onClick={onOpenMeeting}
                title="Start a call"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Video size={18} />
              </button>
              <button
                type="button"
                onClick={onOpenCircleHub}
                title="Circle hub"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={onOpenGroupInfo}
                title="Circle info"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Info size={18} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onStartCall?.('voice', otherUser)}
                title="Voice call"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Phone size={18} />
              </button>
              <button
                type="button"
                onClick={() => onStartCall?.('video', otherUser)}
                title="Video call"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Video size={18} />
              </button>
            </>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="More"
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen ? (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="animate-scale-in absolute right-0 top-10 z-40 w-52 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 py-1 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      handlePinChatToggle()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/70"
                  >
                    {selectedChat?.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                    {selectedChat?.pinned ? 'Unpin conversation' : 'Pin conversation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setPanel((v) => (v === 'theme' ? null : 'theme'))
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/70"
                  >
                    <Palette size={15} /> Chat theme
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setNickDraft(nickname)
                      setPanel((v) => (v === 'nickname' ? null : 'nickname'))
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/70"
                  >
                    <Tag size={15} /> Set nickname
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      handleToggleVanish()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/70"
                  >
                    <EyeOff size={15} />
                    {vanishOn ? 'Turn off vanish mode' : 'Turn on vanish mode'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setPanel((v) => (v === 'translate' ? null : 'translate'))
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/70"
                  >
                    <Languages size={15} /> Translate messages
                  </button>
                  {isGroup ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        setInviteOpen(true)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/70"
                    >
                      <QrCode size={15} /> Invite by QR code
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {panel === 'theme' ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
          <span className="text-[11px] font-semibold text-zinc-400">Theme</span>
          {CHAT_THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => chooseTheme(option.id)}
              title={option.name}
              className={`h-7 w-7 rounded-full ring-2 transition ${
                theme === option.id || (!theme && option.id === 'wchat')
                  ? 'ring-zinc-100'
                  : 'ring-transparent hover:ring-zinc-600'
              }`}
              style={{
                backgroundImage: `linear-gradient(135deg, ${option.from}, ${option.to})`,
              }}
            />
          ))}
        </div>
      ) : null}

      {panel === 'nickname' ? (
        <div className="flex items-center gap-2 border-b border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
          <Tag size={14} className="text-amber-400" />
          <span className="text-[11px] text-zinc-400">
            {isGroup ? 'Circle nickname' : `Nickname for ${otherName}`}
          </span>
          <input
            value={nickDraft}
            onChange={(event) => setNickDraft(event.target.value)}
            maxLength={40}
            placeholder="Add a nickname"
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveNickname()
            }}
          />
          <button
            type="button"
            onClick={saveNickname}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="rounded-md p-1 text-zinc-500 hover:text-zinc-200"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {panel === 'translate' ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
          <Languages size={14} className="text-amber-400" />
          <span className="text-[11px] text-zinc-400">
            Translate this chat into
          </span>
          <select
            value={autoLang}
            onChange={(event) => {
              const value = event.target.value
              setAutoLang(value)
              setAutoTranslate(selectedChat._id, value || null)
              setGlobalTarget(value || 'en')
              toast.success(
                value
                  ? `Incoming messages will be translated automatically`
                  : 'Automatic translation turned off'
              )
            }}
            className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
          >
            <option value="">Off — translate on demand</option>
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="ml-auto rounded-md p-1 text-zinc-500 hover:text-zinc-200"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {vanishOn ? (
        <div className="flex items-center gap-2 border-b border-zinc-800/80 bg-indigo-500/10 px-3 py-1.5 text-[11px] text-indigo-200">
          <EyeOff size={13} />
          Vanish mode is on — messages here disappear after 24 hours.
        </div>
      ) : null}

      <PinnedBar pins={pinnedMessages} onJump={jumpTo} />

      <ScrollableChat
        messages={messages}
        loading={loadingMessages}
        onUserClick={onOpenProfile}
      />

      {isTyping ? (
        <div className="flex items-center gap-2 px-4 pb-1 text-xs text-amber-400">
          <span className="typing-dot">•</span>
          <span className="typing-dot">•</span>
          <span className="typing-dot">•</span>
          <span className="text-zinc-500">typing…</span>
        </div>
      ) : null}

      <MessageInput chatId={selectedChat._id} />

      {inviteOpen ? (
        <GroupInviteModal chat={selectedChat} onClose={() => setInviteOpen(false)} />
      ) : null}
    </>
  )
}
