import { useEffect } from 'react'
import { SITE_NAME, siteUrl, ogImageUrl } from '../config/site'

/**
 * Declarative SEO meta tags.
 *
 * Falls back to the browser origin when VITE_SITE_URL is not set at build time,
 * so canonical / Open Graph URLs never render as empty strings in production.
 */
export default function Seo({
  title,
  description,
  path = '/',
  noIndex = false,
  image,
  url,
  type = 'website',
  alternateTitle,
  alternateDescription,
}) {
  const resolvedTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
  const pageDescription = description || `Join ${SITE_NAME}, the mobile-first community network built around Circles.`
  const pageUrl = url || siteUrl(path)
  const pageImage = image || ogImageUrl
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    document.title = resolvedTitle

    const setMeta = (name, value) => {
      if (!value) return
      let el = document.querySelector(`meta[name="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', value)
    }

    const setOg = (property, value) => {
      if (!value) return
      let el = document.querySelector(`meta[property="${property}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('property', property)
        document.head.appendChild(el)
      }
      el.setAttribute('content', value)
    }

    // Fallback: overwrite index.html placeholders when VITE_SITE_URL is missing.
    if (!import.meta.env.VITE_SITE_URL) {
      const ogUrlEl = document.querySelector('meta[property="og:url"]')
      if (ogUrlEl) ogUrlEl.setAttribute('content', fallbackOrigin + pageUrl)
      const ogImgEl = document.querySelector('meta[property="og:image"]')
      if (ogImgEl) ogImgEl.setAttribute('content', fallbackOrigin + pageImage)
      const twImgEl = document.querySelector('meta[name="twitter:image"]')
      if (twImgEl) twImgEl.setAttribute('content', fallbackOrigin + pageImage)
      const canonEl = document.querySelector('link[rel="canonical"]')
      if (canonEl) canonEl.setAttribute('href', fallbackOrigin + pageUrl)
    }

    setMeta('description', pageDescription)
    setMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow')
    setMeta('twitter:title', resolvedTitle)
    setMeta('twitter:description', pageDescription)
    setMeta('twitter:image', pageImage)
    setMeta('twitter:card', 'summary_large_image')

    setOg('og:title', resolvedTitle)
    setOg('og:description', pageDescription)
    setOg('og:type', type)
    setOg('og:url', pageUrl)
    setOg('og:image', pageImage)
    setOg('og:image:alt', resolvedTitle)
    setOg('og:site_name', SITE_NAME)

    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', pageUrl)
  }, [resolvedTitle, pageDescription, noIndex, pageUrl, pageImage, type])

  return null
}
