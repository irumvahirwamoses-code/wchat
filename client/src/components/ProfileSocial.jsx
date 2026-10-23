import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserCheck, UserPlus, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { getId } from '../utils/api'
import { formatHandle } from '../utils/handle'
import Avatar from './Avatar'
import Modal, { ModalHeader } from './Modal'

/**
 * The people a profile is connected to, in Wchat's language:
 *   • Joins     — everyone who joined this person's Circle (followers).
 *   • Following — the people this account has joined.
 *
 * Each row can be joined/left in place, and tapping a person opens their
 * profile. Counts come from real follow data on the server.
 */
export default function ProfileSocial({
  userId,
  initialTab = 'followers',
  onOpenProfile,
  onClose,
}) {
  const { user, updateUser } = useAuth()
  const [tab, setTab] = useState(initialTab)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data: social } = await api.get(`/users/${userId}/social`)
      setData(social)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load connections'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const isMe = (person) => getId(person) === getId(user)
  const hasJoined = (person) =>
    (user?.following || []).some((id) => getId(id) === getId(person))

  const follow = async (person) => {
    const id = getId(person)
    if (!id || isMe(person)) return
    setBusyId(id)
    try {
      const { data: result } = await api.post(`/users/${id}/follow`)
      const nowFollowing = Array.isArray(result?.following)
        ? result.following.map(getId).includes(id)
        : Boolean(result?.following)

      // Keep the signed-in user's cached graph fresh so every surface agrees.
      if (user) {
        const next = new Set((user.following || []).map(getId))
        if (nowFollowing) next.add(id)
        else next.delete(id)
        updateUser({ ...user, following: [...next] })
      }

      toast.success(nowFollowing ? 'Joined' : 'Left')
    } catch (error) {
      toast.error(getApiError(error, 'Could not update'))
    } finally {
      setBusyId('')
    }
  }

  const list = tab === 'followers' ? data?.followers || [] : data?.following || []
  const followersCount = data?.followersCount ?? 0
  const followingCount = data?.followingCount ?? 0

  const personName = (person) =>
    `${person?.firstName || ''} ${person?.lastName || ''}`.trim() ||
    person?.username ||
    'Member'

  return (
    <Modal onClose={onClose} size="max-w-md">
      <ModalHeader
        icon={<Users size={18} />}
        title="Connections"
        subtitle="Joins and the people they follow"
        onClose={onClose}
      />

      <div className="flex border-b border-zinc-800">
        {[
          { id: 'followers', label: 'Joins', count: followersCount },
          { id: 'following', label: 'Following', count: followingCount },
        ].map((option) => {
          const on = tab === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition ${
                on ? 'border-b-2 border-wchat text-wchat' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {option.label}
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                {option.count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-wchat" size={18} />
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Users size={24} className="text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {tab === 'followers'
              ? 'No joins yet'
              : 'Not following anyone yet'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800/70">
          {list.map((person) => {
            const id = getId(person)
            const me = isMe(person)
            const joined = !me && hasJoined(person)
            return (
              <li key={id} className="flex items-center gap-3 px-5 py-3">
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(person)}
                  className="shrink-0"
                  title={personName(person)}
                >
                  <Avatar
                    src={person.profilePicture}
                    name={personName(person)}
                    size={40}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(person)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold text-zinc-100">
                    {personName(person)}
                  </span>
                  <span className="block truncate text-xs text-wchat">
                    {formatHandle(person.username)}
                  </span>
                </button>

                {me ? (
                  <span className="text-[11px] font-semibold text-zinc-500">You</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => follow(person)}
                    disabled={busyId === id}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                      joined
                        ? 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                        : 'bg-amber-400 text-zinc-900 hover:brightness-105'
                    }`}
                  >
                    {busyId === id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : joined ? (
                      <UserCheck size={13} />
                    ) : (
                      <UserPlus size={13} />
                    )}
                    {joined ? 'Joined' : 'Join'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
