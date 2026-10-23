/**
 * Instant translation for chat messages.
 *
 * Translation happens on-device via the browser's built-in Translator API
 * (Chrome/Edge expose `Translator`, with `LanguageDetector` for detection).
 * Nothing is sent to a third party, and when the browser cannot translate we
 * say so plainly instead of pretending.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ar', name: 'Arabic' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' },
]

export const languageName = (code) =>
  LANGUAGES.find((entry) => entry.code === code)?.name || code

const translators = new Map()
const memoryCache = new Map()

/** True when this browser can translate on-device. */
export function translationSupported() {
  return typeof window !== 'undefined' && typeof window.Translator !== 'undefined'
}

/** Best-effort language detection; falls back to English. */
export async function detectLanguage(text) {
  if (typeof window !== 'undefined' && window.LanguageDetector) {
    try {
      const detector = await window.LanguageDetector.create()
      const [best] = await detector.detect(text)
      if (best?.detectedLanguage) return best.detectedLanguage
    } catch {
      /* fall through to the default */
    }
  }
  return 'en'
}

async function getTranslator(source, target) {
  const key = `${source}->${target}`
  if (!translators.has(key)) {
    translators.set(
      key,
      window.Translator.create({ sourceLanguage: source, targetLanguage: target })
    )
  }
  return translators.get(key)
}

/**
 * Translate `text` into `target`. Returns `{ text, source, translated }`;
 * `translated` is false when the source already matches the target.
 */
export async function translateText(text, target) {
  const value = String(text || '').trim()
  if (!value) return { text: '', source: target, translated: false }

  if (!translationSupported()) {
    throw new Error('Instant translation needs a browser with on-device translation')
  }

  const source = await detectLanguage(value)
  if (source === target) return { text: value, source, translated: false }

  const cacheKey = `${source}->${target}:${value}`
  if (memoryCache.has(cacheKey)) {
    return { text: memoryCache.get(cacheKey), source, translated: true }
  }

  const translator = await getTranslator(source, target)
  const result = await translator.translate(value)
  memoryCache.set(cacheKey, result)

  return { text: result, source, translated: true }
}

/* ------------------------------------------------ per-chat auto-translation */
const autoKey = (chatId) => `wchatTranslate:${chatId}`
const GLOBAL_TARGET_KEY = 'wchatTranslateTo'
export const TRANSLATE_EVENT = 'wchat:translate-changed'

/** The language plain "Translate" buttons use. Defaults to English. */
export function getGlobalTarget() {
  try {
    return localStorage.getItem(GLOBAL_TARGET_KEY) || 'en'
  } catch {
    return 'en'
  }
}

/** Remember the language plain "Translate" buttons should use. */
export function setGlobalTarget(language) {
  try {
    localStorage.setItem(GLOBAL_TARGET_KEY, language || 'en')
  } catch {
    /* storage unavailable */
  }
  notifyTranslateChanged()
}

/** Tell open components that translation settings changed. */
export function notifyTranslateChanged() {
  try {
    window.dispatchEvent(new CustomEvent(TRANSLATE_EVENT))
  } catch {
    /* no window (SSR) */
  }
}

/** The language this chat auto-translates into, or null when off. */
export function getAutoTranslate(chatId) {
  if (!chatId) return null
  try {
    return localStorage.getItem(autoKey(chatId)) || null
  } catch {
    return null
  }
}

/** Turn auto-translation on (language code) or off (null) for a chat. */
export function setAutoTranslate(chatId, language) {
  if (!chatId) return
  try {
    if (!language) localStorage.removeItem(autoKey(chatId))
    else localStorage.setItem(autoKey(chatId), language)
  } catch {
    /* storage unavailable */
  }
  notifyTranslateChanged()
}
