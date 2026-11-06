import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ChatProvider } from './context/ChatContext'
import { HelmetProvider } from './components/HelmetProvider'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import JoinCirclePage from './pages/JoinCirclePage'
import LandingPage from './pages/LandingPage'
import MaintenancePage from './pages/MaintenancePage'
import OnboardingPage from './pages/OnboardingPage'
import ProfilePage from './pages/ProfilePage'
import FeedbackResultsPage from './components/FeedbackResultsPage'
import api from './config/api'

function AuthAlias({ mode }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('mode', mode)
  return <Navigate to={`/auth?${params.toString()}`} replace />
}

function AppRoutes() {
  const { token, user, isSuperAdmin } = useAuth()
  const [system, setSystem] = useState(null)

  // Poll the public status so a maintenance switch takes effect quickly.
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data } = await api.get('/system/status')
        if (active) setSystem(data)
      } catch {
        /* status endpoint is best-effort */
      }
    }
    load()
    const timer = setInterval(load, 60000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  // Super admins keep access so they can flip the switch back off.
  if (system?.maintenanceEnabled && !isSuperAdmin) {
    return (
      <MaintenancePage
        message={system.maintenanceMessage}
        until={system.maintenanceUntil}
      />
    )
  }

  // A signed-in user must finish onboarding (fields + Circles) before the feed.
  const needsOnboarding = Boolean(token) && Boolean(user) && !user?.onboarding?.completedAt

  return (
    <Routes>
      <Route
        path="/auth"
        element={token ? <Navigate to="/" replace /> : <AuthPage />}
      />
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <AuthAlias mode="login" />} />
      <Route path="/register" element={token ? <Navigate to="/" replace /> : <AuthAlias mode="register" />} />
      <Route path="/forgot-password" element={token ? <Navigate to="/" replace /> : <Navigate to="/auth?mode=login&view=forgot" replace />} />
      <Route path="/reset-password" element={token ? <Navigate to="/" replace /> : <Navigate to="/auth?mode=login&view=reset" replace />} />
      <Route
        path="/onboarding"
        element={
          !token ? (
            <Navigate to="/auth" replace />
          ) : needsOnboarding ? (
            <OnboardingPage />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/"
        element={
          !token ? (
            <LandingPage />
          ) : needsOnboarding ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <ChatPage />
          )
        }
      />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/chats" element={<Navigate to="/" replace />} />
      <Route path="/join/:code" element={<JoinCirclePage />} />
      <Route
        path="/user/:userId"
        element={
          !token ? (
            <Navigate to="/auth" replace />
          ) : needsOnboarding ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <ProfilePage />
          )
        }
      />
      <Route path="/feedback" element={<FeedbackResultsPage onClose={() => {}} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <SocketProvider>
          <ChatProvider>
            <AppRoutes />
          </ChatProvider>
        </SocketProvider>
      </AuthProvider>
    </HelmetProvider>
  )
}
