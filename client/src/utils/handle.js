/**
 * Display helpers for Wchat.
 *
 * Usernames are stored plainly ("keza"). On screen we show them as "@keza".
 * Legacy rows may still carry a '#' or '@' prefix, so we normalise first.
 */

export const cleanUsername = (username) => String(username || '').replace(/^[@#]+/, '')

/** "@keza" from "keza", "#keza" or "@keza". */
export const formatHandle = (username) => {
  const clean = cleanUsername(username)
  return clean ? `@${clean}` : ''
}

/** Search input "keza", "@keza", "#keza" → "keza". */
export const normalizeUsernameInput = (value) =>
  String(value || '')
    .trim()
    .replace(/^[@#]+/, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .toLowerCase()
    .slice(0, 20)

export default { cleanUsername, formatHandle, normalizeUsernameInput }
