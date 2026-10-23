export function getId(obj) {
  if (!obj) return null
  if (typeof obj === 'string') return obj
  if (obj._id) return String(obj._id)
  return null
}

/**
 * Origin of the API/Socket.IO server.
 *
 * Development and single-host deployments can leave `VITE_API_URL` unset: the
 * Vite proxy (or the same Express process) answers `/api` and `/uploads`.
 * When the client is hosted separately (Vercel/Netlify) from the API
 * (Render/Koyeb), set `VITE_API_URL=https://your-api.onrender.com` at build
 * time and every request, upload URL and socket connects there.
 */
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim()
// In development the API lives on :5000 (Vite only proxies `/api`/`/uploads`,
// not the Socket.IO handshake). In production an unset value means "same
// origin", which is how single-host deployments are served.
const fallbackApiUrl = import.meta.env.DEV ? 'http://localhost:5000' : ''
export const API_BASE_URL = (configuredApiUrl || fallbackApiUrl).replace(/\/+$/, '')
/** `/api` in same-origin mode, or an absolute URL when hosted separately. */
export const API_PREFIX = `${API_BASE_URL}/api`
export const API_ORIGIN = API_BASE_URL

export function getFileUrl(path) {
  if (!path) return ''
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:') ||
    path.startsWith('data:')
  ) {
    return path
  }
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}

export function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

export function formatDateLabel(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const dayMs = 24 * 60 * 60 * 1000
  if (target === today) return 'Today'
  if (target === today - dayMs) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatLastSeen(value) {
  if (!value) return 'Offline'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Offline'
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Last seen just now'
  if (minutes < 60) return `Last seen ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Last seen ${hours}h ago`
  return `Last seen ${formatDateLabel(value)}`
}

export function getInitials(name) {
  if (!name) return '?'
  const clean = String(name).replace(/^[#@]/, '').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function getOtherUser(chat, currentUserId) {
  if (!chat || chat.isGroupChat || !Array.isArray(chat.users)) return null
  return (
    chat.users.find((u) => getId(u) !== currentUserId) ||
    chat.users[0] ||
    null
  )
}

export function getChatTitle(chat, currentUserId) {
  if (!chat) return ''
  if (chat.isGroupChat) {
    return getChatNickname(chat) || chat.chatName || 'Group chat'
  }
  const other = getOtherUser(chat, currentUserId)
  if (!other) return chat.chatName || 'Chat'
  const nickname = getChatNickname(chat, getId(other))
  return (
    nickname ||
    `${other.firstName || ''} ${other.lastName || ''}`.trim() ||
    other.username
  )
}

/**
 * A member's private nickname for a chat or a person in it.
 * `targetId` of null means "the group itself".
 */
export function getChatNickname(chat, targetId = null) {
  const list = chat?.nicknames || []
  const wanted = targetId ? String(targetId) : null
  const found = list.find(
    (entry) => (entry.target ? String(entry.target) : null) === wanted
  )
  return found?.name || ''
}

export function getChatAvatar(chat, currentUserId) {
  if (!chat) return ''
  if (chat.isGroupChat) return chat.groupAvatar || ''
  const other = getOtherUser(chat, currentUserId)
  return other?.profilePicture || ''
}

export function getLastMessagePreview(message) {
  if (!message) return ''
  switch (message.contentType) {
    case 'image':
      return '📷 Photo'
    case 'audio':
      return '🎤 Voice message'
    case 'video':
      return '🎬 Video'
    case 'file':
      return '📄 File'
    default:
      return message.content || ''
  }
}

export function getSenderName(message) {
  const sender = message?.sender
  if (!sender) return 'Someone'
  if (typeof sender === 'string') return 'Someone'
  return (
    `${sender.firstName || ''} ${sender.lastName || ''}`.trim() ||
    sender.username ||
    'Someone'
  )
}

export function isUserOnline(user, onlineUsers = []) {
  if (!user) return false
  const id = getId(user)
  return Boolean(user.isOnline) || onlineUsers.includes(id)
}

export function truncate(text, length = 60) {
  if (!text) return ''
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}