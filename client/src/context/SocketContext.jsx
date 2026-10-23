import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../utils/api'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useSocket must be used inside <SocketProvider>')
  return context
}

export function SocketProvider({ children }) {
  const { token, user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token || !user?._id) {
      setSocket(null)
      setConnected(false)
      return undefined
    }

    const instance = io(API_BASE_URL || undefined, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    })

    const handleConnect = () => {
      setConnected(true)
      instance.emit('setup', user._id)
    }
    const handleDisconnect = () => setConnected(false)
    const handleOnlineUsers = (ids) => setOnlineUsers(Array.isArray(ids) ? ids : [])

    instance.on('connect', handleConnect)
    instance.on('disconnect', handleDisconnect)
    instance.on('connect_error', handleDisconnect)
    instance.on('online users', handleOnlineUsers)

    setSocket(instance)

    return () => {
      instance.off('connect', handleConnect)
      instance.off('disconnect', handleDisconnect)
      instance.off('connect_error', handleDisconnect)
      instance.off('online users', handleOnlineUsers)
      instance.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [token, user?._id])

  const value = useMemo(
    () => ({ socket, onlineUsers, connected }),
    [socket, onlineUsers, connected]
  )

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  )
}
