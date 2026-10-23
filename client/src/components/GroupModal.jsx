import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Search, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { getId } from '../utils/api'
import { formatHandle } from '../utils/handle'
import Avatar from './Avatar'
import Modal, { ModalHeader } from './Modal'
import UserBadgeItem from './UserBadgeItem'

export default function GroupModal({ onClose }) {
  const { user } = useAuth()
  const { chats, fetchChats, selectChat } = useChat()

  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [remoteResults, setRemoteResults] = useState([])
  const [category, setCategory] = useState('')
  const [features, setFeatures] = useState([])
  const [options, setOptions] = useState({ categories: [], features: [] })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api
      .get('/options')
      .then(({ data }) =>
        setOptions({
          categories: Array.isArray(data?.categories) ? data.categories : [],
          features: Array.isArray(data?.features) ? data.features : [],
        })
      )
      .catch(() => {
        /* options are non-critical */
      })
  }, [])

  // People already in my chats act as my contact list.
  const contacts = useMemo(() => {
    const map = new Map()
    chats.forEach((chat) => {
      ;(chat.users || []).forEach((member) => {
        const id = getId(member)
        if (!id || id === user?._id) return
        map.set(id, typeof member === 'object' ? member : { _id: id })
      })
    })
    return [...map.values()]
  }, [chats, user?._id])

  // Optionally search the wider user directory.
  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setRemoteResults([])
      return undefined
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/users', { params: { search: term } })
        setRemoteResults(Array.isArray(data) ? data : [])
      } catch {
        setRemoteResults([])
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const selectedIds = useMemo(() => selected.map((s) => s._id), [selected])

  const candidates = useMemo(() => {
    const map = new Map()
    contacts.forEach((contact) => {
      const id = getId(contact)
      if (id && id !== user?._id) map.set(id, contact)
    })
    remoteResults.forEach((result) => {
      const id = getId(result)
      if (id && id !== user?._id) map.set(id, result)
    })
    const term = search.trim().toLowerCase()
    return [...map.values()].filter((candidate) => {
      const id = getId(candidate)
      if (selectedIds.includes(id)) return false
      if (!term) return true
      return `${candidate.firstName || ''} ${candidate.lastName || ''} ${
        candidate.username || ''
      }`
        .toLowerCase()
        .includes(term)
    })
  }, [contacts, remoteResults, search, selectedIds, user?._id])

  const toggleFeature = (feature) => {
    setFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    )
  }

  const handleCreate = async () => {
    if (name.trim().length < 2) {
      toast.error('Give your group a name (at least 2 characters)')
      return
    }
    if (selected.length < 1) {
      toast.error('Select at least one member for the group')
      return
    }
    setCreating(true)
    try {
      const { data } = await api.post('/chats/group', {
        chatName: name.trim(),
        users: selected.map((s) => s._id),
        category,
        features,
        groupAvatar: avatar.trim() || undefined,
      })
      await fetchChats()
      selectChat(data)
      toast.success('Group created')
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not create the group'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal onClose={onClose} size="max-w-xl">
      <ModalHeader
        icon={<Users size={20} />}
        title="Create a group"
        subtitle="Add a name, members and a few tags"
        onClose={onClose}
      />

      <div className="space-y-4 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Group name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Weekend Football"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Avatar URL
            </span>
            <input
              value={avatar}
              onChange={(event) => setAvatar(event.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={inputClass}
            >
              <option value="">No category</option>
              {options.categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Features
            </span>
            <div className="flex flex-wrap gap-2">
              {options.features.length === 0 ? (
                <span className="text-xs text-zinc-600">No features available</span>
              ) : (
                options.features.map((feature) => {
                  const active = features.includes(feature)
                  return (
                    <button
                      key={feature}
                      type="button"
                      onClick={() => toggleFeature(feature)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        active
                          ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      }`}
                    >
                      {active ? `${feature} ✓` : feature}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Members {selected.length ? `(${selected.length})` : ''}
          </span>
          {selected.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {selected.map((member) => (
                <UserBadgeItem
                  key={member._id}
                  user={member}
                  onRemove={(target) =>
                    setSelected((prev) => prev.filter((m) => m._id !== target._id))
                  }
                />
              ))}
            </div>
          ) : null}

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

          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-zinc-800">
            {candidates.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">
                {search.trim()
                  ? 'No matches found'
                  : 'Search for people to add to your group'}
              </p>
            ) : (
              candidates.map((candidate) => {
                const id = getId(candidate)
                const already = selectedIds.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        already
                          ? prev.filter((m) => m._id !== id)
                          : [...prev, candidate]
                      )
                    }
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-zinc-800/60"
                  >
                    <Avatar
                      src={candidate.profilePicture}
                      name={`${candidate.firstName || ''} ${candidate.lastName || ''}`}
                      size={38}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-100">
                        {`${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {formatHandle(candidate.username)}
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        already
                          ? 'border-amber-400 bg-amber-400 text-white'
                          : 'border-zinc-600 text-transparent'
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-300 disabled:opacity-60"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
          Create group
        </button>
      </div>
    </Modal>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/60'
