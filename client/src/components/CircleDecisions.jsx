import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  Gavel,
  Globe,
  Loader2,
  Lock,
  Plus,
  Star,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import Avatar from './Avatar'

/**
 * Circle Decisions — the group decision support system (GDSS).
 *
 *  • **Parallel communication** — everyone posts ideas at once, each saved the
 *    moment it is written, so nobody waits for a turn.
 *  • **Structured thinking** — Delphi and vote decisions run rounds of
 *    *anonymous* rating, so the group converges on the strongest idea rather
 *    than the loudest voice.
 *  • **Shared workspace** — an idea can stay personal while its author works on
 *    it, then be published to the whole Circle.
 *  • **Recordkeeping** — every action lands in a log the Circle can review later.
 */

const KIND_META = {
  brainstorm: { label: 'Brainstorm', hint: 'Collect ideas in parallel' },
  delphi: { label: 'Delphi', hint: 'Rate in rounds, privately' },
  vote: { label: 'Vote', hint: 'One rating round, then decide' },
}

const STATE_META = {
  collecting: {
    label: 'Collecting',
    badge: 'bg-wchat/15 text-wchat',
  },
  rating: {
    label: 'Rating',
    badge: 'bg-amber-400/15 text-amber-500',
  },
  decided: {
    label: 'Decided',
    badge: 'bg-emerald-500/15 text-emerald-500',
  },
}

function formatWhen(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function Stars({ value, onChange, disabled }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          aria-label={`${score} of 5`}
          disabled={disabled}
          onClick={() => onChange?.(score)}
          className={`transition disabled:cursor-not-allowed ${
            value >= score ? 'text-amber-400' : 'text-zinc-700'
          } ${disabled ? '' : 'hover:scale-110'}`}
        >
          <Star size={15} fill={value >= score ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  )
}

/* ---------------------------------------------------------------- detail */

function DecisionDetail({ chatId, decisionId, onBack, onChanged, onUserClick }) {
  const [decision, setDecision] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState('')
  const [decisionText, setDecisionText] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const { data } = await api.get(`/decisions/${decisionId}`)
        if (alive) setDecision(data)
      } catch (error) {
        toast.error(getApiError(error, 'Could not open that decision'))
        onBack()
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [decisionId, onBack])

  const apply = (data) => {
    setDecision(data)
    onChanged?.(data)
  }

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

  const addIdea = () => {
    const text = draft.trim()
    if (!text) return
    void act(
      'idea',
      async () => {
        const { data } = await api.post(`/decisions/${decisionId}/ideas`, { text })
        apply(data)
        setDraft('')
      },
      'Could not add that idea'
    )
  }

  const togglePublish = (idea) =>
    void act(
      `pub-${idea._id}`,
      async () => {
        const { data } = await api.post(
          `/decisions/${decisionId}/ideas/${idea._id}/publish`
        )
        apply(data)
      },
      'Could not change visibility'
    )

  const rate = (idea, score) =>
    void act(
      `rate-${idea._id}`,
      async () => {
        const { data } = await api.post(
          `/decisions/${decisionId}/ideas/${idea._id}/rate`,
          { score }
        )
        apply(data)
      },
      'Could not save your rating'
    )

  const advance = () =>
    void act(
      'advance',
      async () => {
        const { data } = await api.post(`/decisions/${decisionId}/advance`)
        apply(data)
        toast.success(
          data.state === 'rating'
            ? `Round ${data.round} is open for rating`
            : `Round ${data.round} closed`
        )
      },
      'Could not advance the round'
    )

  const recordDecision = () =>
    void act(
      'decide',
      async () => {
        const { data } = await api.post(`/decisions/${decisionId}/decide`, {
          text: decisionText.trim(),
        })
        apply(data)
        toast.success('Decision recorded')
      },
      'Could not record the decision'
    )

  if (!decision) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
        <Loader2 size={16} className="animate-spin" />
        Opening decision…
      </div>
    )
  }

  const stateMeta = STATE_META[decision.state] || STATE_META.collecting
  const kindMeta = KIND_META[decision.kind] || KIND_META.brainstorm
  const staff = decision.yourRole === 'owner' || decision.yourRole === 'admin' ||
    decision.yourRole === 'moderator'
  const rating = decision.state === 'rating'

  return (
    <div className="space-y-5 px-4 py-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
      >
        <ChevronLeft size={15} />
        All decisions
      </button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${stateMeta.badge}`}
          >
            {stateMeta.label}
            {decision.state === 'rating' ? ` · round ${decision.round}` : ''}
          </span>
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
            {kindMeta.label}
          </span>
          <span className="text-xs text-zinc-400">{kindMeta.hint}</span>
        </div>
        <h2 className="text-lg font-semibold">{decision.title}</h2>
        {decision.prompt ? (
          <p className="text-sm text-zinc-400">{decision.prompt}</p>
        ) : null}
        <p className="text-xs text-zinc-500">
          {decision.publishedCount} published of {decision.ideaCount} idea
          {decision.ideaCount === 1 ? '' : 's'}
        </p>
      </header>

      {decision.decision ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-500">
            <Gavel size={13} />
            Decision
          </p>
          <p className="mt-1.5 text-sm">{decision.decision.text}</p>
          <p className="mt-1 text-xs text-emerald-400/70">
            {formatWhen(decision.decision.decidedAt)}
          </p>
        </div>
      ) : null}

      {/* Shared workspace -------------------------------------------- */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users size={15} />
          Ideas
        </h3>

        {decision.state !== 'decided' && (
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addIdea()}
              placeholder="Add an idea — everyone's at once, no queue"
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-wchat"
              maxLength={1000}
            />
            <button
              type="button"
              disabled={!draft.trim() || !!busy}
              onClick={addIdea}
              className="flex items-center gap-1.5 rounded-xl bg-wchat px-3 py-2 text-sm font-medium text-white transition hover:bg-wchat-600 disabled:opacity-50"
            >
              {busy === 'idea' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Add
            </button>
          </div>
        )}

        {decision.ideas.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No ideas yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {decision.ideas.map((idea) => (
              <li
                key={idea._id}
                className="rounded-2xl border border-zinc-800 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar
                      src={idea.author?.profilePicture}
                      name={`${idea.author?.firstName || ''} ${idea.author?.lastName || ''}`}
                      size={28}
                    />
                    <span className="truncate text-sm">
                      <span className="font-medium">
                        {idea.mine ? 'You' : idea.author?.firstName}
                      </span>{' '}
                      <span className="text-zinc-500">{formatWhen(idea.createdAt)}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!idea.mine || !staff || !!busy}
                    onClick={() => togglePublish(idea)}
                    title={
                      idea.published
                        ? 'Published to the Circle'
                        : 'Personal — publish to the group'
                    }
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed ${
                      idea.published
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {idea.published ? <Globe size={11} /> : <Lock size={11} />}
                    {idea.published ? 'public' : 'private'}
                  </button>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm">{idea.text}</p>

                {rating ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-zinc-800/70 pt-2">
                    <Stars
                      value={idea.myRating || 0}
                      disabled={!idea.published || busy === `rate-${idea._id}`}
                      onChange={(score) => rate(idea, score)}
                    />
                    <span className="text-xs text-zinc-400">
                      {idea.ratingCount
                        ? `${idea.average} average · ${idea.ratingCount} rating${idea.ratingCount === 1 ? '' : 's'}`
                        : 'no ratings yet'}
                    </span>
                  </div>
                ) : idea.ratingCount ? (
                  <p className="mt-2 border-t border-zinc-800/70 pt-2 text-xs text-zinc-400">
                    {idea.average} average · {idea.ratingCount} rating
                    {idea.ratingCount === 1 ? '' : 's'}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Staff controls ---------------------------------------------- */}
      {staff && decision.state !== 'decided' && (
        <section className="rounded-2xl border border-zinc-800 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Gavel size={15} />
            Run the session
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {decision.state === 'collecting'
              ? 'Open a rating round to score the published ideas anonymously.'
              : 'Close this round to collect refinements, or record the decision now.'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={advance}
              className="flex items-center gap-2 rounded-xl bg-amber-400/15 px-3 py-2 text-sm font-medium text-amber-500 transition hover:bg-amber-400/25 disabled:opacity-50"
            >
              {busy === 'advance' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {decision.state === 'collecting'
                ? `Open round ${decision.round + 1}`
                : `Close round ${decision.round}`}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={decisionText}
              onChange={(event) => setDecisionText(event.target.value)}
              placeholder="What did the group decide?"
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-wchat"
              maxLength={1000}
            />
            <button
              type="button"
              disabled={!decisionText.trim() || !!busy}
              onClick={recordDecision}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-500 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {busy === 'decide' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              Record decision
            </button>
          </div>
        </section>
      )}

      {/* Automatic recordkeeping ------------------------------------- */}
      <section>
        <h3 className="text-sm font-semibold">Record</h3>
        {decision.log.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {decision.log.map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate">
                  <span className="font-medium capitalize">{entry.action}</span>
                  {entry.detail ? <span className="text-zinc-400"> — {entry.detail}</span> : null}
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

/* ------------------------------------------------------------------ list */

export default function CircleDecisions({ chatId, onUserClick }) {
  const [decisions, setDecisions] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', prompt: '', kind: 'brainstorm' })

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/circles/${chatId}/decisions`)
      setDecisions(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load decisions'))
    }
  }, [chatId])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!form.title.trim()) return
    setBusy('create')
    try {
      const { data } = await api.post(`/circles/${chatId}/decisions`, form)
      setDecisions((prev) => [data, ...(prev || [])])
      setCreating(false)
      setForm({ title: '', prompt: '', kind: 'brainstorm' })
      setOpenId(data._id)
    } catch (error) {
      toast.error(getApiError(error, 'Could not open that decision'))
    } finally {
      setBusy('')
    }
  }

  const changed = useCallback(
    (updated) => {
      setDecisions((prev) =>
        (prev || []).map((entry) => (entry._id === updated._id ? updated : entry))
      )
    },
    []
  )

  const grouped = useMemo(() => decisions || [], [decisions])

  if (openId) {
    return (
      <DecisionDetail
        chatId={chatId}
        decisionId={openId}
        onBack={() => {
          setOpenId(null)
          void load()
        }}
        onChanged={changed}
        onUserClick={onUserClick}
      />
    )
  }

  if (!decisions) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
        <Loader2 size={16} className="animate-spin" />
        Loading decisions…
      </div>
    )
  }

  return (
    <div className="space-y-5 px-4 py-5">
      {/* Create -------------------------------------------------------- */}
      <div className="rounded-2xl border border-zinc-800 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Open a decision</h3>
            <p className="text-xs text-zinc-400">
              Brainstorm together, rate in rounds, then record what the group
              chose.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl bg-wchat px-3 py-2 text-sm font-medium text-white transition hover:bg-wchat-600"
          >
            <Plus size={14} />
            {creating ? 'Cancel' : 'New'}
          </button>
        </div>

        {creating && (
          <div className="mt-3 space-y-2">
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="What should the Circle decide?"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-wchat"
              maxLength={120}
            />
            <input
              value={form.prompt}
              onChange={(event) => setForm({ ...form, prompt: event.target.value })}
              placeholder="Optional context or question"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-wchat"
              maxLength={600}
            />
            <div className="flex flex-wrap gap-2">
              {Object.entries(KIND_META).map(([value, meta]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, kind: value })}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    form.kind === value
                      ? 'bg-wchat text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!form.title.trim() || busy === 'create'}
              onClick={create}
              className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-500 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {busy === 'create' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              Open decision
            </button>
          </div>
        )}
      </div>

      {/* List ---------------------------------------------------------- */}
      {grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">
          No decisions yet. Open one to start a brainstorm.
        </p>
      ) : (
        <ul className="space-y-2">
          {grouped.map((decision) => {
            const stateMeta = STATE_META[decision.state] || STATE_META.collecting
            const kindMeta = KIND_META[decision.kind] || KIND_META.brainstorm
            return (
              <li key={decision._id}>
                <button
                  type="button"
                  onClick={() => setOpenId(decision._id)}
                  className="w-full rounded-2xl border border-zinc-800 px-3 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${stateMeta.badge}`}
                    >
                      {stateMeta.label}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                      {kindMeta.label}
                    </span>
                    <span className="ml-auto text-xs text-zinc-500">
                      {decision.publishedCount}/{decision.ideaCount} ideas
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-sm font-medium">
                    {decision.title}
                  </p>
                  {decision.decision ? (
                    <p className="mt-0.5 truncate text-xs text-emerald-500">
                      Decided: {decision.decision.text}
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      {decision.prompt || 'Tap to open'}
                    </p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
