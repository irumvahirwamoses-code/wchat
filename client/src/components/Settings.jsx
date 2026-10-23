import { useEffect, useState } from 'react'
import {
  AtSign,
  Ban,
  BarChart3,
  Bell,
  CalendarDays,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Palette,
  Phone,
  Plus,
  Share2,
  Shield,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import ProfileInsights from './ProfileInsights'
import { formatHandle } from '../utils/handle'
import { applyTheme, getTheme, isDataSaver, setDataSaver } from '../utils/theme'
import { setHiddenWords as persistHiddenWords } from '../utils/contentFilter'

const THEMES = [
  { id: 'light', name: 'Light', preview: ['#f3f5fa', '#ffffff', '#245bff'] },
  { id: 'dark', name: 'Dark', preview: ['#09090b', '#18181b', '#38bdf8'] },
  { id: 'midnight', name: 'Midnight', preview: ['#0a0616', '#150d2b', '#6b5bff'] },
]

const SECTIONS = [
  { id: 'account', label: 'Account Center', icon: Zap },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'sharing', label: 'Sharing & reuse', icon: Share2 },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & safety', icon: Shield },
  { id: 'data', label: 'Data & storage', icon: Wifi },
]

const ACCOUNT_LABELS = {
  personal: 'Personal',
  creator: 'Creator',
  business: 'Business',
}

const MENTION_OPTIONS = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'people-i-follow', label: 'People I follow' },
  { id: 'no-one', label: 'No one' },
]

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm text-zinc-200">{label}</span>
        {hint ? <span className="block text-[11px] text-zinc-500">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-amber-400' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  )
}

/** A compact read-only detail row used across the Account Center. */
function DetailRow({ icon: Icon, label, value }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Icon size={14} className="shrink-0 text-zinc-500" />
      <span className="flex-1 text-xs text-zinc-400">{label}</span>
      <span className="min-w-0 truncate text-xs font-medium text-zinc-200">{value || '—'}</span>
    </li>
  )
}

export default function Settings({ onClose }) {
  const { user, logout } = useAuth()
  const [section, setSection] = useState('account')

  // Appearance & data
  const [theme, setTheme] = useState(getTheme())
  const [dataSaver, setDataSaverState] = useState(isDataSaver())
  const [autoplay, setAutoplay] = useState(true)
  const [highQuality, setHighQuality] = useState(true)

  // Notifications
  const [notifyActivity, setNotifyActivity] = useState(true)
  const [notifyChats, setNotifyChats] = useState(true)

  // Privacy & safety
  const [readReceipts, setReadReceipts] = useState(true)
  const [dmAnyone, setDmAnyone] = useState(true)
  const [hiddenWords, setHiddenWords] = useState([])
  const [wordDraft, setWordDraft] = useState('')
  const [blocked, setBlocked] = useState([])

  // Sharing & reuse
  const [allowRemix, setAllowRemix] = useState(true)
  const [allowShareToStories, setAllowShareToStories] = useState(true)
  const [allowDownload, setAllowDownload] = useState(true)
  const [allowMentions, setAllowMentions] = useState('everyone')

  // Password & security
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwVisible, setPwVisible] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => {
        const p = data?.preferences || {}
        if (p.theme) {
          setTheme(p.theme)
          applyTheme(p.theme)
        }
        if (typeof p.dataSaver === 'boolean') {
          setDataSaverState(p.dataSaver)
          setDataSaver(p.dataSaver)
        }
        if (typeof p.autoplayVideos === 'boolean') setAutoplay(p.autoplayVideos)
        if (typeof p.showReadReceipts === 'boolean') setReadReceipts(p.showReadReceipts)
        if (typeof p.allowDmFromAnyone === 'boolean') setDmAnyone(p.allowDmFromAnyone)
        if (typeof p.notifyActivity === 'boolean') setNotifyActivity(p.notifyActivity)
        if (typeof p.notifyChats === 'boolean') setNotifyChats(p.notifyChats)
        if (typeof p.highQualityUploads === 'boolean') setHighQuality(p.highQualityUploads)
        if (typeof p.allowRemix === 'boolean') setAllowRemix(p.allowRemix)
        if (typeof p.allowShareToStories === 'boolean') setAllowShareToStories(p.allowShareToStories)
        if (typeof p.allowDownload === 'boolean') setAllowDownload(p.allowDownload)
        if (typeof p.allowMentions === 'string') setAllowMentions(p.allowMentions)
        if (Array.isArray(p.hiddenWords)) {
          setHiddenWords(p.hiddenWords)
          persistHiddenWords(p.hiddenWords)
        }
      })
      .catch(() => {})
    api
      .get('/auth/blocked')
      .then(({ data }) => setBlocked(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const addWord = () => {
    const word = wordDraft.trim().toLowerCase()
    if (!word) return
    if (hiddenWords.includes(word)) {
      setWordDraft('')
      return
    }
    if (hiddenWords.length >= 50) {
      toast.error('You can hide up to 50 words')
      return
    }
    setHiddenWords((prev) => [...prev, word])
    setWordDraft('')
  }

  const removeWord = (word) => setHiddenWords((prev) => prev.filter((w) => w !== word))

  const chooseTheme = (id) => {
    setTheme(id)
    applyTheme(id)
  }

  const save = async () => {
    setSaving(true)
    setDataSaver(dataSaver)
    try {
      await api.put('/auth/preferences', {
        theme,
        dataSaver,
        autoplayVideos: autoplay,
        showReadReceipts: readReceipts,
        allowDmFromAnyone: dmAnyone,
        notifyActivity,
        notifyChats,
        highQualityUploads: highQuality,
        hiddenWords,
        allowRemix,
        allowShareToStories,
        allowDownload,
        allowMentions,
      })
      toast.success('Settings saved')
      persistHiddenWords(hiddenWords)
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not save settings'))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (pwNew.length < 6) {
      toast.error('Your new password must be at least 6 characters')
      return
    }
    if (pwNew !== pwConfirm) {
      toast.error('The new passwords do not match')
      return
    }
    setPwBusy(true)
    try {
      await api.put('/auth/password', { currentPassword: pwCurrent, newPassword: pwNew })
      toast.success('Password updated')
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
    } catch (error) {
      toast.error(getApiError(error, 'Could not update your password'))
    } finally {
      setPwBusy(false)
    }
  }

  const unblock = async (id) => {
    try {
      await api.delete(`/auth/block/${id}`)
      setBlocked((prev) => prev.filter((b) => b._id !== id))
      toast.success('Unblocked')
    } catch (error) {
      toast.error(getApiError(error, 'Could not unblock'))
    }
  }

  const pwInputClass =
    'w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-wchat/70'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <aside className="hidden w-52 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/40 sm:flex">
          <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
            <Avatar
              src={user?.profilePicture}
              name={`${user?.firstName || ''} ${user?.lastName || ''}`}
              size={36}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-100">
                {`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
              </p>
              <p className="truncate text-[10px] text-zinc-500">{formatHandle(user?.username)}</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const on = section === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                    on ? 'bg-zinc-800 text-amber-300' : 'text-zinc-400 hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon size={15} />
                  {s.label}
                </button>
              )
            })}
          </nav>
          <button
            type="button"
            onClick={() => {
              onClose?.()
              logout()
            }}
            className="m-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={15} />
            Log out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">
              {SECTIONS.find((s) => s.id === section)?.label || 'Settings'}
            </h2>
            <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
              <X size={16} />
            </button>
          </header>

          {/* Mobile section switcher */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-800 px-3 py-2 sm:hidden">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                  section === s.id ? 'bg-amber-400 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {section === 'appearance' ? (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500">
                  Choose how Wchat looks on every device you sign in to.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => chooseTheme(t.id)}
                      className={`overflow-hidden rounded-xl border text-left transition ${
                        theme === t.id
                          ? 'border-amber-400 shadow-[0_0_0_3px_rgba(36,91,255,0.18)]'
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <span className="flex h-16">
                        {t.preview.map((c) => (
                          <span key={c} className="flex-1" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="block px-3 py-2 text-xs font-semibold text-zinc-200">
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {section === 'account' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-800 p-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user?.profilePicture}
                      name={`${user?.firstName || ''} ${user?.lastName || ''}`}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
                      </p>
                      <p className="truncate text-[11px] text-wchat">{formatHandle(user?.username)}</p>
                    </div>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold capitalize text-zinc-300">
                      {ACCOUNT_LABELS[user?.accountType] || 'Personal'}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xs font-semibold text-zinc-300">Personal details</h3>
                  <ul className="mt-1 divide-y divide-zinc-800/60">
                    <DetailRow
                      icon={AtSign}
                      label="Username"
                      value={user?.username ? `@${user.username}` : ''}
                    />
                    <DetailRow icon={Mail} label="Email" value={user?.email} />
                    <DetailRow icon={Phone} label="Phone" value={user?.phoneNumber} />
                    <DetailRow
                      icon={CalendarDays}
                      label="Date of birth"
                      value={
                        user?.dateOfBirth
                          ? new Date(user.dateOfBirth).toLocaleDateString()
                          : ''
                      }
                    />
                  </ul>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Change your name, photo, category and links in{' '}
                    <span className="font-medium text-zinc-300">Edit profile</span>.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 p-3.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <KeyRound size={13} /> Password &amp; security
                  </h3>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Use at least 6 characters. You&apos;ll stay signed in on this device.
                  </p>
                  <div className="mt-3 space-y-2">
                    <input
                      type={pwVisible ? 'text' : 'password'}
                      value={pwCurrent}
                      onChange={(event) => setPwCurrent(event.target.value)}
                      placeholder="Current password"
                      autoComplete="current-password"
                      className={pwInputClass}
                    />
                    <div className="flex gap-2">
                      <input
                        type={pwVisible ? 'text' : 'password'}
                        value={pwNew}
                        onChange={(event) => setPwNew(event.target.value)}
                        placeholder="New password"
                        autoComplete="new-password"
                        className={pwInputClass}
                      />
                      <input
                        type={pwVisible ? 'text' : 'password'}
                        value={pwConfirm}
                        onChange={(event) => setPwConfirm(event.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        className={pwInputClass}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPwVisible((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      {pwVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                      {pwVisible ? 'Hide passwords' : 'Show passwords'}
                    </button>
                    <button
                      type="button"
                      onClick={changePassword}
                      disabled={pwBusy || !pwCurrent || !pwNew}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      {pwBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                      Update password
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 p-3.5">
                  <h3 className="text-xs font-semibold text-zinc-300">Account status</h3>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Your account is in good standing. Nothing is restricted.
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
                    <li className="flex items-center justify-between">
                      <span>Email verified</span>
                      <span className={user?.emailVerified ? 'text-wchat' : 'text-zinc-500'}>
                        {user?.emailVerified ? 'Verified' : 'Not verified'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Phone verified</span>
                      <span className={user?.phoneVerified ? 'text-wchat' : 'text-zinc-500'}>
                        {user?.phoneVerified ? 'Verified' : 'Not verified'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Visibility</span>
                      <span className="text-zinc-300">
                        {user?.isPrivate ? 'Private' : 'Public'}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-zinc-800 p-3.5">
                  <h3 className="text-xs font-semibold text-zinc-300">Your activity</h3>
                  <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
                    <li className="flex items-center justify-between">
                      <span>Hidden words</span>
                      <span className="text-zinc-300">{hiddenWords.length}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Blocked accounts</span>
                      <span className="text-zinc-300">{blocked.length}</span>
                    </li>
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSection('insights')}
                      className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-wchat/50 hover:text-wchat"
                    >
                      View profile insights
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection('privacy')}
                      className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-wchat/50 hover:text-wchat"
                    >
                      Manage hidden words &amp; blocks
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {section === 'sharing' ? (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500">
                  Control how other people may reuse the things you post.
                </p>

                <div className="rounded-xl border border-zinc-800 px-3.5">
                  <div className="divide-y divide-zinc-800/70">
                    <Toggle
                      label="Allow remixes"
                      hint="Let others build a new Reel from yours. Your name is kept on it."
                      checked={allowRemix}
                      onChange={setAllowRemix}
                    />
                    <Toggle
                      label="Allow sharing"
                      hint="Let others re-share your posts and Reels."
                      checked={allowShareToStories}
                      onChange={setAllowShareToStories}
                    />
                    <Toggle
                      label="Allow downloads"
                      hint="Let others save the photos and videos you post."
                      checked={allowDownload}
                      onChange={setAllowDownload}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 p-3.5">
                  <h3 className="block text-xs font-semibold text-zinc-300">Who can @mention you</h3>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Mentions you don&apos;t allow are quietly left out — nobody is notified.
                  </p>
                  <select
                    id="allowMentions"
                    value={allowMentions}
                    onChange={(event) => setAllowMentions(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-wchat/70"
                  >
                    {MENTION_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-[11px] text-zinc-600">
                  These controls apply across Wchat. You can still share and download your own
                  content.
                </p>
              </div>
            ) : null}

            {section === 'insights' ? <ProfileInsights /> : null}

            {section === 'data' ? (
              <div className="divide-y divide-zinc-800/70">
                <Toggle
                  label="Data saver"
                  hint="Load less media. Videos wait for a tap instead of autoplaying."
                  checked={dataSaver}
                  onChange={setDataSaverState}
                />
                <Toggle
                  label="Autoplay videos"
                  hint="Play Reels and feed videos automatically."
                  checked={autoplay}
                  onChange={setAutoplay}
                />
                <Toggle
                  label="Upload at highest quality"
                  hint="Upload the original photo or video instead of a compressed copy."
                  checked={highQuality}
                  onChange={setHighQuality}
                />
              </div>
            ) : null}

            {section === 'notifications' ? (
              <div className="divide-y divide-zinc-800/70">
                <Toggle
                  label="Sparks, comments and mentions"
                  hint="When someone Sparks your post, comments or @mentions you."
                  checked={notifyActivity}
                  onChange={setNotifyActivity}
                />
                <Toggle
                  label="Messages"
                  hint="Badge new direct messages and Circle conversations."
                  checked={notifyChats}
                  onChange={setNotifyChats}
                />
                <p className="pt-3 text-[11px] text-zinc-500">
                  In-app activity appears on the bell in Home.
                </p>
              </div>
            ) : null}

            {section === 'privacy' ? (
              <div className="space-y-4">
                <Toggle
                  label="Read receipts"
                  hint="Let people you chat with see when you have read their messages."
                  checked={readReceipts}
                  onChange={setReadReceipts}
                />
                <Toggle
                  label="Allow direct messages from anyone"
                  hint="If off, only people you have joined (or Circles in common) can message you."
                  checked={dmAnyone}
                  onChange={setDmAnyone}
                />
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-zinc-400">Hidden words</h3>
                  <p className="mb-2 text-[11px] text-zinc-500">
                    Posts, comments and messages containing these words will be kept out of your
                    view.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={wordDraft}
                      onChange={(event) => setWordDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addWord()
                        }
                      }}
                      placeholder="Add a word or phrase"
                      className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-wchat/70"
                    />
                    <button
                      type="button"
                      onClick={addWord}
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700"
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                  {hiddenWords.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {hiddenWords.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() => removeWord(word)}
                          title="Remove"
                          className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          {word}
                          <X size={11} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-600">No hidden words yet.</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                    <Ban size={13} /> Blocked accounts
                  </h3>
                  {blocked.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">You haven&apos;t blocked anyone.</p>
                  ) : (
                    <ul className="space-y-2">
                      {blocked.map((b) => (
                        <li
                          key={b._id}
                          className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2"
                        >
                          <Avatar
                            src={b.profilePicture}
                            name={`${b.firstName || ''} ${b.lastName || ''}`}
                            size={28}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                            {`${b.firstName || ''} ${b.lastName || ''}`.trim() || b.username}
                          </span>
                          <button
                            type="button"
                            onClick={() => unblock(b._id)}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800"
                          >
                            Unblock
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <footer className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-300"
            >
              Close
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              Save
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}
