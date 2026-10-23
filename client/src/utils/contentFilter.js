/**
 * Hidden words.
 *
 * Members can mute words or phrases (Settings → Privacy & safety). The list is
 * stored server-side in `user.preferences.hiddenWords` and mirrored here so any
 * screen can filter content without prop-drilling the whole app.
 */

const KEY = 'wchatHiddenWords'

/** Normalise a list of words into trimmed, lower-cased, unique values. */
export function normalizeWords(words = []) {
  return [...new Set((Array.isArray(words) ? words : []).map((w) => String(w).trim().toLowerCase()).filter(Boolean))]
}

export function getHiddenWords() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeWords(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function setHiddenWords(words = []) {
  const clean = normalizeWords(words)
  try {
    if (clean.length) localStorage.setItem(KEY, JSON.stringify(clean))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable — filtering simply stays off */
  }
  return clean
}

/** True when `text` contains any hidden word. */
export function hasHiddenWord(text, words = getHiddenWords()) {
  if (!text || !words?.length) return false
  const haystack = String(text).toLowerCase()
  return words.some((word) => word && haystack.includes(word))
}

/**
 * Drops anything whose text contains a hidden word.
 * `getText` pulls the searchable text out of each item.
 */
export function filterHidden(items = [], getText = (item) => item?.text) {
  const words = getHiddenWords()
  if (!words.length) return items
  return items.filter((item) => !hasHiddenWord(getText(item), words))
}

export default { getHiddenWords, setHiddenWords, hasHiddenWord, filterHidden, normalizeWords }
