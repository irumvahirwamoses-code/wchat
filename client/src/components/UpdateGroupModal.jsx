import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Crown,
  Loader2,
  LogOut,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { getId } from '../utils/api'
import { formatHandle } from '../utils/handle'
import Avatar from './Avatar'
import Modal, { ModalHeader } from './Modal'

export default function UpdateGroupModal({ onClose, onOpenProfile }) {
  const { user } = useAuth()
  const {
    selectedChat,
    fetchChats,
    patchSelectedChat,
    leaveChatLocally,
    joinRequests,
    fetchJoinRequests,
  } = useChat()

  const chat = selectedChat

  const [chatName, setChatName] = useState(chat?.chatName || '')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    fetchJoinRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?._id])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      return undefined
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/users', { params: { search: term } })
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const isAdmin = useMemo(() => {
    if (!chat) return false
    const adminId = getId(chat.groupAdmin)
    if (adminId) return adminId === user?._id
    return (chat.users || []).some(
      (member) => getId(member) === user?._id && member?.isAdmin
    )
  }, [chat, user?._id])

  const memberIds = useMemo(
    () => new Set((chat?.users || []).map((m) => getId(m))),
    [chat]
  )

  const pendingRequests = useMemo(
    () =>
      joinRequests.filter(
        (request) =>
          getId(request.chat) === chat?._id && request.status === 'pending'
      ),
    [joinRequests, chat?._id]
  )

  if (!chat) return null

  const renameGroup = async () => {
    const value = chatName.trim()
    if (value.length < 2) {
      toast.error('Group name must be at least 2 characters')
      return
    }
    setBusy('rename')
    try {
      await api.put('/chats/group/rename', { chatId: chat._id, chatName: value })
      patchSelectedChat({ chatName: value })
      await fetchChats()
      toast.success('Group renamed')
    } catch (error) {
      toast.error(getApiError(error, 'Could not rename the group'))
    } finally {
      setBusy(null)
    }
  }

  const addMember = async (target) => {
    setBusy(`add-${target._id}`)
    try {
      await api.post('/chats/group/add', { chatId: chat._id, userId: target._id })
      const nextUsers = [...(chat.users || []), target]
      patchSelectedChat({ users: nextUsers })
      await fetchChats()
      setSearch('')
      setResults([])
      toast.success(`${target.firstName || 'Member'} added`)
    } catch (error) {
      toast.error(getApiError(error, 'Could not add that member'))
    } finally {
      setBusy(null)
    }
  }

  const resolveRequest = async (requestId, status) => {
    setBusy(`req-${requestId}`)
    try {
      await api.put(`/chats/join-requests/${requestId}`, { status })
      toast.success(status === 'accepted' ? 'Request accepted' : 'Request rejected')
      await Promise.all([fetchJoinRequests(), fetchChats()])
    } catch (error) {
      toast.error(getApiError(error, 'Could not update that request'))
    } finally {
      setBusy(null)
    }
  }

  const leaveGroup = async () => {
    if (!window.confirm('Leave this group? You will stop receiving its messages.')) {
      return
    }
    setBusy('leave')
    try {
      await api.put('/chats/group/leave', { chatId: chat._id })
      leaveChatLocally(chat._id)
      toast.success('You left the group')
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not leave the group'))
    } finally {
      setBusy(null)
    }
  }

  const deleteGroup = async () => {
    if (!window.confirm('Delete this group for everyone? This cannot be undone.')) {
      return
    }
    setBusy('delete')
    try {
      await api.delete(`/chats/group/${chat._id}`)
      leaveChatLocally(chat._id)
      toast.success('Group deleted')
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not delete the group'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal onClose={onClose} size="max-w-xl">
      <ModalHeader
        icon={<Users size={20} />}
        title="Group info"
        subtitle={isAdmin ? 'You are an admin' : 'Group details'}
        onClose={onClose}
      />

      <div className="space-y-5 px-5 py-5">
        <div className="flex items-center gap-4">
          <Avatar src={chat.groupAvatar} name={chat.chatName} size={64} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-zinc-100">
              {chat.chatName}
            </p>
            <p className="text-xs text-zinc-500">
              {(chat.users || []).length} members
              {chat.category ? ` · ${chat.category}` : ''}
            </p>
            {chat.features?.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {chat.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {isAdmin ? (
          <section>
            <SectionTitle icon={<Pencil size={14} />} title="Rename group" />
            <div className="flex gap-2">
              <input
                value={chatName}
                onChange={(event) => setChatName(event.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={renameGroup}
                disabled={busy === 'rename'}
                className="shrink-0 rounded-lg bg-amber-400 px-4 text-sm font-semibold text-white transition hover:bg-amber-300 disabled:opacity-60"
              >
                {busy === 'rename' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section>
            <SectionTitle icon={<UserPlus size={14} />} title="Add member" />
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search people to add"
                className={`${inputClass} pl-9`}
              />
            </div>
            {results.length ? (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-zinc-800">
                {results
                  .filter((result) => !memberIds.has(getId(result)))
                  .map((result) => (
                    <button
                      key={result._id}
                      type="button"
                      onClick={() => addMember(result)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-zinc-800/60"
                    >
                      <Avatar
                        src={result.profilePicture}
                        name={`${result.firstName || ''} ${result.lastName || ''}`}
                        size={34}
                      />
                      <span className="min-w-0 flex-1 text-sm text-zinc-100">
                        {`${result.firstName || ''} ${result.lastName || ''}`.trim()}
                      </span>
                      {busy === `add-${result._id}` ? (
                        <Loader2 size={15} className="animate-spin text-amber-400" />
                      ) : (
                        <UserPlus size={15} className="text-zinc-500" />
                      )}
                    </button>
                  ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {isAdmin ? (
          <section>
            <SectionTitle
              icon={<ShieldCheck size={14} />}
              title={`Join requests${pendingRequests.length ? ` (${pendingRequests.length})` : ''}`}
            />
            {pendingRequests.length === 0 ? (
              <p className="text-xs text-zinc-600">No pending join requests.</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <div
                    key={request._id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5"
                  >
                    <Avatar
                      src={request.user?.profilePicture}
                      name={`${request.user?.firstName || ''} ${request.user?.lastName || ''}`}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-100">
                        {`${request.user?.firstName || ''} ${request.user?.lastName || ''}`.trim()}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {formatHandle(request.user?.username)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => resolveRequest(request._id, 'accepted')}
                      disabled={busy === `req-${request._id}`}
                      className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50"
                      title="Accept"
                    >
                      {busy === `req-${request._id}` ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveRequest(request._id, 'rejected')}
                      disabled={busy === `req-${request._id}`}
                      className="rounded-lg bg-red-500/15 p-1.5 text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
                      title="Reject"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section>
          <SectionTitle icon={<Users size={14} />} title="Members" />
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {(chat.users || []).map((member) => {
              const id = getId(member)
              const admin = id === getId(chat.groupAdmin) || member?.isAdmin
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    id !== user?._id && onOpenProfile?.(member)
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-800/60"
                >
                  <Avatar
                    src={member.profilePicture}
                    name={`${member.firstName || ''} ${member.lastName || ''}`}
                    size={36}
                    online={member.isOnline}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">
                      {`${member.firstName || ''} ${member.lastName || ''}`.trim()}
                      {id === user?._id ? ' (you)' : ''}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {formatHandle(member.username)}
                    </span>
                  </span>
                  {admin ? <Crown size={14} className="text-amber-400" /> : null}
                </button>
              )
            })}
          </div>
        </section>

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={leaveGroup}
            disabled={busy === 'leave'}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === 'leave' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogOut size={16} />
            )}
            Leave group
          </button>

          {isAdmin ? (
            <button
              type="button"
              onClick={deleteGroup}
              disabled={busy === 'delete'}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/25 disabled:opacity-60"
            >
              {busy === 'delete' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              Delete group
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

function SectionTitle({ icon, title }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
      <span className="text-amber-400">{icon}</span>
      {title}
    </h3>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/60'
