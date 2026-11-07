import { useEffect, useRef } from 'react'
import { trackFeedEvent, trackImpression } from '../utils/feedEvents'

/**
 * Attach the returned ref to a feed card.
 *
 * - `impression` fires after the item is at least 50% visible for 500 ms.
 * - `dwell` fires once, when the item leaves the viewport (≥ 1.5 s).
 *
 * Both are best-effort: failures are swallowed inside the event queue.
 */
export default function useImpression(
  itemId,
  { surface = 'home', position = 0 } = {}
) {
  const ref = useRef(null)
  const visibleAt = useRef(0)
  const impressionSent = useRef(false)
  const dwellSent = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element || !itemId) return undefined
    // Older Android WebViews have no IntersectionObserver. Views simply are not
    // tracked there; the feed itself must keep working.
    if (typeof IntersectionObserver === 'undefined') return undefined

    let timer = null

    const flushDwell = () => {
      if (!visibleAt.current) return
      const dwellMs = Date.now() - visibleAt.current
      visibleAt.current = 0
      if (dwellMs >= 1500 && !dwellSent.current) {
        dwellSent.current = true
        trackFeedEvent({
          itemId,
          eventType: 'dwell',
          surface,
          position,
          dwellMs,
        })
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // `intersectionRatio` is relative to the card, which can be taller
          // than a phone viewport (comments included). Accept either half the
          // card or half the viewport being covered.
          const coversHalfViewport =
            entry.intersectionRect.height >= window.innerHeight * 0.5
          const visibleEnough =
            entry.isIntersecting &&
            (entry.intersectionRatio >= 0.5 || coversHalfViewport)

          if (visibleEnough) {
            if (!visibleAt.current) visibleAt.current = Date.now()
            if (!impressionSent.current && !timer) {
              timer = setTimeout(() => {
                timer = null
                impressionSent.current = true
                trackImpression(itemId, { surface, position })
              }, 500)
            }
          } else {
            if (timer) {
              clearTimeout(timer)
              timer = null
            }
            flushDwell()
          }
        }
      },
      { threshold: [0, 0.5, 1] }
    )

    observer.observe(element)

    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
      flushDwell()
    }
  }, [itemId, surface, position])

  return ref
}
