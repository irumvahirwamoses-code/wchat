import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import toast from 'react-hot-toast'
import api, { getApiError, TOKEN_KEY, USER_KEY } from '../config/api'
import { applyTheme } from '../utils/theme'
import { setHiddenWords } from '../utils/contentFilter'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(false)

  const persist = useCallback((nextToken, nextUser) => {
    if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken)
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    // Apply the account's saved system theme (falls back to the local choice).
    if (nextUser?.preferences?.theme) applyTheme(nextUser.preferences.theme)
    setToken(nextToken ?? null)
    setUser(nextUser ?? null)
  }, [])

  const login = useCallback(
    async (identifier, password) => {
      setLoading(true)
      try {
        const { data } = await api.post('/auth/login', { identifier, password })
        persist(data.token, data.user)
        toast.success(`Welcome back, ${data.user?.firstName || 'friend'}!`)
        return data.user
      } catch (error) {
        toast.error(getApiError(error, 'Unable to sign in'))
        throw error
      } finally {
        setLoading(false)
      }
    },
    [persist]
  )

  /**
   * Step 1 of registration: validate the details and request a verification
   * code on the chosen channel (email or SMS). The account is not created yet.
   */
  const requestRegistration = useCallback(async (payload) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', payload)
      return data
    } catch (error) {
      toast.error(getApiError(error, 'Unable to start registration'))
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  /** Resend the pending verification code. */
  const resendVerification = useCallback(async (identifier) => {
    try {
      const { data } = await api.post('/auth/register/resend', { identifier })
      return data
    } catch (error) {
      toast.error(getApiError(error, 'Unable to resend the code'))
      throw error
    }
  }, [])

  /** Step 2: confirm the code; on success the account is created and signed in. */
  const verifyRegistration = useCallback(
    async ({ identifier, code }) => {
      setLoading(true)
      try {
        const { data } = await api.post('/auth/register/verify', { identifier, code })
        persist(data.token, data.user)
        toast.success(`Welcome to Wchat, ${data.user?.firstName || 'friend'}!`)
        return data.user
      } catch (error) {
        toast.error(getApiError(error, 'Unable to verify your code'))
        throw error
      } finally {
        setLoading(false)
      }
    },
    [persist]
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((nextUser) => {
    if (!nextUser) return
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setUser(nextUser)
  }, [])

  // Refresh the cached profile once on mount so it stays current.
  useEffect(() => {
    let active = true
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (!storedToken) return undefined
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (!active) return
        const fresh = data?.user || data
        if (fresh && fresh._id) {
          updateUser(fresh)
          // Mirror the member's hidden words so feeds and chats can filter them.
          if (Array.isArray(fresh.preferences?.hiddenWords)) {
            setHiddenWords(fresh.preferences.hiddenWords)
          }
        }
      })
      .catch(() => {
        /* interceptor already handles 401 */
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      requestRegistration,
      resendVerification,
      verifyRegistration,
      logout,
      updateUser,
      isAuthenticated: Boolean(token),
    }),
    [
      user,
      token,
      loading,
      login,
      requestRegistration,
      resendVerification,
      verifyRegistration,
      logout,
      updateUser,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
