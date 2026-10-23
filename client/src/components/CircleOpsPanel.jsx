import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  Square,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'

/**
 * Circle Operations — group automation & resource management.
 *
 * The Circle is managed as a single unit: Start brings every member up at once,
 * Stop takes everything down, and Restart is the recovery action. Any member
 * that cannot be brought back marks the whole Circle as **broken**, which is
 * shown until a later restart clears it. **Move** hands the Circle to another
 * member so a different system runs it.
 */

const STATE_META = {
  running: {
    label: 'Running',
    Icon: CheckCircle2,
    badge: 'bg-emerald-500/15 text-emerald-500',
  },
  stopped: {
    label: 'Stopped',
    Icon: Square,
    badge: 'bg-zinc-500/15 text-zinc-400',
  },
  broken: {
    label: 'Broken',
    Icon: AlertTriangle,
    badge: 'bg-red-500/15 text-red-500',
  },
}

function formatWhen(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function ResourceRow({ resource, onUserClick }) {
  const up = resource.status === 'up'
  return (
    <li
      onClick={onUserClick ? () => onUserClick(resource._id) : undefined}
      className={`flex items-center gap-3 py-2 ${
        onUserClick ? 'cursor-pointer transition hover:bg-zinc-800/40' : ''
      }`}
    >
      <Avatar
        src={resource.profilePicture}
        name={`${resource.firstName} ${resource.lastName}`}
        size={36}
        online={up}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {resource.firstName} {resource.lastName}
        </p>
        <p className="truncate text-xs text-zinc-400">
          {resource.role !== 'member' ? resource.role : 'member'}
          {resource.lastSeen ? ` · last seen ${formatWhen(resource.lastSeen)}` : ''}
        </p>
      </div>
      {resource.failedRestart && (
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-500">
          failed restart
        </span>
      )}
      <span
        className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${
          up ? 'bg-emerald-500/15 text-emerald-500' : 'bg-zinc-500/15 text-zinc-400'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${up ? 'bg-emerald-500' : 'bg-zinc-500'}`}
        />
        {up ? 'up' : 'down'}
      </span>
    </li>
  )
}

export default function CircleOpsPanel({ chatId, onUserClick }) {
  const { user } = useAuth()
  const [ops, setOps] = useState(null)
  const [busy, setBusy] = useState('')
  const [moving, setMoving] = useState(false)
  const [targetId, setTargetId] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/circles/${chatId}/ops`)
      setOps(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load Circle operations'))
    }
  }, [chatId])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (action, fn, failMessage) => {
    setBusy(action)
    try {
      await fn()
    } catch (error) {
      toast.error(getApiError(error, failMessage))
    } finally {
      setBusy('')
    }
  }

  const run = (action) =>
    act(
      action,
      async () => {
        const { data } = await api.post(`/circles/${chatId}/ops/${action}`)
        setOps((prev) => ({ ...prev, ...data }))
        toast.success(
          data.state === 'broken'
            ? 'Some members could not be restarted — the Circle is broken'
            : `Circle ${action === 'restart' ? 'restarted' : `${action}ed`}`
        )
      },
      'That operation failed'
    )

  const confirmMove = async () => {
    if (!targetId) return
    await act(
      'move',
      async () => {
        const { data } = await api.post(`/circles/${chatId}/ops/move`, {
          userId: targetId,
        })
        setMoving(false)
        setTargetId('')
        toast.success('Circle moved to its new admin')
        void load()
      },
      'Could not move the Circle'
    )
  }

  if (!ops) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
        <Loader2 size={16} className="animate-spin" />
        Loading Circle operations…
      </div>
    )
  }

  const meta = STATE_META[ops.state] || STATE_META.running
  const isAdmin = ops.yourRole === 'owner' || ops.yourRole === 'admin'
  const others = (ops.resources || []).filter(
    (resource) => String(resource._id) !== String(user?._id)
  )

  return (
    <div className="space-y-5 px-4 py-5">
      {/* State summary ------------------------------------------------- */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${meta.badge}`}
          >
            <meta.Icon size={14} />
            {meta.label}
          </span>
          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
            <Activity size={14} />
            {ops.up} up · {ops.down} down of {ops.resources.length} resources
          </div>
        </div>

        {ops.state === 'broken' && (
          <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {ops.failed.length} member(s) could not be restarted. Run{' '}
            <span className="font-medium">Restart</span> again once they are back
            to clear this.
          </p>
        )}

        {isAdmin && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('start')}
              className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-500 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {busy === 'start' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Start all
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('stop')}
              className="flex items-center gap-2 rounded-xl bg-zinc-500/15 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-500/30 disabled:opacity-50"
            >
              {busy === 'stop' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Square size={14} />
              )}
              Stop all
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('restart')}
              className="flex items-center gap-2 rounded-xl bg-wchat/15 px-3 py-2 text-sm font-medium text-wchat transition hover:bg-wchat/25 disabled:opacity-50"
            >
              {busy === 'restart' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              Restart all
            </button>
          </div>
        )}
      </div>

      {/* Resources ----------------------------------------------------- */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users size={15} />
          Resources
        </h3>
        <ul className="mt-2 divide-y divide-zinc-800/70">
          {(ops.resources || []).map((resource) => (
            <ResourceRow
              key={resource._id}
              resource={resource}
              onUserClick={onUserClick}
            />
          ))}
        </ul>
      </section>

      {/* Move ---------------------------------------------------------- */}
      {isAdmin && (
        <section className="rounded-2xl border border-zinc-800 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ArrowRightLeft size={15} />
            Move this Circle
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            Hand the Circle to another member so a different system runs it. The
            new owner takes over and you stay on as a moderator.
          </p>

          {!moving ? (
            <button
              type="button"
              onClick={() => setMoving(true)}
              className="mt-3 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-medium transition hover:bg-zinc-800"
            >
              Choose a new admin
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="">Pick a member…</option>
                {others.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!targetId || !!busy}
                  onClick={confirmMove}
                  className="flex items-center gap-2 rounded-xl bg-wchat px-3 py-2 text-sm font-medium text-white transition hover:bg-wchat-600 disabled:opacity-50"
                >
                  {busy === 'move' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  Move Circle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoving(false)
                    setTargetId('')
                  }}
                  className="rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* History ------------------------------------------------------- */}
      <section>
        <h3 className="text-sm font-semibold">History</h3>
        {ops.history.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Nothing has happened yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {ops.history.slice(0, 12).map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate">
                  <span className="font-medium capitalize">{entry.action}</span>
                  {entry.note ? (
                    <span className="text-zinc-400"> — {entry.note}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatWhen(entry.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
