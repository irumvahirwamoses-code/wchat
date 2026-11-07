import { API_PREFIX } from './api'
import { TOKEN_KEY } from '../config/api'

/**
 * Client-side feed event collector.
 *
 * Events are queued and flushed in batches so a scroll through Home costs one
 * request, not twenty. The final flush uses `keepalive` so it still lands when
 * the tab is hidden or closed.
 */

const MAX_BATCH = 50
const FLUSH_DELAY = 4000
const IMPRESSION_COOLDOWN = 30 * 1000

/**
 * Explicit actions are rare and valuable. Flush them immediately so a reload
 * (or a quick "Not interested") cannot lose the signal, while views and
 * impressions stay batched.
 */
const IMMEDIATE_EVENTS = new Set([
  'spark',
  'unspark',
  'comment',
  'save',
  'unsave',
  'share',
  'click',
  'join',
  'follow',
  'profile_click',
  'more_like_this',
  'hide',
  'not_interested',
  'less_like_this',
  'report',
  'block',
  'mute_source',
])

const queue = []
const impressionSeen = new Map()
let flushTimer = null
let sessionId = ''

function generateSessionId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    /* fall through */
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getFeedSessionId() {
  if (sessionId) return sessionId
  try {
    const stored = window.sessionStorage.getItem('wchatFeedSession')
    if (stored) {
      sessionId = stored
      return sessionId
    }
    sessionId = generateSessionId()
    window.sessionStorage.setItem('wchatFeedSession', sessionId)
  } catch {
    sessionId = generateSessionId()
  }
  return sessionId
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushFeedEvents()
  }, FLUSH_DELAY)
}

/** True at most once per item per 30s, so re-renders cannot inflate impressions. */
export function shouldTrackImpression(itemId) {
  const key = String(itemId)
  const now = Date.now()
  const last = impressionSeen.get(key)
  if (last && now - last < IMPRESSION_COOLDOWN) return false
  impressionSeen.set(key, now)
  return true
}

export function trackFeedEvent(event) {
  if (!event?.itemId || !event?.eventType) return
  queue.push({
    itemId: String(event.itemId),
    eventType: event.eventType,
    surface: event.surface || 'home',
    position: Number(event.position) || 0,
    dwellMs: Number(event.dwellMs) || 0,
    meta: event.meta,
  })

  if (IMMEDIATE_EVENTS.has(event.eventType)) flushFeedEvents()
  else if (queue.length >= 20) flushFeedEvents()
  else scheduleFlush()
}

export function trackImpression(itemId, meta = {}) {
  if (!shouldTrackImpression(itemId)) return false
  trackFeedEvent({ ...meta, itemId, eventType: 'impression' })
  return true
}

export function flushFeedEvents({ keepalive = false } = {}) {
  if (!queue.length) return

  const events = queue.splice(0, MAX_BATCH)
  let token = ''
  try {
    token = window.localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    token = ''
  }

  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    fetch(`${API_PREFIX}/events/batch`, {
      method: 'POST',
      headers,
      credentials: 'omit',
      keepalive,
      body: JSON.stringify({ sessionId: getFeedSessionId(), events }),
    }).catch(() => {
      /* analytics must never break the UI */
    })
  } catch {
    /* ignore network / serialisation failures */
  }

  if (queue.length) scheduleFlush()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flushFeedEvents({ keepalive: true }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushFeedEvents({ keepalive: true })
    }
  })
}
