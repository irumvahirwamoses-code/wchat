import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { getId, getLastMessagePreview, getSenderName, truncate } from '../utils/api'
import { useAuth } from './AuthContext'
import { useSocket } from './SocketContext'

const ChatContext = createContext(null)

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) throw new Error('useChat must be used inside <ChatProvider>')
  return context
}

export function ChatProvider({ children }) {
  const { user, token } = useAuth()
  const { socket } = useSocket()

  const [chats, setChats] = useState([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [notifications, setNotifications] = useState({})
  const [typing, setTyping] = useState({})
  const [joinRequests, setJoinRequests] = useState([])
  // The message the composer is currently quoting (null when not replying).
  const [replyTo, setReplyTo] = useState(null)
  // Per-chat settings keyed by chat id: { theme, nicknames, pinnedMessages }.
  const [chatSettings, setChatSettings] = useState({})

  const selectedChatRef = useRef(null)
  const typingTimersRef = useRef({})
  const lastChatsFetchRef = useRef(0)
  const seenCallRef = useRef({})

  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  /* ------------------------------------------------------------------ chats */
  const fetchChats = useCallback(async () => {
    if (!token) return []
    setLoadingChats(true)
    try {
      const { data } = await api.get('/chats')
      const list = Array.isArray(data) ? data : []
      setChats(list)
      setSelectedChat((prev) => {
        if (!prev) return prev
        return list.find((c) => c._id === prev._id) || prev
      })
      return list
    } catch (error) {
      toast.error(getApiError(error, 'Failed to load your chats'))
      return []
    } finally {
      setLoadingChats(false)
    }
  }, [token])

  const refreshChatsThrottled = useCallback(() => {
    const now = Date.now()
    if (now - lastChatsFetchRef.current < 2000) return
    lastChatsFetchRef.current = now
    fetchChats()
  }, [fetchChats])

  /* ------------------------------------------------------- pending QR invite */
  // A scanned invite opened while signed out is redeemed once the user is in.
  useEffect(() => {
    if (!token) return
    let code = null
    try {
      code = localStorage.getItem('wchatPendingJoin')
      if (code) localStorage.removeItem('wchatPendingJoin')
    } catch {
      code = null
    }
    if (!code) return

    api
      .post(`/chats/join/${encodeURIComponent(code)}`)
      .then(({ data }) => {
        if (data?.joined) {
          toast.success(`Joined ${data.chat?.chatName || 'the Circle'}`)
        } else if (data?.pending) {
          toast.success('Your join request was sent')
        }
        fetchChats()
      })
      .catch(() => toast.error('That invite link is no longer valid'))
  }, [token, fetchChats])

  /* ---------------------------------------------------------- join requests */
  const fetchJoinRequests = useCallback(async () => {    if (!token) return []
    try {
      const { data } = await api.get('/chats/join-requests')
      const list = Array.isArray(data) ? data : data?.requests || []
      setJoinRequests(list)
      return list
    } catch {
      return []
    }
  }, [token])

  /* --------------------------------------------------------------- messages */
  const fetchMessages = useCallback(async (chatId) => {
    if (!chatId) {
      setMessages([])
      return []
    }
    setLoadingMessages(true)
    try {
      const { data } = await api.get(`/messages/${chatId}`)
      const list = Array.isArray(data) ? data : []
      setMessages(list)
      return list
    } catch (error) {
      setMessages([])
      toast.error(getApiError(error, 'Failed to load messages'))
      return []
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  /**
   * Mark every unread message in an open chat as seen (receipts) and tell the
   * server so the other side's ticks update in real time.
   */
  const markChatSeen = useCallback(
    async (chatId) => {
      if (!chatId || !user?._id) return
      const userId = user._id

      setMessages((prev) =>
        prev.map((m) => {
          if (getId(m.sender) === userId) return m
          const seen = (m.seenBy || []).some((id) => getId(id) === userId)
          return seen ? m : { ...m, seenBy: [...(m.seenBy || []), userId] }
        })
      )

      // Throttle the network call: every message received while the chat is
      // open would otherwise re-send the same request.
      const now = Date.now()
      if (!seenCallRef.current[chatId] || now - seenCallRef.current[chatId] > 1500) {
        seenCallRef.current[chatId] = now
        try {
          await api.put(`/messages/${chatId}/seen`)
        } catch {
          // Non-blocking: socket `chat seen` will sync when it works.
        }
      }
    },
    [user?._id]
  )

  /**
   * Load the caller's per-chat settings (theme, nicknames, pinned messages) and
   * mirror the theme/nicknames onto the chat so every bubble can use them.
   */
  const fetchChatSettings = useCallback(async (chatId) => {
    if (!chatId) return null
    try {
      const { data } = await api.get(`/chats/${chatId}/settings`)
      setChatSettings((prev) => ({ ...prev, [chatId]: data }))
      setSelectedChat((prev) =>
        prev && prev._id === chatId
          ? {
              ...prev,
              theme: data.theme,
              nicknames: data.nicknames,
              vanishMode: data.vanishMode,
            }
          : prev
      )
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === chatId
            ? {
                ...chat,
                theme: data.theme,
                nicknames: data.nicknames,
                pinnedCount: (data.pinnedMessages || []).length,
              }
            : chat
        )
      )
      return data
    } catch {
      return null
    }
  }, [])

  /** Save a theme and/or a nickname, then reflect it locally. */
  const saveChatSettings = useCallback(async (chatId, patch) => {
    const { data } = await api.put(`/chats/${chatId}/settings`, patch)
    setChatSettings((prev) => ({
      ...prev,
      [chatId]: { ...(prev[chatId] || {}), ...data },
    }))
    setSelectedChat((prev) =>
      prev && prev._id === chatId
        ? {
            ...prev,
            theme: data.theme,
            nicknames: data.nicknames,
            vanishMode: data.vanishMode,
          }
        : prev
    )
    setChats((prev) =>
      prev.map((chat) =>
        chat._id === chatId
          ? { ...chat, theme: data.theme, nicknames: data.nicknames }
          : chat
      )
    )
    return data
  }, [])

  /** Add, change or clear the caller's emoji reaction on a message. */
  const reactToMessage = useCallback(async (messageId, emoji) => {
    const { data } = await api.put(`/messages/${messageId}/react`, { emoji })
    setMessages((prev) => prev.map((m) => (m._id === messageId ? data : m)))
    return data
  }, [])

  /** Pin or unpin a message in a chat (max 3). */
  const togglePinMessage = useCallback(
    async (chatId, messageId, isPinned) => {
      if (isPinned) await api.delete(`/chats/${chatId}/pin-message/${messageId}`)
      else await api.post(`/chats/${chatId}/pin-message`, { messageId })
      await fetchChatSettings(chatId)
    },
    [fetchChatSettings]
  )

  /** Pin or unpin a conversation for the current user (max 3). */
  const togglePinChat = useCallback(async (chatId) => {
    const { data } = await api.put(`/chats/${chatId}/pin`)
    setChats((prev) => {
      const next = prev.map((chat) =>
        chat._id === chatId ? { ...chat, pinned: data.pinned } : chat
      )
      next.sort((a, b) => Number(b.pinned) - Number(a.pinned))
      return next
    })
    setSelectedChat((prev) =>
      prev && prev._id === chatId ? { ...prev, pinned: data.pinned } : prev
    )
    return data
  }, [])

  const selectChat = useCallback(
    (chat) => {
      setMessages([])
      setReplyTo(null)
      setSelectedChat(chat || null)
      if (chat?._id) {
        setNotifications((prev) => {
          if (!prev[chat._id]) return prev
          const next = { ...prev }
          delete next[chat._id]
          return next
        })
        socket?.emit('join chat', chat._id)
        fetchChatSettings(chat._id)
        fetchMessages(chat._id).then((list) => {
          const hasIncoming = (list || []).some(
            (m) => getId(m.sender) !== user?._id
          )
          if (hasIncoming) markChatSeen(chat._id)
        })
      }
    },
    [socket, fetchMessages, markChatSeen, fetchChatSettings, user?._id]
  )

  /* ------------------------------------------------- edit / delete / receipts */
  const editMessage = useCallback(async (messageId, text) => {
    const { data } = await api.put(`/messages/${messageId}`, { text })
    setMessages((prev) => prev.map((m) => (m._id === messageId ? data : m)))
    return data
  }, [])

  const deleteMessage = useCallback(
    async (messageId) => {
      await api.delete(`/messages/${messageId}`)
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
      refreshChatsThrottled()
    },
    [refreshChatsThrottled]
  )

  const patchSelectedChat = useCallback((patch) => {
    setSelectedChat((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const clearNotification = useCallback((chatId) => {
    setNotifications((prev) => {
      if (!prev[chatId]) return prev
      const next = { ...prev }
      delete next[chatId]
      return next
    })
  }, [])

  const leaveChatLocally = useCallback(
    (chatId) => {
      setChats((prev) => prev.filter((c) => c._id !== chatId))
      setSelectedChat((prev) => (prev?._id === chatId ? null : prev))
      setMessages([])
    },
    []
  )

  const moveChatToTopWithMessage = useCallback((message) => {
    const chatId = getId(message?.chat)
    if (!chatId) return
    setChats((prev) => {
      const index = prev.findIndex((c) => c._id === chatId)
      if (index === -1) return prev
      const chat = {
        ...prev[index],
        lastMessage: message,
        updatedAt: message.createdAt || new Date().toISOString(),
      }
      return [chat, ...prev.filter((_, i) => i !== index)]
    })
  }, [])

  /**
   * Central send handler: uploads the multipart payload, appends the returned
   * (populated) message, notifies the server and refreshes the chat preview.
   */
  const sendMessage = useCallback(
    async (formData) => {
      const { data } = await api.post('/messages', formData)
      setMessages((prev) =>
        prev.some((m) => m._id === data._id) ? prev : [...prev, data]
      )
      // Scheduled messages stay private until the server's scheduler sends them.
      if (data.delivered !== false) socket?.emit('new message', data)
      moveChatToTopWithMessage(data)
      refreshChatsThrottled()
      return data
    },
    [socket, moveChatToTopWithMessage, refreshChatsThrottled]
  )

  /* --------------------------------------------------------- live location */
  const sendLiveLocation = useCallback(
    async (chatId, { latitude, longitude, durationMinutes = 60 }) => {
      const { data } = await api.post('/messages/live-location', {
        chatId,
        latitude,
        longitude,
        durationMinutes,
      })
      setMessages((prev) =>
        prev.some((m) => m._id === data._id) ? prev : [...prev, data]
      )
      socket?.emit('new message', data)
      moveChatToTopWithMessage(data)
      refreshChatsThrottled()
      return data
    },
    [socket, moveChatToTopWithMessage, refreshChatsThrottled]
  )

  const moveLiveLocation = useCallback(async (messageId, { latitude, longitude }) => {
    const { data } = await api.put(`/messages/${messageId}/live-location`, {
      latitude,
      longitude,
    })
    return data
  }, [])

  const stopLiveLocation = useCallback(async (messageId) => {
    const { data } = await api.put(`/messages/${messageId}/live-location/stop`)
    return data
  }, [])

  /* --------------------------------------------------- realtime subscriptions */
  useEffect(() => {
    if (!socket) return undefined

    const handleMessageReceived = (message) => {
      if (!message) return
      const chatId = getId(message.chat)
      moveChatToTopWithMessage(message)

      const current = selectedChatRef.current
      if (current && current._id === chatId) {
        setMessages((prev) =>
          prev.some((m) => m._id === message._id) ? prev : [...prev, message]
        )
        // The conversation is on screen: the incoming message is already read.
        if (getId(message.sender) !== user?._id) markChatSeen(chatId)
      }
      refreshChatsThrottled()
    }

    const handleNewMessageNotification = ({ chatId, message, senderName }) => {
      const current = selectedChatRef.current
      if (current && current._id === chatId) return
      setNotifications((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || 0) + 1,
      }))
      toast(
        `${senderName || getSenderName(message) || 'New message'}: ${truncate(
          getLastMessagePreview(message),
          48
        )}`,
        { icon: '💬' }
      )
    }

    const handleTyping = ({ chatId, userId }) => {
      if (!chatId) return
      setTyping((prev) => ({ ...prev, [chatId]: userId }))
      clearTimeout(typingTimersRef.current[chatId])
      typingTimersRef.current[chatId] = setTimeout(() => {
        setTyping((prev) => {
          if (!prev[chatId]) return prev
          const next = { ...prev }
          delete next[chatId]
          return next
        })
      }, 3500)
    }

    const handleStopTyping = ({ chatId }) => {
      if (!chatId) return
      clearTimeout(typingTimersRef.current[chatId])
      setTyping((prev) => {
        if (!prev[chatId]) return prev
        const next = { ...prev }
        delete next[chatId]
        return next
      })
    }

    const handleMessageReacted = (message) => {
      if (!message?._id) return
      setMessages((prev) =>
        prev.map((m) => (m._id === message._id ? { ...m, reactions: message.reactions } : m))
      )
    }

    const handlePinnedMessages = ({ chatId }) => {
      if (!chatId) return
      fetchChatSettings(chatId)
    }

    const handleLocationUpdated = ({ messageId, latitude, longitude, live }) => {
      if (!messageId) return
      setMessages((prev) =>
        prev.map((message) => {
          if (message._id !== messageId) return message

          let payload = {}
          try {
            payload = JSON.parse(message.content)
          } catch {
            payload = {}
          }

          return {
            ...message,
            content: JSON.stringify({
              ...payload,
              ...(typeof latitude === 'number' ? { latitude, longitude } : {}),
              ...(typeof live === 'boolean' ? { live } : {}),
            }),
          }
        })
      )
    }

    const handleChatSettings = ({ chatId, vanishMode }) => {
      if (!chatId) return
      if (typeof vanishMode !== 'boolean') return
      setChatSettings((prev) => ({
        ...prev,
        [chatId]: { ...(prev[chatId] || {}), vanishMode },
      }))
      setSelectedChat((prev) =>
        prev && prev._id === chatId ? { ...prev, vanishMode } : prev
      )
    }

    const handleMessageSeen = ({ messageId, seenBy }) => {
      if (!messageId || !Array.isArray(seenBy)) return
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, seenBy } : m))
      )
    }

    const handleChatSeen = ({ chatId, userId }) => {
      if (!chatId || !userId) return
      setMessages((prev) =>
        prev.map((m) => {
          if (getId(m.sender) === userId) return m
          const seen = (m.seenBy || []).some((id) => getId(id) === userId)
          return seen ? m : { ...m, seenBy: [...(m.seenBy || []), userId] }
        })
      )
    }

    const handleMessageEdited = (updated) => {
      if (!updated?._id) return
      setMessages((prev) =>
        prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m))
      )
    }

    const handleMessageDeleted = ({ messageId }) => {
      if (!messageId) return
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
    }

    const handleNewJoinRequest = () => {
      toast('New join request received', { icon: '👋' })
      fetchJoinRequests()
    }

    socket.on('message received', handleMessageReceived)
    socket.on('new message notification', handleNewMessageNotification)
    socket.on('typing', handleTyping)
    socket.on('stop typing', handleStopTyping)
    socket.on('message seen', handleMessageSeen)
    socket.on('message reacted', handleMessageReacted)
    socket.on('chat pinned-messages', handlePinnedMessages)
    socket.on('chat settings', handleChatSettings)
    socket.on('location updated', handleLocationUpdated)
    socket.on('chat seen', handleChatSeen)
    socket.on('message edited', handleMessageEdited)
    socket.on('message deleted', handleMessageDeleted)
    socket.on('new join request', handleNewJoinRequest)

    return () => {
      socket.off('message received', handleMessageReceived)
      socket.off('new message notification', handleNewMessageNotification)
      socket.off('typing', handleTyping)
      socket.off('stop typing', handleStopTyping)
      socket.off('message seen', handleMessageSeen)
      socket.off('message reacted', handleMessageReacted)
      socket.off('chat pinned-messages', handlePinnedMessages)
      socket.off('chat settings', handleChatSettings)
      socket.off('location updated', handleLocationUpdated)
      socket.off('chat seen', handleChatSeen)
      socket.off('message edited', handleMessageEdited)
      socket.off('message deleted', handleMessageDeleted)
      socket.off('new join request', handleNewJoinRequest)
      Object.values(typingTimersRef.current).forEach(clearTimeout)
      typingTimersRef.current = {}
    }
  }, [
    socket,
    moveChatToTopWithMessage,
    refreshChatsThrottled,
    fetchJoinRequests,
    fetchChatSettings,
    markChatSeen,
    user?._id,
  ])

  /* ------------------------------------------------------------- join request */
  const pendingJoinRequestCount = useMemo(
    () => joinRequests.filter((r) => r.status === 'pending').length,
    [joinRequests]
  )

  const value = useMemo(
    () => ({
      chats,
      setChats,
      loadingChats,
      fetchChats,
      selectedChat,
      selectChat,
      patchSelectedChat,
      leaveChatLocally,
      messages,
      setMessages,
      loadingMessages,
      fetchMessages,
      sendMessage,
      editMessage,
      deleteMessage,
      markChatSeen,
      notifications,
      clearNotification,
      typing,
      joinRequests,
      fetchJoinRequests,
      pendingJoinRequestCount,
      replyTo,
      setReplyTo,
      chatSettings,
      fetchChatSettings,
      saveChatSettings,
      reactToMessage,
      togglePinMessage,
      togglePinChat,
      sendLiveLocation,
      moveLiveLocation,
      stopLiveLocation,
      currentUserId: user?._id || null,
    }),
    [
      chats,
      loadingChats,
      fetchChats,
      selectedChat,
      selectChat,
      patchSelectedChat,
      leaveChatLocally,
      messages,
      loadingMessages,
      fetchMessages,
      sendMessage,
      editMessage,
      deleteMessage,
      markChatSeen,
      notifications,
      clearNotification,
      typing,
      joinRequests,
      fetchJoinRequests,
      pendingJoinRequestCount,
      replyTo,
      chatSettings,
      fetchChatSettings,
      saveChatSettings,
      reactToMessage,
      togglePinMessage,
      togglePinChat,
      sendLiveLocation,
      moveLiveLocation,
      stopLiveLocation,
      user?._id,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
