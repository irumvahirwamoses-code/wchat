import { Helmet } from 'react-helmet-async'
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

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={pageDescription} />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={pageUrl} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={pageImage} />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImage} />
    </Helmet>
  )
}
