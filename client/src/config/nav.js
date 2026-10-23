import { Clapperboard, Home, MessageCircle, Search, User, Users } from 'lucide-react'

/**
 * The five primary sections Wchat is organised around.
 * A single source of truth so the desktop rail and the mobile bottom bar
 * can never drift apart.
 */
export const PRIMARY_NAV = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'create', label: 'Create', icon: null, action: true },
  { id: 'reels', label: 'Reels', icon: Clapperboard },
  { id: 'profile', label: 'Profile', icon: User },
]

/** Extra destinations — always on the desktop rail, reachable on mobile from Home/Explore. */
export const SECONDARY_NAV = [
  { id: 'chat', label: 'Messages', icon: MessageCircle },
  { id: 'communities', label: 'Communities', icon: Users },
]

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV]

export const navLabel = (id) => ALL_NAV.find((n) => n.id === id)?.label || 'Home'
