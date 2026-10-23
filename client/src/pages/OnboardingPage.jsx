import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Loader2,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import Logo from '../components/Logo'
import { formatHandle } from '../utils/handle'

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder-ink/35 outline-none transition focus:border-wchat focus:ring-4 focus:ring-wchat/10'

/**
 * Wchat onboarding.
 *   Step 1 — pick at least `minInterests` fields.
 *   Step 2 — Join at least `minJoinedCircles` Circles (or people).
 * The account already exists and is signed in; we only collect tastes here.
 */
export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, token, updateUser, logout } = useAuth()

  const [step, setStep] = useState(1)
  const [catalog, setCatalog] = useState([])
  const [categories, setCategories] = useState([])
  const [minInterests, setMinInterests] = useState(5)
  const [minCircles, setMinCircles] = useState(5)
  const [selected, setSelected] = useState(new Set())
  const [joined, setJoined] = useState(new Set())
  const [pending, setPending] = useState(new Set())
  const [recommend, setRecommend] = useState({ circles: [], people: [] })
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(null)
  const [finishing, setFinishing] = useState(false)

  /* -------------------------------------------------------------- taxonomy */
  useEffect(() => {
    api
      .get('/interests')
      .then(({ data }) => {
        setCatalog(Array.isArray(data?.interests) ? data.interests : [])
        setCategories(Array.isArray(data?.categories) ? data.categories : [])
        if (data?.minInterests) setMinInterests(data.minInterests)
        if (data?.minJoinedCircles) setMinCircles(data.minJoinedCircles)
      })
      .catch(() => toast.error('Could not load the interest list'))
  }, [])

  /* --------------------------------------------------------- current state */
  const loadOnboarding = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/users/onboarding')
      setSelected(new Set(data?.interests || []))
      setJoined(new Set(data?.joinedCircleIds || []))
      setRecommend(data?.recommendations || { circles: [], people: [] })
      if (data?.minInterests) setMinInterests(data.minInterests)
      if (data?.minJoinedCircles) setMinCircles(data.minJoinedCircles)
      return data
    } catch (error) {
      toast.error(getApiError(error, 'Could not load your onboarding'))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    loadOnboarding().then((data) => {
      // Already onboarded → straight to the dashboard.
      if (data?.completedAt) navigate('/', { replace: true })
    })
  }, [token, loadOnboarding, navigate])

  /* Debounce the Circle search. */
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (step !== 2 || !term.trim()) {
      setResults([])
      return undefined
    }
    let active = true
    api
      .get('/chats/discover', { params: { search: term.trim(), sort: 'members' } })
      .then(({ data }) => {
        if (active) setResults(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (active) setResults([])
      })
    return () => {
      active = false
    }
  }, [term, step])

  /* ------------------------------------------------------------- interests */
  const grouped = useMemo(() => {
    const byCategory = new Map(categories.map((c) => [c.id, []]))
    catalog.forEach((interest) => {
      if (!byCategory.has(interest.category)) byCategory.set(interest.category, [])
      byCategory.get(interest.category).push(interest)
    })
    return [...byCategory.entries()].map(([id, items]) => ({
      id,
      label: categories.find((c) => c.id === id)?.label || id,
      items,
    }))
  }, [catalog, categories])

  const toggleInterest = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveInterests = async () => {
    if (selected.size < minInterests) {
      toast.error(`Pick at least ${minInterests} fields`)
      return
    }
    setSaving(true)
    try {
      await api.put('/users/interests', { interests: [...selected] })
      toast.success('Fields saved — now find your people')
      setStep(2)
      await loadOnboarding()
    } catch (error) {
      toast.error(getApiError(error, 'Could not save your fields'))
    } finally {
      setSaving(false)
    }
  }

  /* ----------------------------------------------------------------- join */
  const joinCircle = async (circle) => {
    const id = circle._id || circle.id
    if (!id) return
    setBusy(id)
    try {
      const { data } = await api.post('/users/onboarding/join', { chatId: id })
      if (data?.pending) {
        setPending((prev) => new Set(prev).add(id))
        toast.success('Join request sent — the admin will approve it')
      } else {
        setJoined((prev) => new Set(prev).add(id))
        toast.success(data?.message || `You joined ${circle.chatName}`)
      }
    } catch (error) {
      toast.error(getApiError(error, 'Could not join this Circle'))
    } finally {
      setBusy(null)
    }
  }

  const finish = async () => {
    if (joined.size < minCircles) {
      toast.error(`Join at least ${minCircles} Circles to continue`)
      return
    }
    setFinishing(true)
    try {
      const { data } = await api.post('/users/onboarding/complete')
      const nextUser = data?.user || data
      if (nextUser?._id) updateUser(nextUser)
      toast.success('Welcome to Wchat! 🎉')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(getApiError(error, 'Could not finish onboarding'))
    } finally {
      setFinishing(false)
    }
  }

  const remaining = Math.max(0, minCircles - joined.size)
  const firstName = user?.firstName || 'friend'

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo size={36} tagline="Set up your circles" />
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs font-semibold text-ink/50 sm:flex">
              <span className={step === 1 ? 'text-wchat' : ''}>1 · Fields</span>
              <span className="text-ink/20">—</span>
              <span className={step === 2 ? 'text-wchat' : ''}>2 · Circles</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:border-wchat/40 hover:text-ink"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink/50">
            <div className="spinner" />
            <p className="text-sm">Getting things ready…</p>
          </div>
        ) : step === 1 ? (
          <FieldsStep
            firstName={firstName}
            grouped={grouped}
            selected={selected}
            minInterests={minInterests}
            onToggle={toggleInterest}
            onContinue={saveInterests}
            saving={saving}
          />
        ) : (
          <CirclesStep
            firstName={firstName}
            recommend={recommend}
            results={results}
            joined={joined}
            pending={pending}
            minCircles={minCircles}
            remaining={remaining}
            search={search}
            onSearch={setSearch}
            busy={busy}
            finishing={finishing}
            onJoin={joinCircle}
            onBack={() => setStep(1)}
            onFinish={finish}
          />
        )}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ step 1 */
function FieldsStep({
  firstName,
  grouped,
  selected,
  minInterests,
  onToggle,
  onContinue,
  saving,
}) {
  const count = selected.size
  const enough = count >= minInterests

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-wchat/10 px-3 py-1 text-xs font-semibold text-wchat">
          <Sparkles size={13} /> Step 1 of 2
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Karibu, {firstName} — what are you into?
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          Pick at least {minInterests} fields. We use them to fill your feed and suggest your first
          Circles.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {grouped.map((group) => (
          <section key={group.id}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink/45">
              {group.label}
            </h2>
            <div className="flex flex-wrap gap-2">
              {group.items.map((interest) => {
                const active = selected.has(interest.id)
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => onToggle(interest.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-wchat bg-wchat text-white shadow-sm shadow-wchat/25'
                        : 'border-line bg-white text-ink/80 hover:border-wchat/40 hover:text-ink'
                    }`}
                  >
                    <span aria-hidden="true">{interest.emoji}</span>
                    {interest.label}
                    {active ? <Check size={14} /> : null}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 mt-8 border-t border-line bg-surface/90 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-ink/60">
            <span className={`font-bold ${enough ? 'text-wchat' : 'text-ink'}`}>{count}</span> of{' '}
            {minInterests} selected
          </p>
          <button
            type="button"
            onClick={onContinue}
            disabled={!enough || saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wchat px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-wchat/25 transition hover:bg-wchat-600 disabled:opacity-50 sm:w-auto"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ step 2 */
function CirclesStep({
  firstName,
  recommend,
  results,
  joined,
  pending,
  minCircles,
  remaining,
  search,
  onSearch,
  busy,
  finishing,
  onJoin,
  onBack,
  onFinish,
}) {
  const done = joined.size >= minCircles
  const list = search.trim() ? results : recommend.circles
  const people = search.trim() ? [] : recommend.people

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-wchat/10 px-3 py-1 text-xs font-semibold text-wchat">
          <Users size={13} /> Step 2 of 2
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Find your circles, {firstName}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          Join at least {minCircles} Circles. Joining someone's Circle is how you follow them on
          Wchat.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm">
          <span className="font-bold text-wchat">{joined.size}</span>
          <span className="text-ink/50">/ {minCircles} joined</span>
          {remaining > 0 ? (
            <span className="text-ink/40">· {remaining} to go</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <Check size={14} /> ready
            </span>
          )}
        </div>
      </div>

      <div className="relative mx-auto mt-6 max-w-xl">
        <Search size={16} className="icon-left" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search Circles by name"
          className={`${inputClass} pl-9`}
        />
      </div>

      <div className="mt-6 space-y-8">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink/45">
            <Compass size={14} /> {search.trim() ? 'Search results' : 'Circles for you'}
          </h2>
          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-sm text-ink/50">
              {search.trim()
                ? 'No Circles match that search.'
                : 'No suggestions yet — pick a few more fields in step 1.'}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((circle) => (
                <CircleCard
                  key={circle._id}
                  circle={circle}
                  joined={joined.has(circle._id)}
                  pending={pending.has(circle._id)}
                  busy={busy === circle._id}
                  onJoin={() => onJoin(circle)}
                />
              ))}
            </div>
          )}
        </section>

        {people.length > 0 ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink/45">
              <Sparkles size={14} /> People to join
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((circle) => (
                <CircleCard
                  key={circle._id}
                  circle={circle}
                  person
                  joined={joined.has(circle._id)}
                  pending={pending.has(circle._id)}
                  busy={busy === circle._id}
                  onJoin={() => onJoin(circle)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 mt-10 border-t border-line bg-surface/90 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 transition hover:text-ink"
          >
            <ArrowLeft size={16} /> Back to fields
          </button>
          <button
            type="button"
            onClick={onFinish}
            disabled={!done || finishing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wchat px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-wchat/25 transition hover:bg-wchat-600 disabled:opacity-50 sm:w-auto"
          >
            {finishing ? <Loader2 size={18} className="animate-spin" /> : null}
            {done ? 'Enter Wchat' : `Join ${remaining} more`}
          </button>
        </div>
      </div>
    </div>
  )
}

function CircleCard({ circle, person = false, joined, pending, busy, onJoin }) {
  const owner = circle.owner
  const title = person && owner ? `${owner.firstName} ${owner.lastName}`.trim() : circle.chatName
  const subtitle = person && owner ? formatHandle(owner.username) : circle.description
  const avatar = person && owner ? owner.profilePicture : circle.groupAvatar

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar src={avatar} name={title} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          {subtitle ? (
            <p className="truncate text-xs text-ink/50">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {circle.interests?.length ? (
        <div className="flex flex-wrap gap-1">
          {circle.interests.slice(0, 3).map((id) => (
            <span
              key={id}
              className="rounded-full bg-wchat/10 px-2 py-0.5 text-[10px] font-medium text-wchat"
            >
              {id.replace(/-/g, ' ')}
            </span>
          ))}
        </div>
      ) : null}

      <p className="text-[11px] text-ink/40">
        {circle.memberCount ?? 0} member{(circle.memberCount ?? 0) === 1 ? '' : 's'}
        {circle.district ? ` · ${circle.district}` : ''}
        {circle.joinPolicy === 'request' ? ' · approval needed' : ''}
      </p>

      <button
        type="button"
        onClick={onJoin}
        disabled={joined || pending || busy}
        className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed ${
          joined
            ? 'bg-emerald-50 text-emerald-700'
            : pending
              ? 'bg-ink/5 text-ink/50'
              : 'bg-wchat text-white hover:bg-wchat-600 disabled:opacity-60'
        }`}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : joined ? (
          <Check size={14} />
        ) : (
          <Plus size={14} />
        )}
        {joined ? 'Joined' : pending ? 'Requested' : 'Join'}
      </button>
    </div>
  )
}
