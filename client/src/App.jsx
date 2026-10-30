import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
import api from './config/api'

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
      <Route path="/join/:code" element={<JoinCirclePage />} />
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
