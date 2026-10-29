export const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/+$/, '')
export const SITE_NAME = 'Wchat'

export const siteUrl = (path = '/') => `${SITE_URL}${path}`
export const ogImageUrl = `${SITE_URL}/og-image.png`
