import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, ShieldCheck, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import Avatar from './Avatar'

/**
 * Circle Access Control (GBAC).
 *
 * One policy for the whole Circle instead of one rule per member. Each row is a
 * capability and the lowest Circle role allowed to use it — everyone, staff
 * (admins + moderators) or admin. Every member is measured against the same
 * table, and the answer is enforced in chat, in the Reels editor and at the
 * door of an invite, so the same rule applies everywhere.
 */

const CAPABILITY_LABELS = {
  postMessages: ['Post messages', 'Send text in the Circle chat'],
  sendMedia: ['Send media', 'Photos, video, audio and documents'],
  createItems: ['Create Circle content', 'Reels, Library, Challenges, Events, Opportunities'],
  inviteMembers: ['Invite members', 'Bring new people into the Circle'],
  manageMembers: ['Manage members', 'Approve joins, remove people, assign roles'],
  startDecisions: ['Start decisions', 'Open a brainstorm, Delphi or vote'],
}

const ROLE_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'staff', label: 'Staff only' },
  { value: 'admin', label: 'Admin only' },
]

const ROLE_BADGE = {
  owner: 'bg-wchat/15 text-wchat',
  admin: 'bg-amber-400/15 text-amber-500',
  moderator: 'bg-emerald-500/15 text-emerald-500',
  member: 'bg-zinc-500/15 text-zinc-400',
}

export default function CircleAccessPanel({ chatId, onUserClick }) {
  const [access, setAccess] = useState(null)
  const [saving, setSaving] = useState('')
  const [busyRole, setBusyRole] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/chats/${chatId}/access`)
      setAccess(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load access rules'))
    }
  }, [chatId])

  useEffect(() => {
    void load()
  }, [load])

  const setRule = async (capability, value) => {
    if (!access?.canManage) return
    const previous = access.rules[capability]
    // Optimistic: the policy should feel instant, and roll back if refused.
    setAccess((prev) => ({ ...prev, rules: { ...prev.rules, [capability]: value } }))
    setSaving(capability)
    try {
      const { data } = await api.put(`/chats/${chatId}/access`, {
        rules: { [capability]: value },
      })
      setAccess((prev) => ({ ...prev, rules: data.rules }))
    } catch (error) {
      setAccess((prev) => ({ ...prev, rules: { ...prev.rules, [capability]: previous } }))
      toast.error(getApiError(error, 'Could not update that rule'))
    } finally {
      setSaving('')
    }
  }

  const setRole = async (userId, role) => {
    setBusyRole(userId)
    try {
      await api.put(`/chats/${chatId}/access/${userId}`, { role })
      await load()
      toast.success(role === 'member' ? 'Role removed' : `Now a ${role}`)
    } catch (error) {
      toast.error(getApiError(error, 'Could not change that role'))
    } finally {
      setBusyRole('')
    }
  }

  if (!access) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
        <Loader2 size={16} className="animate-spin" />
        Loading access rules…
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 py-5">
      {!access.canManage && (
        <p className="rounded-xl bg-zinc-800/60 px-3 py-2 text-sm text-zinc-400">
          You can see the rules here. Only a Circle admin can change them.
        </p>
      )}

      {/* Policy ------------------------------------------------------- */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={15} />
          Who can do what
        </h3>
        <p className="mt-1 text-xs text-zinc-400">
          One policy covers every member, everywhere in this Circle.
        </p>

        <ul className="mt-3 space-y-2">
          {access.capabilities.map((capability) => {
            const [label, hint] = CAPABILITY_LABELS[capability] || [capability, '']
            const value = access.rules[capability] || 'everyone'
            const locked = !access.canManage || saving === capability
            return (
              <li
                key={capability}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="truncate text-xs text-zinc-400">{hint}</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-1">
                  {ROLE_OPTIONS.map((option) => {
                    const on = option.value === value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={locked}
                        onClick={() => setRule(capability, option.value)}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed ${
                          on ? 'bg-wchat text-white' : 'text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {on && <Check size={11} />}
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Roles -------------------------------------------------------- */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <UserCog size={15} />
          Members & roles
        </h3>
        <ul className="mt-2 divide-y divide-zinc-800/70">
          {access.members.map((member) => (
            <li
              key={member._id}
              className="flex items-center gap-3 py-2"
            >
              <div
                onClick={onUserClick ? () => onUserClick(member._id) : undefined}
                className={`flex min-w-0 flex-1 items-center gap-3 ${
                  onUserClick ? 'cursor-pointer' : ''
                }`}
              >
                <Avatar
                  src={member.profilePicture}
                  name={`${member.firstName} ${member.lastName}`}
                  size={36}
                  online={member.isOnline}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {member.access === 'admin'
                      ? 'Full access'
                      : member.access === 'staff'
                        ? 'Staff access'
                        : 'Standard access'}
                  </p>
                </div>
              </div>

              {member.role === 'owner' ? (
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${ROLE_BADGE.owner}`}
                >
                  owner
                </span>
              ) : access.canManage ? (
                <select
                  value={member.role}
                  disabled={busyRole === member._id}
                  onChange={(event) => setRole(member._id, event.target.value)}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                >
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    ROLE_BADGE[member.role] || ROLE_BADGE.member
                  }`}
                >
                  {member.role}
                </span>
              )}

              {busyRole === member._id && (
                <Loader2 size={13} className="animate-spin text-zinc-400" />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
