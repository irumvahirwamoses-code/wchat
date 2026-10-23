import { MessageSquarePlus, Loader2 } from 'lucide-react'
import Avatar from './Avatar'
import { Pin } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useSocket } from '../context/SocketContext'
import {
  formatTime,
  getChatAvatar,
  getChatTitle,
  getLastMessagePreview,
  getId,
  getOtherUser,
} from '../utils/api'

export default function ChatList() {
  const { user } = useAuth()
  const { onlineUsers } = useSocket()
  const {
    chats,
    selectedChat,
    selectChat,
    notifications,
    typing,
    loadingChats,
  } = useChat()

  const currentUserId = user?._id

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Chats
        </h2>
        {loadingChats && chats.length ? (
          <Loader2 size={14} className="animate-spin text-amber-400" />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {loadingChats && chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
            <div className="spinner" />
            <p className="text-sm">Loading your chats…</p>
          </div>
        ) : null}

        {!loadingChats && chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-zinc-500">
            <MessageSquarePlus size={28} className="text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">No chats yet</p>
            <p className="text-xs">
              Search for someone above or create a group to get started.
            </p>
          </div>
        ) : null}

        {chats.map((chat) => {
          const other = getOtherUser(chat, currentUserId)
          const title = getChatTitle(chat, currentUserId)
          const avatar = getChatAvatar(chat, currentUserId)
          const online = other
            ? onlineUsers.includes(other._id) || other.isOnline
            : false
          const unread = notifications[chat._id] || 0
          const isTyping = Boolean(typing[chat._id])
          const active = selectedChat?._id === chat._id
          const last = chat.lastMessage
          const lastPreview = getLastMessagePreview(last)
          const senderId = getId(last?.sender)
          const inGroup = chat.isGroupChat
          const senderLabel =
            inGroup && last && senderId && senderId !== currentUserId
              ? `${last.sender?.firstName || 'Someone'}: `
              : ''

          return (
            <button
              key={chat._id}
              type="button"
              onClick={() => selectChat(chat)}
              className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                active
                  ? 'bg-amber-400/10 ring-1 ring-amber-400/30'
                  : 'hover:bg-zinc-800/60'
              }`}
            >
              <Avatar src={avatar} name={title} size={48} online={online} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1">
                    {chat.pinned ? (
                      <Pin size={12} className="shrink-0 text-amber-400" />
                    ) : null}
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {title}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[11px] ${
                      unread > 0 ? 'text-amber-400' : 'text-zinc-500'
                    }`}
                  >
                    {last?.createdAt ? formatTime(last.createdAt) : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-zinc-400">
                    {isTyping ? (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <span className="typing-dot">•</span>
                        <span className="typing-dot">•</span>
                        <span className="typing-dot">•</span>
                        <span className="ml-1 not-italic">typing</span>
                      </span>
                    ) : (
                      <>
                        {senderLabel}
                        {lastPreview || 'No messages yet'}
                      </>
                    )}
                  </span>

                  {unread > 0 ? (
                    <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
