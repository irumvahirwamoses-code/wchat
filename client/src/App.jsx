import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ChatProvider } from './context/ChatContext'
import { HelmetProvider } from './components/HelmetProvider'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import JoinCirclePage from './pages/JoinCirclePage'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'

function AppRoutes() {
  const { token, user } = useAuth()

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
