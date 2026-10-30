import axios from 'axios'
import { API_PREFIX } from '../utils/api'

export const TOKEN_KEY = 'chattingaToken'
export const USER_KEY = 'chattingaUser'

/**
 * Shared axios instance.
 *
 * With `VITE_API_URL` set it talks straight to that API (`https://api…/api`);
 * otherwise it uses the same-origin `/api` path (Vite proxy in development,
 * Express serving the built client in a single-host deployment) and carries
 * the JWT from localStorage.
 *
 * NOTE: we intentionally do NOT set a default `Content-Type`. Setting it to
 * `application/json` makes axios convert `FormData` bodies into JSON (dropping
 * the file), which breaks every upload. Axios sets the correct header itself:
 * `application/json` for objects and `multipart/form-data` (with boundary) for
 * FormData.
 */
const api = axios.create({
  baseURL: API_PREFIX,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ''
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/register')

    // A blocked account is rejected with 403 + `blocked: true`. Sign it out so
    // the person sees the sign-in screen instead of a half-working app.
    if (status === 403 && error?.response?.data?.blocked) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (window.location.pathname !== '/auth') {
        window.location.assign('/auth')
      }
    }

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (window.location.pathname !== '/auth') {
        window.location.assign('/auth')
      }
    }
    return Promise.reject(error)
  }
)

/** Extracts a human readable error message from an axios failure. */
export function getApiError(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

export default api
