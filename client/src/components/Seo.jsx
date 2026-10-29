import { useEffect } from 'react'
import { SITE_NAME, siteUrl, ogImageUrl } from '../config/site'

export default function Seo({
  title,
  description,
  path = '/',
  noIndex = false,
  image,
  url,
  type = 'website',
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
  const pageDescription = description || `Join ${SITE_NAME}, the mobile-first community network built around Circles.`
  const pageUrl = url || siteUrl(path)
  const pageImage = image || ogImageUrl

  useEffect(() => {
    document.title = fullTitle

    const setMeta = (name, value) => {
      let el = document.querySelector(`meta[name="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', value)
    }

    const setOg = (property, value) => {
      let el = document.querySelector(`meta[property="${property}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('property', property)
        document.head.appendChild(el)
      }
      el.setAttribute('content', value)
    }

    setMeta('description', pageDescription)
    setMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', pageDescription)
    setMeta('twitter:image', pageImage)

    setOg('og:title', fullTitle)
    setOg('og:description', pageDescription)
    setOg('og:type', type)
    setOg('og:url', pageUrl)
    setOg('og:image', pageImage)
    setOg('og:image:alt', fullTitle)
    setOg('og:site_name', SITE_NAME)

    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', pageUrl)
  }, [fullTitle, pageDescription, noIndex, pageUrl, pageImage, type])

  return null
}
