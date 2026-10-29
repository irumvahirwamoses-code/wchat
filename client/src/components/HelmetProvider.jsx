import { Children } from 'react'

/**
 * Pass-through provider kept so existing imports keep working.
 * SEO tags are now managed directly by the Seo component via the DOM.
 */
export const HelmetProvider = ({ children }) => Children.only(children)

export default HelmetProvider
