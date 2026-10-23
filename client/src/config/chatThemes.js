/**
 * Chat themes.
 *
 * A theme colours the outgoing bubbles of a single conversation. Each member
 * picks their own theme, so the same chat can look different on each side.
 * The chosen id is stored per user (`user.chatThemes`) — `''` means default.
 */

export const CHAT_THEMES = [
  { id: 'wchat', name: 'Wchat', from: '#245BFF', to: '#7B4DFF' },
  { id: 'sunset', name: 'Sunset', from: '#F97316', to: '#EC4899' },
  { id: 'mint', name: 'Mint', from: '#10B981', to: '#06B6D4' },
  { id: 'grape', name: 'Grape', from: '#8B5CF6', to: '#EC4899' },
  { id: 'ember', name: 'Ember', from: '#EF4444', to: '#F59E0B' },
  { id: 'slate', name: 'Slate', from: '#334155', to: '#0F172A' },
]

export const DEFAULT_CHAT_THEME = CHAT_THEMES[0]

/** Resolve a stored theme id, falling back to the default Wchat theme. */
export function getChatTheme(id) {
  return CHAT_THEMES.find((theme) => theme.id === id) || DEFAULT_CHAT_THEME
}

/** Inline style for an outgoing bubble in the given theme. */
export function chatBubbleStyle(id) {
  const theme = getChatTheme(id)
  return { backgroundImage: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }
}

/** Quick reactions offered on the message action picker. */
export const MESSAGE_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

export default { CHAT_THEMES, DEFAULT_CHAT_THEME, getChatTheme, chatBubbleStyle, MESSAGE_REACTIONS }
