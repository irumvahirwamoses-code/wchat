/**
 * System-wide appearance preferences.
 *
 * Everything lives in localStorage so it applies instantly (and before the
 * first paint), and the chosen theme is also mirrored onto the account when
 * the member saves Settings, so it follows them across devices.
 *
 * `light` is Wchat's brand default.
 */
export const THEMES = [
  { id: 'light', name: 'Light', hint: 'Bright Wchat blue on soft white' },
  { id: 'dark', name: 'Dark', hint: 'Easy on the eyes at night' },
  { id: 'midnight', name: 'Midnight', hint: 'Deep indigo night mode' },
]

export const THEME_KEY = 'wchatTheme'
export const DATA_SAVER_KEY = 'wchatDataSaver'

// Wchat was previously called KONO. Read (and migrate) the old keys so nobody
// loses the theme they picked before the rename.
const LEGACY_THEME_KEY = 'konoTheme'
const LEGACY_DATA_SAVER_KEY = 'konoDataSaver'

function readPreference(key, legacyKey) {
  try {
    const value = localStorage.getItem(key)
    if (value !== null) return value
    const legacy = localStorage.getItem(legacyKey)
    if (legacy !== null) {
      localStorage.setItem(key, legacy)
      localStorage.removeItem(legacyKey)
    }
    return legacy
  } catch {
    return null
  }
}

const THEME_IDS = THEMES.map((t) => t.id)
export const DEFAULT_THEME = 'light'

export function getTheme() {
  const saved = readPreference(THEME_KEY, LEGACY_THEME_KEY)
  return THEME_IDS.includes(saved) ? saved : DEFAULT_THEME
}

/** Apply a theme to the document (the default theme needs no attribute). */
export function applyTheme(theme) {
  try {
    const id = THEME_IDS.includes(theme) ? theme : DEFAULT_THEME
    if (id === DEFAULT_THEME) document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', id)
    localStorage.setItem(THEME_KEY, id)
    return id
  } catch {
    return DEFAULT_THEME
  }
}

export function isDataSaver() {
  return readPreference(DATA_SAVER_KEY, LEGACY_DATA_SAVER_KEY) === '1'
}

export function setDataSaver(on) {
  try {
    if (on) localStorage.setItem(DATA_SAVER_KEY, '1')
    else localStorage.removeItem(DATA_SAVER_KEY)
  } catch {
    /* ignore */
  }
  return Boolean(on)
}

/** Cycles Light → Dark → Midnight → Light (used by the quick theme toggle). */
export function nextTheme(current) {
  const idx = THEME_IDS.indexOf(THEME_IDS.includes(current) ? current : DEFAULT_THEME)
  return THEME_IDS[(idx + 1) % THEME_IDS.length]
}
