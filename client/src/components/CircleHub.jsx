import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BookOpen,
  Briefcase,
  Calendar,
  Film,
  Lightbulb,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import Avatar from './Avatar'
import GroupInviteModal from './GroupInviteModal'
import Modal, { ModalHeader } from './Modal'
import { useAuth } from '../context/AuthContext'
import { getFileUrl, getId } from '../utils/api'
import CircleOpsPanel from './CircleOpsPanel'
import CircleAccessPanel from './CircleAccessPanel'
import CircleDecisions from './CircleDecisions'

/**
 * Community Circle sections.
 * Each Wchat Circle is a mini social network, so on top of its Chat it has
 * Reels, a Library, Challenges, Events and Opportunities — all backed by the
 * CircleItem API (create / edit / delete / Spark / join) so nothing here is a
 * dead button.
 */
export const CIRCLE_SECTIONS = [
  {
    id: 'reel',
    label: 'Reels',
    icon: Film,
    title: 'Circle Reels',
    tagline: 'Short videos from the community and its creators.',
    media: 'video',
    mediaLabel: 'Video (mp4, mov…)',
    mediaAccept: 'video/*',
  },
  {
    id: 'library',
    label: 'Library',
    icon: BookOpen,
    title: 'Circle Library',
    tagline: 'Guides, documents, tutorials, and trusted answers.',
    media: 'doc',
    mediaLabel: 'Document (pdf, doc, txt…)',
    mediaAccept:
      '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.json,.zip',
  },
  {
    id: 'challenge',
    label: 'Challenges',
    icon: Trophy,
    title: 'Circle Challenges',
    tagline: 'Competitions, achievements, and collaborative projects.',
    date: 'Deadline',
  },
  {
    id: 'event',
    label: 'Events',
    icon: Calendar,
    title: 'Circle Events',
    tagline: 'Meetings, livestreams, workshops, and reminders.',
    date: 'When',
    location: true,
  },
  {
    id: 'opportunity',
    label: 'Opportunities',
    icon: Briefcase,
    title: 'Circle Opportunities',
    tagline: 'Jobs, scholarships, mentorship, and projects.',
    date: 'Deadline',
    tags: true,
  },

  // --- Group management: automation, access control and decisions -------
  // These are live panels rather than a list of items, so `panel` tells the
  // hub to mount a component instead of loading /circles/:id/items.
  {
    id: 'ops',
    label: 'Ops',
    icon: Activity,
    title: 'Circle Operations',
    tagline: 'Start, stop and restart the Circle as one unit — and move it.',
    panel: 'ops',
  },
  {
    id: 'access',
    label: 'Access',
    icon: ShieldCheck,
    title: 'Circle Access Control',
    tagline: 'One policy for who can post, invite, publish and manage.',
    panel: 'access',
  },
  {
    id: 'decisions',
    label: 'Decisions',
    icon: Lightbulb,
    title: 'Circle Decisions',
    tagline: 'Brainstorm in parallel, rate in rounds, record the outcome.',
    panel: 'decisions',
  },
]

const EMPTY_FORM = {
  title: '',
  description: '',
  link: '',
  date: '',
  location: '',
  tags: '',
}

function formatWhen(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function ItemCard({ item, chatId, isMine, canDelete, onChanged, onUserClick }) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const kind = item.kind
  const sparked = (item.sparks || []).some(
    (id) => getId(id) === getId(item.__viewerId)
  )

  const act = async (fn, failMessage) => {
    setBusy(true)
    try {
      await fn()
    } catch (error) {
      toast.error(getApiError(error, failMessage))
    } finally {
      setBusy(false)
    }
  }

  const toggleSpark = () =>
    act(async () => {
      const { data } = await api.post(`/circles/${chatId}/items/${item._id}/spark`)
      onChanged({
        ...item,
        sparks: data.sparked
          ? [...(item.sparks || []), item.__viewerId]
          : (item.sparks || []).filter((id) => getId(id) !== getId(item.__viewerId)),
        sparkCount: data.sparkCount,
      })
    }, 'Could not save your Spark')

  const toggleJoin = () =>
    act(async () => {
      const { data } = await api.post(`/circles/${chatId}/items/${item._id}/join`)
      onChanged({
        ...item,
        participants: data.participating
          ? [...(item.participants || []), item.__viewerId]
          : (item.participants || []).filter(
              (id) => getId(id) !== getId(item.__viewerId)
            ),
      })
    }, 'Could not update your place')

  const remove = () =>
    act(async () => {
      await api.delete(`/circles/${chatId}/items/${item._id}`)
      onChanged(null, item._id)
    }, 'Could not delete this post')

  const author = item.author || {}
  const authorName =
    `${author.firstName || ''} ${author.lastName || ''}`.trim() ||
    author.username ||
    'Member'

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onUserClick?.(author)}
          className="shrink-0"
          title={authorName}
        >
          <Avatar src={author.profilePicture} name={authorName} size={38} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {item.title}
          </p>
          <p className="text-[11px] text-zinc-500">
            {authorName} · {new Date(item.createdAt).toLocaleDateString()}
          </p>
        </div>
        {canDelete || isMine ? (
          confirming ? (
            <div className="flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1">
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="text-[11px] font-semibold text-red-300"
              >
                {busy ? '…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-zinc-400"
                aria-label="Cancel"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-300"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          )
        ) : null}
      </header>

      {item.description ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
          {item.description}
        </p>
      ) : null}

      {kind === 'reel' && item.media ? (
        <video
          controls
          preload="metadata"
          src={getFileUrl(item.media)}
          className="max-h-80 w-full rounded-xl bg-black"
        />
      ) : null}

      {kind === 'library' && item.media ? (
        <a
          href={getFileUrl(item.media)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-200 transition hover:border-amber-400/50"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 text-amber-300">
            <BookOpen size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate">
            {item.media.split('/').pop()}
          </span>
          <span className="text-[11px] uppercase text-zinc-500">Open</span>
        </a>
      ) : null}

      {item.date || item.location ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
          {item.date ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={13} className="text-amber-400" />
              {formatWhen(item.date)}
            </span>
          ) : null}
          {item.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={13} className="text-amber-400" />
              {item.location}
            </span>
          ) : null}
        </div>
      ) : null}

      {item.tags?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {item.link ? (
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs font-medium text-amber-300 hover:underline"
        >
          {item.link}
        </a>
      ) : null}

      <footer className="mt-auto flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={toggleSpark}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
            sparked
              ? 'border-amber-400 bg-amber-400/15 text-amber-300'
              : 'border-zinc-700 text-zinc-400 hover:border-amber-400/50 hover:text-amber-300'
          }`}
        >
          <Sparkles size={14} />
          {item.sparkCount ?? (item.sparks || []).length}
        </button>

        {kind === 'challenge' || kind === 'event' ? (
          <button
            type="button"
            onClick={toggleJoin}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
              (item.participants || []).some(
                (id) => getId(id) === getId(item.__viewerId)
              )
                ? 'border-amber-400 bg-amber-400 px-3 text-white'
                : 'border-zinc-700 text-zinc-400 hover:border-amber-400/50 hover:text-amber-300'
            }`}
          >
            <Users size={14} />
            {(item.participants || []).length}{' '}
            {(item.participants || []).some(
              (id) => getId(id) === getId(item.__viewerId)
            )
              ? '· Joined'
              : '· Join'}
          </button>
        ) : null}
      </footer>
    </article>
  )
}

function CreateForm({ section, chatId, onDone }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) {
      toast.error('A title is required')
      return
    }
    setBusy(true)
    try {
      const payload = new FormData()
      payload.append('kind', section.id)
      payload.append('title', form.title.trim())
      payload.append('description', form.description.trim())
      payload.append('link', form.link.trim())
      if (form.date) payload.append('date', new Date(form.date).toISOString())
      payload.append('location', form.location.trim())
      payload.append('tags', form.tags)
      if (file) payload.append('media', file)

      const { data } = await api.post(`/circles/${chatId}/items`, payload)
      toast.success(`${section.label} published`)
      onDone(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not publish'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="animate-scale-in space-y-3 rounded-2xl border border-amber-400/30 bg-zinc-950/70 p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          New {section.label.replace(/s$/, '')}
        </p>
        <button
          type="button"
          onClick={() => onDone(null)}
          className="text-zinc-500 hover:text-zinc-200"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      <input
        autoFocus
        value={form.title}
        onChange={set('title')}
        maxLength={160}
        placeholder="Title"
        className={fieldClass}
      />

      <textarea
        value={form.description}
        onChange={set('description')}
        rows={3}
        maxLength={2000}
        placeholder={
          section.id === 'library'
            ? 'What is this guide about?'
            : 'Add details…'
        }
        className={`${fieldClass} resize-none`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {section.date ? (
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">
              {section.date}
            </span>
            <input
              type="datetime-local"
              value={form.date}
              onChange={set('date')}
              className={fieldClass}
            />
          </label>
        ) : null}

        {section.location ? (
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">Where</span>
            <input
              value={form.location}
              onChange={set('location')}
              placeholder="Venue or link"
              className={fieldClass}
            />
          </label>
        ) : null}

        {section.tags ? (
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">
              Tags (comma separated)
            </span>
            <input
              value={form.tags}
              onChange={set('tags')}
              placeholder="job, remote, internship"
              className={fieldClass}
            />
          </label>
        ) : null}

        {section.media ? (
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">
              {section.mediaLabel}
            </span>
            <input
              type="file"
              accept={section.mediaAccept}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-zinc-200"
            />
          </label>
        ) : null}
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] text-zinc-500">
          Link (optional)
        </span>
        <input
          value={form.link}
          onChange={set('link')}
          placeholder="https://…"
          className={fieldClass}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onDone(null)}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-300 disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Publish
        </button>
      </div>
    </form>
  )
}

export default function CircleHub({ chat, onClose, onOpenProfile }) {
  const { user } = useAuth()
  const [active, setActive] = useState('reel')
  const [items, setItems] = useState({})
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const section = useMemo(
    () => CIRCLE_SECTIONS.find((s) => s.id === active) || CIRCLE_SECTIONS[0],
    [active]
  )
  const SectionIcon = section.icon
  const chatId = chat?._id
  const isAdmin =
    getId(chat?.groupAdmin) === getId(user?._id) ||
    (chat?.admins || []).some((id) => getId(id) === getId(user?._id))

  const load = useCallback(async () => {
    if (!chatId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/circles/${chatId}/items`, {
        params: { kind: active },
      })
      const list = (Array.isArray(data) ? data : []).map((item) => ({
        ...item,
        __viewerId: user?._id,
      }))
      setItems((prev) => ({ ...prev, [active]: list }))
    } catch (error) {
      toast.error(getApiError(error, 'Could not load this section'))
    } finally {
      setLoading(false)
    }
  }, [chatId, active, user?._id])

  useEffect(() => {
    if (section.panel) return // live panels fetch their own data
    if (items[active]) return // cached: only load a section once
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, chatId, section.panel])

  // The "New" form belongs to the item sections only — never leave it open
  // across a switch into a management panel.
  useEffect(() => {
    setCreating(false)
  }, [active])

  const handleChanged = (next, removedId) => {
    if (removedId) {
      setItems((prev) => ({
        ...prev,
        [active]: (prev[active] || []).filter((i) => i._id !== removedId),
      }))
      return
    }
    setItems((prev) => ({
      ...prev,
      [active]: (prev[active] || []).map((i) => (i._id === next._id ? next : i)),
    }))
  }

  return (
    <Modal onClose={onClose} size="max-w-3xl">
      <ModalHeader
        icon={<SectionIcon size={20} />}
        title={chat?.chatName || 'Circle'}
        subtitle="Community Circle · chat, reels, library, challenges, events, opportunities, ops, access, decisions"
        onClose={onClose}
      />

      <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-4 pt-2">
        {CIRCLE_SECTIONS.map((entry) => {
          const Icon = entry.icon
          const on = entry.id === active
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setActive(entry.id)
                setCreating(false)
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                on
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Icon size={14} />
              {entry.label}
            </button>
          )
        })}
      </nav>

      {section.panel ? (
        <div className="space-y-4">
          <div className="px-5 pt-5">
            <h3 className="text-base font-bold text-zinc-100">{section.title}</h3>
            <p className="text-xs text-zinc-500">{section.tagline}</p>
          </div>
          {section.panel === 'ops' ? (
            <CircleOpsPanel chatId={chatId} onUserClick={onOpenProfile} />
          ) : section.panel === 'access' ? (
            <CircleAccessPanel chatId={chatId} onUserClick={onOpenProfile} />
          ) : (
            <CircleDecisions chatId={chatId} onUserClick={onOpenProfile} />
          )}
        </div>
      ) : (
      <div className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-zinc-100">{section.title}</h3>
            <p className="text-xs text-zinc-500">{section.tagline}</p>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <UserPlus size={14} />
            Invite
          </button>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-300"
          >
            <Plus size={14} />
            New
          </button>
        </div>

        {creating ? (
          <CreateForm
            section={section}
            chatId={chatId}
            onDone={(created) => {
              setCreating(false)
              if (created) {
                setItems((prev) => ({
                  ...prev,
                  [active]: [
                    { ...created, __viewerId: user?._id },
                    ...(prev[active] || []),
                  ],
                }))
              }
            }}
          />
        ) : null}

        {inviteOpen ? (
          <GroupInviteModal
            chat={chat}
            onClose={() => setInviteOpen(false)}
          />
        ) : null}

        {loading && !items[active]?.length ? (
          <div className="flex flex-col items-center gap-3 py-14 text-zinc-500">
            <div className="spinner" />
            <p className="text-sm">Loading…</p>
          </div>
        ) : !items[active]?.length ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <SectionIcon size={30} className="text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">
              Nothing here yet
            </p>
            <p className="max-w-xs text-xs text-zinc-600">
              {section.tagline} Be the first to add one to this Circle.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items[active].map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                chatId={chatId}
                isMine={getId(item.author) === getId(user?._id)}
                canDelete={isAdmin}
                onChanged={handleChanged}
                onUserClick={onOpenProfile}
              />
            ))}
          </div>
        )}
      </div>
      )}
    </Modal>
  )
}

const fieldClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/60'
