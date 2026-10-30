import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flag,
  Heart,
  Loader2,
  MessageSquare,
  MessageSquareHeart,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import Avatar from '../components/Avatar'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'reports', label: 'Reports', icon: Flag },
  { id: 'feedback', label: 'Feedback', icon: MessageSquareHeart },
  { id: 'system', label: 'System', icon: Wrench },
]

const number = (n) => (n ?? 0).toLocaleString()
const shortDate = (d) => (d ? new Date(d).toLocaleDateString() : '—')
const dateTime = (d) => (d ? new Date(d).toLocaleString() : '—')
const nameOf = (u) =>
  u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || 'Member' : 'Unknown'

function StatCard({ icon: Icon, label, value, hint, tone = 'blue' }) {
  const tones = {
    blue: 'bg-wchat/10 text-wchat',
    amber: 'bg-amber-400/10 text-amber-300',
    rose: 'bg-rose-500/10 text-rose-300',
    emerald: 'bg-emerald-500/10 text-emerald-300',
    violet: 'bg-violet-500/10 text-violet-300',
  }
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-zinc-100">{number(value)}</p>
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p> : null}
    </div>
  )
}

function Panel({ title, icon: Icon, children, action }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          {Icon ? <Icon size={16} className="text-zinc-400" /> : null}
          {title}
        </h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function StatusPill({ status }) {
  const map = {
    open: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    reviewed: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    actioned: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dismissed: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/40',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${map[status] || map.open}`}>
      {status}
    </span>
  )
}

export default function AdminDashboard({ onClose }) {
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState(null)

  // users
  const [userSearch, setUserSearch] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [usersData, setUsersData] = useState(null)
  const [busyId, setBusyId] = useState(null)

  // reports
  const [reportStatus, setReportStatus] = useState('open')
  const [reportsPage, setReportsPage] = useState(1)
  const [reportsData, setReportsData] = useState(null)

  // feedback
  const [feedbackStatus, setFeedbackStatus] = useState('open')
  const [feedbackPage, setFeedbackPage] = useState(1)
  const [feedbackData, setFeedbackData] = useState(null)
  const [replies, setReplies] = useState({})

  // system
  const [system, setSystem] = useState(null)
  const [savingSystem, setSavingSystem] = useState(false)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/overview')
      setOverview(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load analytics'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/users', {
        params: { search: userSearch, filter: userFilter, page: usersPage, limit: 20 },
      })
      setUsersData(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load users'))
    } finally {
      setLoading(false)
    }
  }, [userSearch, userFilter, usersPage])

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/reports', {
        params: { status: reportStatus, page: reportsPage, limit: 20 },
      })
      setReportsData(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load reports'))
    } finally {
      setLoading(false)
    }
  }, [reportStatus, reportsPage])

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/feedback', {
        params: { status: feedbackStatus, page: feedbackPage, limit: 20 },
      })
      setFeedbackData(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load feedback'))
    } finally {
      setLoading(false)
    }
  }, [feedbackStatus, feedbackPage])

  const loadSystem = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/system')
      setSystem(data)
    } catch (error) {
      toast.error(getApiError(error, 'Could not load system settings'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'overview') loadOverview()
    else if (tab === 'users') loadUsers()
    else if (tab === 'reports') loadReports()
    else if (tab === 'feedback') loadFeedback()
    else if (tab === 'system') loadSystem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilter, usersPage])

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === 'users') {
        setUsersPage(1)
        loadUsers()
      }
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearch])

  useEffect(() => {
    if (tab === 'reports') loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStatus, reportsPage])

  useEffect(() => {
    if (tab === 'feedback') loadFeedback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackStatus, feedbackPage])

  /* ------------------------------------------------------------- user actions */
  const blockUser = async (user) => {
    const reason = window.prompt(`Reason for blocking @${user.username}?`, user.reportCount ? 'Repeat reports' : '')
    if (reason === null) return
    setBusyId(user._id)
    try {
      await api.post(`/admin/users/${user._id}/block`, { reason })
      toast.success(`@${user.username} blocked`)
      loadUsers()
    } catch (error) {
      toast.error(getApiError(error, 'Could not block user'))
    } finally {
      setBusyId(null)
    }
  }

  const unblockUser = async (user) => {
    setBusyId(user._id)
    try {
      await api.post(`/admin/users/${user._id}/unblock`)
      toast.success(`@${user.username} unblocked`)
      loadUsers()
    } catch (error) {
      toast.error(getApiError(error, 'Could not unblock user'))
    } finally {
      setBusyId(null)
    }
  }

  const toggleRole = async (user) => {
    const nextRole = user.role === 'superadmin' ? 'user' : 'superadmin'
    if (!window.confirm(`Change @${user.username} role to ${nextRole}?`)) return
    setBusyId(user._id)
    try {
      await api.put(`/admin/users/${user._id}/role`, { role: nextRole })
      toast.success(`@${user.username} is now ${nextRole}`)
      loadUsers()
    } catch (error) {
      toast.error(getApiError(error, 'Could not change role'))
    } finally {
      setBusyId(null)
    }
  }

  /* ----------------------------------------------------------- report actions */
  const blockReported = async (report) => {
    if (!window.confirm(`Block ${nameOf(report.targetUser)}?`)) return
    setBusyId(report._id)
    try {
      await api.post(`/admin/reports/${report._id}/block`)
      toast.success('Reported account blocked')
      loadReports()
    } catch (error) {
      toast.error(getApiError(error, 'Could not block account'))
    } finally {
      setBusyId(null)
    }
  }

  const resolveReport = async (report, status) => {
    setBusyId(report._id)
    try {
      await api.put(`/admin/reports/${report._id}`, { status })
      toast.success(`Report ${status}`)
      loadReports()
    } catch (error) {
      toast.error(getApiError(error, 'Could not update report'))
    } finally {
      setBusyId(null)
    }
  }

  /* --------------------------------------------------------- feedback actions */
  const updateFeedback = async (item, status) => {
    setBusyId(item._id)
    try {
      await api.put(`/admin/feedback/${item._id}`, {
        status,
        adminReply: replies[item._id] ?? item.adminReply ?? '',
      })
      toast.success('Feedback updated')
      loadFeedback()
    } catch (error) {
      toast.error(getApiError(error, 'Could not update feedback'))
    } finally {
      setBusyId(null)
    }
  }

  /* ----------------------------------------------------------- system actions */
  const saveSystem = async () => {
    setSavingSystem(true)
    try {
      const { data } = await api.put('/admin/system', {
        maintenanceEnabled: Boolean(system.maintenanceEnabled),
        maintenanceMessage: system.maintenanceMessage,
        maintenanceUntil: system.maintenanceUntil || null,
        registrationOpen: Boolean(system.registrationOpen),
      })
      setSystem(data.system)
      toast.success(
        system.maintenanceEnabled ? 'System disabled (maintenance on)' : 'System is live'
      )
    } catch (error) {
      toast.error(getApiError(error, 'Could not save settings'))
    } finally {
      setSavingSystem(false)
    }
  }

  const growthMax = useMemo(
    () => Math.max(1, ...(overview?.userGrowth || []).map((d) => d.count)),
    [overview]
  )

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-3 backdrop-blur">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-wchat-400 to-wchat text-white shadow-lg shadow-wchat/30">
          <ShieldCheck size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold tracking-tight">Super Admin Console</h2>
          <p className="truncate text-[11px] text-zinc-500">WUT Company · control room</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (tab === 'overview') loadOverview()
              else if (tab === 'users') loadUsers()
              else if (tab === 'reports') loadReports()
              else if (tab === 'feedback') loadFeedback()
              else if (tab === 'system') loadSystem()
            }}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-2 py-2">
        {TABS.map((t) => {
          const Icon = t.icon
          const on = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                on ? 'bg-wchat/15 text-wchat' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </nav>

      {/* Body */}
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          {tab === 'overview' ? (
            <OverviewTab
              data={overview}
              loading={loading}
              growthMax={growthMax}
              onRefresh={loadOverview}
            />
          ) : null}

          {tab === 'users' ? (
            <UsersTab
              data={usersData}
              loading={loading}
              search={userSearch}
              setSearch={setUserSearch}
              filter={userFilter}
              setFilter={setUserFilter}
              page={usersPage}
              setPage={setUsersPage}
              busyId={busyId}
              onBlock={blockUser}
              onUnblock={unblockUser}
              onToggleRole={toggleRole}
            />
          ) : null}

          {tab === 'reports' ? (
            <ReportsTab
              data={reportsData}
              loading={loading}
              status={reportStatus}
              setStatus={setReportStatus}
              page={reportsPage}
              setPage={setReportsPage}
              busyId={busyId}
              onBlock={blockReported}
              onResolve={resolveReport}
            />
          ) : null}

          {tab === 'feedback' ? (
            <FeedbackTab
              data={feedbackData}
              loading={loading}
              status={feedbackStatus}
              setStatus={setFeedbackStatus}
              page={feedbackPage}
              setPage={setFeedbackPage}
              busyId={busyId}
              replies={replies}
              setReplies={setReplies}
              onUpdate={updateFeedback}
            />
          ) : null}

          {tab === 'system' ? (
            <SystemTab
              system={system}
              setSystem={setSystem}
              saving={savingSystem}
              onSave={saveSystem}
            />
          ) : null}
        </div>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ Overview */
function OverviewTab({ data, loading, growthMax, onRefresh }) {
  if (!data && loading) {
    return (
      <div className="grid place-items-center py-24 text-zinc-500">
        <Loader2 size={26} className="animate-spin" />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="py-20 text-center text-sm text-zinc-500">
        No analytics yet.
        <button onClick={onRefresh} className="ml-2 text-wchat underline">
          Retry
        </button>
      </div>
    )
  }

  const { totals, openReports, openFeedback, mostLikedPosts, mostActiveCircles, userGrowth } = data

  return (
    <>
      {data.system?.maintenanceEnabled ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle size={18} />
          The platform is currently in maintenance mode. Regular users cannot use Wchat.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={totals.users} hint={`${number(totals.onlineUsers)} online now`} tone="blue" />
        <StatCard icon={Activity} label="New users (7d)" value={totals.newUsers7d} tone="emerald" />
        <StatCard icon={Ban} label="Blocked users" value={totals.blockedUsers} tone="rose" />
        <StatCard icon={MessageSquare} label="Messages" value={totals.messages} tone="violet" />
        <StatCard icon={Heart} label="Sparks (likes)" value={totals.sparks} tone="rose" />
        <StatCard icon={MessageSquareHeart} label="Posts" value={totals.posts} hint={`${number(totals.reels)} reels`} tone="amber" />
        <StatCard icon={Flag} label="Open reports" value={openReports} tone="amber" />
        <StatCard icon={MessageSquareHeart} label="Open feedback" value={openFeedback} tone="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="User growth (14 days)" icon={BarChart3}>
          <div className="flex h-40 items-end gap-1">
            {userGrowth.map((d) => (
              <div key={d.date} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[9px] text-zinc-500 opacity-0 group-hover:opacity-100">{d.count}</span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-wchat/40 to-wchat"
                  style={{ height: `${Math.max(4, (d.count / growthMax) * 120)}px` }}
                  title={`${d.date}: ${d.count} new users`}
                />
                <span className="text-[8px] text-zinc-600">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Most active Circles" icon={Activity}>
          <ul className="space-y-2">
            {mostActiveCircles.length === 0 ? (
              <li className="text-xs text-zinc-500">No messages yet.</li>
            ) : (
              mostActiveCircles.map((c, i) => (
                <li key={c._id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-400">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                    {c.chat?.chatName || 'Direct chat'}
                  </span>
                  <span className="text-xs font-semibold text-wchat">{number(c.messageCount)} msgs</span>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>

      <Panel title="Most liked posts" icon={Heart}>
        {mostLikedPosts.length === 0 ? (
          <p className="text-xs text-zinc-500">No posts yet.</p>
        ) : (
          <ul className="space-y-2">
            {mostLikedPosts.map((p) => (
              <li key={p._id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <Avatar
                  src={p.author?.profilePicture}
                  name={nameOf(p.author)}
                  size={32}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-200">
                    {p.text?.slice(0, 70) || (p.mediaType === 'video' ? 'Video post' : 'Photo post')}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {nameOf(p.author)} · {shortDate(p.createdAt)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-300">
                  <Heart size={13} /> {number(p.sparkCount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest reports" icon={Flag}>
          {(data.recentReports || []).length === 0 ? (
            <p className="text-xs text-zinc-500">No open reports.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentReports.map((r) => (
                <li key={r._id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs">
                  <p className="font-medium text-zinc-200">
                    {nameOf(r.reporter)} reported {nameOf(r.targetUser)}
                  </p>
                  <p className="mt-0.5 capitalize text-zinc-500">
                    {r.reason} · {r.targetType} · {shortDate(r.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Latest feedback" icon={MessageSquareHeart}>
          {(data.recentFeedback || []).length === 0 ? (
            <p className="text-xs text-zinc-500">No open feedback.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentFeedback.map((f) => (
                <li key={f._id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs">
                  <p className="line-clamp-2 text-zinc-200">{f.message}</p>
                  <p className="mt-0.5 text-zinc-500">
                    {nameOf(f.user)} · {f.type} · {shortDate(f.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

/* --------------------------------------------------------------------- Users */
function UsersTab({ data, loading, search, setSearch, filter, setFilter, page, setPage, busyId, onBlock, onUnblock, onToggleRole }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, @username, email or phone"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-wchat/60"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
        >
          <option value="">All users</option>
          <option value="reported">Reported</option>
          <option value="blocked">Blocked</option>
          <option value="admins">Super admins</option>
        </select>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-zinc-500">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.users || []).map((u) => (
            <div key={u._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
              <Avatar src={u.profilePicture} name={nameOf(u)} size={38} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-zinc-100">
                  {nameOf(u)}
                  {u.role === 'superadmin' ? (
                    <span className="rounded-full bg-wchat/15 px-1.5 py-0.5 text-[9px] font-bold text-wchat">ADMIN</span>
                  ) : null}
                  {u.isBlocked ? (
                    <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">BLOCKED</span>
                  ) : null}
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  @{u.username} · {u.email} · joined {shortDate(u.createdAt)}
                </p>
                {u.isBlocked && u.blockedReason ? (
                  <p className="truncate text-[10px] text-rose-400/80">Reason: {u.blockedReason}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${u.reportCount > 0 ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-zinc-700 text-zinc-500'}`}>
                  {u.reportCount} report{u.reportCount === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleRole(u)}
                  disabled={busyId === u._id}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  title={u.role === 'superadmin' ? 'Remove admin' : 'Make super admin'}
                >
                  {u.role === 'superadmin' ? 'Revoke admin' : 'Make admin'}
                </button>
                {u.isBlocked ? (
                  <button
                    type="button"
                    onClick={() => onUnblock(u)}
                    disabled={busyId === u._id}
                    className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    Unblock
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onBlock(u)}
                    disabled={busyId === u._id || u.role === 'superadmin'}
                    className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-40"
                  >
                    Block
                  </button>
                )}
              </div>
            </div>
          ))}
          {data?.users?.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">No users match this filter.</p>
          ) : null}
        </div>
      )}

      <Pager page={page} pages={data?.pages} setPage={setPage} />
    </>
  )
}

/* ------------------------------------------------------------------- Reports */
function ReportsTab({ data, loading, status, setStatus, page, setPage, busyId, onBlock, onResolve }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-zinc-500" />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
        >
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
          <option value="">All</option>
        </select>
        <span className="text-xs text-zinc-500">{number(data?.total)} total</span>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-zinc-500">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.reports || []).map((r) => (
            <div key={r._id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200">
                    <span className="font-semibold">{nameOf(r.reporter)}</span>
                    {' reported '}
                    <span className="font-semibold text-rose-300">{nameOf(r.targetUser)}</span>
                    {' '}
                    <StatusPill status={r.status} />
                  </p>
                  <p className="mt-1 text-xs capitalize text-zinc-400">
                    {r.reason} · {r.targetType} · {dateTime(r.createdAt)}
                  </p>
                  {r.details ? <p className="mt-1 text-xs text-zinc-500">“{r.details}”</p> : null}
                  {r.actionTaken ? <p className="mt-1 text-[11px] text-emerald-400/80">Action: {r.actionTaken}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.targetUser && !r.targetUser.isBlocked ? (
                    <button
                      type="button"
                      onClick={() => onBlock(r)}
                      disabled={busyId === r._id}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
                    >
                      <Ban size={12} /> Block user
                    </button>
                  ) : null}
                  {r.status === 'open' ? (
                    <button
                      type="button"
                      onClick={() => onResolve(r, 'reviewed')}
                      disabled={busyId === r._id}
                      className="rounded-lg bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-50"
                    >
                      Reviewed
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onResolve(r, 'dismissed')}
                    disabled={busyId === r._id}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
          {data?.reports?.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">No reports here. All clear.</p>
          ) : null}
        </div>
      )}

      <Pager page={page} pages={data?.pages} setPage={setPage} />
    </>
  )
}

/* ------------------------------------------------------------------ Feedback */
function FeedbackTab({ data, loading, status, setStatus, page, setPage, busyId, replies, setReplies, onUpdate }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-zinc-500" />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
        >
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="resolved">Resolved</option>
          <option value="">All</option>
        </select>
        <span className="text-xs text-zinc-500">{number(data?.total)} total</span>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-zinc-500">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.feedback || []).map((f) => (
            <div key={f._id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar src={f.user?.profilePicture} name={nameOf(f.user)} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-200">
                    <span className="font-semibold">{nameOf(f.user)}</span>
                    <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-400">{f.type}</span>
                    <StatusPill status={f.status} />
                    {f.rating ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-300">
                        {Array.from({ length: f.rating }).map((_, i) => (
                          <Star key={i} size={11} fill="#fbbf24" />
                        ))}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{f.message}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{dateTime(f.createdAt)} · {f.page || 'app'}</p>

                  {f.adminReply ? (
                    <p className="mt-2 rounded-lg border border-wchat/20 bg-wchat/5 px-2 py-1 text-[11px] text-wchat/90">
                      Reply: {f.adminReply}
                    </p>
                  ) : null}

                  <textarea
                    value={replies[f._id] ?? f.adminReply ?? ''}
                    onChange={(e) => setReplies((prev) => ({ ...prev, [f._id]: e.target.value }))}
                    rows={2}
                    placeholder="Write an internal reply / resolution note…"
                    className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-wchat/50"
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdate(f, 'reviewed')}
                  disabled={busyId === f._id}
                  className="rounded-lg bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-50"
                >
                  Save reply
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(f, 'resolved')}
                  disabled={busyId === f._id}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  <Check size={12} /> Resolve
                </button>
              </div>
            </div>
          ))}
          {data?.feedback?.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">No feedback here yet.</p>
          ) : null}
        </div>
      )}

      <Pager page={page} pages={data?.pages} setPage={setPage} />
    </>
  )
}

/* -------------------------------------------------------------------- System */
function SystemTab({ system, setSystem, saving, onSave }) {
  if (!system) {
    return (
      <div className="grid place-items-center py-20 text-zinc-500">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  const untilValue = system.maintenanceUntil
    ? new Date(system.maintenanceUntil).toISOString().slice(0, 16)
    : ''

  return (
    <div className="space-y-4">
      <Panel title="System availability" icon={Wrench}>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Disable the system (maintenance mode)</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                When on, everyone except super admins sees a maintenance screen and the API returns 503.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(system.maintenanceEnabled)}
              onClick={() =>
                setSystem((s) => ({ ...s, maintenanceEnabled: !s.maintenanceEnabled }))
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                system.maintenanceEnabled ? 'bg-rose-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  system.maintenanceEnabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {system.maintenanceEnabled ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Maintenance mode is ON. Users are locked out right now.
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Maintenance message</label>
            <textarea
              value={system.maintenanceMessage || ''}
              onChange={(e) => setSystem((s) => ({ ...s, maintenanceMessage: e.target.value }))}
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-wchat/60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Auto-end maintenance at (optional)
            </label>
            <input
              type="datetime-local"
              value={untilValue}
              onChange={(e) =>
                setSystem((s) => ({
                  ...s,
                  maintenanceUntil: e.target.value ? new Date(e.target.value).toISOString() : null,
                }))
              }
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-wchat/60"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Allow new registrations</p>
              <p className="mt-0.5 text-xs text-zinc-500">Turn off to freeze sign-ups without disabling the whole app.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(system.registrationOpen)}
              onClick={() =>
                setSystem((s) => ({ ...s, registrationOpen: !s.registrationOpen }))
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                system.registrationOpen ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  system.registrationOpen ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-wchat-400 to-wchat px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-wchat/25 transition hover:brightness-105 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Save settings
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Danger zone" icon={AlertTriangle}>
        <p className="text-xs text-zinc-500">
          Maintenance mode does not delete data. Blocked users keep their content but cannot sign in
          until you unblock them from the Users tab.
        </p>
      </Panel>
    </div>
  )
}

function Pager({ page, pages, setPage }) {
  if (!pages || pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        type="button"
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page <= 1}
        className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-900 disabled:opacity-40"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-xs text-zinc-500">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        onClick={() => setPage((p) => Math.min(pages, p + 1))}
        disabled={page >= pages}
        className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-900 disabled:opacity-40"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
