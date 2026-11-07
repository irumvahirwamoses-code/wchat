import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  AtSign,
  Calendar,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../config/api'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import Seo from '../components/Seo'
import countries from '../data/countries'
import dialCodes, {
  DEFAULT_DIAL,
  DEFAULT_COUNTRY,
  getFlag,
  combinePhone,
  RWANDA_PLACEHOLDER,
} from '../data/dialCodes'
import { formatHandle, normalizeUsernameInput } from '../utils/handle'

const today = new Date()
const MIN_AGE = 13
const maxDob = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate())
  .toISOString()
  .slice(0, 10)

const GENDERS = [
  { id: 'female', label: 'Female', emoji: '👩' },
  { id: 'male', label: 'Male', emoji: '👨' },
  { id: 'other', label: 'Other', emoji: '🧑' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say', emoji: '🙂' },
]

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('mode') === 'login' ? 'login' : 'register'
  const [tab, setTab] = useState(initialTab)

  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'login' || mode === 'register') setTab(mode)
  }, [searchParams])

  useEffect(() => {
    document.title = tab === 'login'
      ? 'Log in — Wchat'
      : 'Create your account — Wchat'
  }, [tab])

  return (
    <div className="min-h-dvh bg-white">
      <Seo
        title={tab === 'login' ? 'Log in | Wchat' : 'Create your account | Wchat'}
        description={tab === 'login'
          ? 'Sign in to Wchat to chat, call, share Reels, and catch up with your Circles.'
          : 'Create a Wchat account to join Circles, chat in real time, and share with your community.'}
        path="/auth"
      />
      <div className="mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-1 lg:grid-cols-[1.02fr_.98fr]">
        {/* ---------------------------------------------------------- brand side */}
        <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between bg-gradient-hero p-10 text-white xl:p-12">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-35 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-[color:var(--landing-blue)]/20 blur-3xl" />
          <div className="relative"><Logo size={42} textClassName="text-white" /></div>
          <div className="relative max-w-md">
            <p className="mb-3 inline-flex rounded-full border border-white/20 bg-slate-950/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
              Connect. Share. Belong.
            </p>
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
              Where chats become communities.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/80">
              Join Circles, share Reels and stories, Spark what you love, and grow together.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-white/90">
              {[
                { icon: <Users size={15} />, text: 'Circles and communities' },
                { icon: <Sparkles size={15} />, text: 'Reels, stories, and posts' },
                { icon: <MessageSquare size={15} />, text: 'Real-time chat and calls' },
                { icon: <ShieldCheck size={15} />, text: 'Verified, safer accounts' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/12">{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/65">Kigali · Rwanda · and beyond</p>
        </aside>

        {/* ----------------------------------------------------------- form side */}
        <main className="flex items-center justify-center px-4 py-3 sm:px-6 lg:px-8">
          <div className="w-full max-w-[440px]">
            <div className="mb-2 flex items-center justify-center lg:hidden"><Logo size={36} /></div>
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/90 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,.18)]">
              <div className="border-b border-slate-200/80 px-4 pt-3.5 pb-3 sm:px-5">
                <div className="mb-2.5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  <TabButton active={tab === 'register'} onClick={() => setTab('register')}>Create account</TabButton>
                  <TabButton active={tab === 'login'} onClick={() => setTab('login')}>Sign in</TabButton>
                </div>
                <h2 className="font-display text-[1.35rem] font-extrabold tracking-tight text-slate-950">
                  {tab === 'register' ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  {tab === 'register' ? 'Quick steps, one verification code.' : 'Sign in with email, phone, or username.'}
                </p>
              </div>

              <div className="px-4 py-3.5 sm:px-5">
                {tab === 'register' ? (
                  <RegisterFlow onSwitch={() => setTab('login')} />
                ) : (
                  <LoginForm
                    initialView={searchParams.get('view') === 'reset' ? 'reset' : searchParams.get('view') === 'forgot' ? 'forgot' : 'login'}
                    initialResetIdentifier={searchParams.get('identifier') || ''}
                    onSwitch={() => setTab('register')}
                  />
                )}
              </div>
            </div>
            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-slate-500">
              By continuing you agree to keep Wchat kind: no spam, no scams, no harassment.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[0.7rem] py-1.5 text-[13px] font-semibold transition ${
        active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------- login */

function LoginForm({ onSwitch, initialView = 'login', initialResetIdentifier = '' }) {
  const { login, forgotPassword, resetPassword, loading } = useAuth()
  const [mode, setMode] = useState(initialView)
  const [identifier, setIdentifier] = useState(initialResetIdentifier)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [destination, setDestination] = useState('')
  const [devCode, setDevCode] = useState('')

  useEffect(() => { setMode(initialView) }, [initialView])
  useEffect(() => { if (initialResetIdentifier) setIdentifier(initialResetIdentifier) }, [initialResetIdentifier])

  const submitLogin = async (event) => {
    event.preventDefault()
    if (!identifier.trim() || !password) return toast.error('Enter your login details to continue')
    try { await login(identifier.trim(), password) } catch {}
  }

  const submitForgot = async (event) => {
    event.preventDefault()
    if (!identifier.trim()) return toast.error('Enter the email or phone number on your account')
    try {
      const data = await forgotPassword(identifier.trim())
      setDestination(data?.destination || '')
      setDevCode(data?.devCode || '')
      if (data?.devCode) toast('Dev mode code: ' + data.devCode, { icon: '🔑', duration: 12000 })
      setMode('reset')
    } catch {}
  }

  const submitReset = async (event) => {
    event.preventDefault()
    if (!code.trim()) return toast.error('Enter the code we sent you')
    if (newPassword.length < 6) return toast.error('Your new password must be at least 6 characters')
    if (newPassword !== confirmPassword) return toast.error('The two passwords do not match')
    try {
      await resetPassword({ identifier: identifier.trim(), code: code.trim(), newPassword })
      setPassword(''); setCode(''); setNewPassword(''); setConfirmPassword(''); setShowPassword(false); setMode('login')
    } catch {}
  }

  if (mode === 'forgot') {
    return (
      <form onSubmit={submitForgot} className="space-y-2.5">
        <BackButton onClick={() => setMode('login')}>Back to sign in</BackButton>
        <InfoBox>Enter the email address or phone number linked to your account. We’ll send a 6-digit code to reset your password.</InfoBox>
        <Field label="Email or phone number">
          <div className="relative"><AtSign size={15} className="icon-left" />
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com · +250788123456" autoComplete="username" className={inputClass + ' pl-9'} />
          </div>
        </Field>
        <PrimaryButton type="submit" loading={loading}>Send reset code</PrimaryButton>
      </form>
    )
  }

  if (mode === 'reset') {
    return (
      <form onSubmit={submitReset} className="space-y-2.5">
        <BackButton onClick={() => setMode('login')}>Back to sign in</BackButton>
        <InfoBox compact>
          {(destination ? 'Code sent to ' + destination + '.' : 'If that account exists, a reset code is on its way.')} Expires in 10 minutes.
          {devCode ? <span className="mt-1 block font-semibold text-slate-900">Development code: {devCode}</span> : null}
        </InfoBox>
        <Field label="6-digit code">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" className={inputClass + ' text-center font-bold tracking-[0.35em]'} />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="New password"><PasswordInput value={newPassword} onChange={setNewPassword} visible={showPassword} onToggle={() => setShowPassword(v => !v)} autoComplete="new-password" /></Field>
          <Field label="Confirm"><PasswordInput value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} onToggle={() => setShowPassword(v => !v)} autoComplete="new-password" /></Field>
        </div>
        <PrimaryButton type="submit" loading={loading}>Reset password</PrimaryButton>
      </form>
    )
  }

  return (
    <form onSubmit={submitLogin} className="space-y-2.5">
      <Field label="Email, phone number, or username">
        <div className="relative"><AtSign size={15} className="icon-left" />
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com · +250788123456 · keza" autoComplete="username" className={inputClass + ' pl-9'} />
        </div>
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword(v => !v)} autoComplete="current-password" />
      </Field>
      <div className="-mt-0.5 text-right">
        <button type="button" onClick={() => { setDestination(''); setDevCode(''); setMode('forgot') }} className="text-[12px] font-semibold text-[color:var(--wchat-primary)] hover:underline">Forgot password?</button>
      </div>
      <PrimaryButton type="submit" loading={loading}>Sign in</PrimaryButton>
      <p className="pt-0.5 text-center text-[13px] text-slate-600">
        New to Wchat? <button type="button" onClick={onSwitch} className="font-semibold text-[color:var(--wchat-primary)] hover:underline">Create an account</button>
      </p>
    </form>
  )
}

/* ----------------------------------------------------------------- register */

const STEPS = ['You', 'Profile', 'Account', 'Verify']

function RegisterFlow({ onSwitch }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    firstName: '', lastName: '', username: '', gender: '', dateOfBirth: '',
    email: '', phoneNumber: '', password: '', confirmPassword: '', country: DEFAULT_COUNTRY,
  })
  const [dialIso, setDialIso] = useState('RW')
  const [showPassword, setShowPassword] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [usernameReason, setUsernameReason] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [channels, setChannels] = useState({ email: true, sms: true, devMode: true })
  const [pending, setPending] = useState(null)
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const otpRef = useRef(null)
  const { requestRegistration, verifyRegistration, resendVerification, loading } = useAuth()

  const dial = dialCodes.find((entry) => entry.iso === dialIso)?.dial || DEFAULT_DIAL
  const phonePlaceholder = dial === DEFAULT_DIAL ? RWANDA_PLACEHOLDER : 'Phone number'
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  useEffect(() => {
    api.get('/auth/channels').then(({ data }) => setChannels({ email: data?.email !== false, sms: data?.sms !== false, devMode: data?.devMode !== false })).catch(() => {})
  }, [])

  const fetchSuggestions = useCallback(async (firstName, lastName) => {
    if (firstName.trim().length < 2 || lastName.trim().length < 2) return
    try { const { data } = await api.get('/auth/usernames', { params: { firstName, lastName } }); setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []) } catch {}
  }, [])

  useEffect(() => {
    if (step !== 0 || form.username) return undefined
    const timer = setTimeout(() => fetchSuggestions(form.firstName, form.lastName), 450)
    return () => clearTimeout(timer)
  }, [form.firstName, form.lastName, form.username, step, fetchSuggestions])

  useEffect(() => {
    const username = form.username
    if (!username) { setUsernameStatus('idle'); setUsernameReason(''); return undefined }
    if (username.length < 3) { setUsernameStatus('invalid'); return undefined }
    setUsernameStatus('checking'); setUsernameReason('')
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/users/check-username/' + encodeURIComponent(username))
        if (cancelled) return
        if (data?.available) setUsernameStatus('available')
        else { setUsernameStatus('taken'); if (data?.reason) setUsernameReason(data.reason) }
      } catch { if (!cancelled) setUsernameStatus('error') }
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [form.username])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown(v => Math.max(0, v - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const applyCountry = (name) => {
    setForm(prev => ({ ...prev, country: name }))
    const match = dialCodes.find(e => e.name === name)
    if (match) setDialIso(match.iso)
  }
  const applyDial = (iso) => {
    setDialIso(iso)
    const match = dialCodes.find(e => e.iso === iso)
    if (match && countries.includes(match.name)) setForm(prev => ({ ...prev, country: match.name }))
  }

  const validateStep = () => {
    if (step === 0) {
      if (!form.firstName.trim() || !form.lastName.trim()) { toast.error('Please enter your first and last name'); return false }
      if (!form.username || usernameStatus === 'invalid') { toast.error('Pick a username of at least 3 characters'); return false }
      if (usernameStatus === 'taken') { toast.error(usernameReason || 'That username is already taken'); return false }
    }
    if (step === 1) {
      if (!form.gender) { toast.error('Please select your gender'); return false }
      if (!form.dateOfBirth) { toast.error('Please enter your date of birth'); return false }
      if (form.dateOfBirth > maxDob) { toast.error('You must be at least ' + MIN_AGE + ' years old'); return false }
    }
    if (step === 2) {
      if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(form.email.trim())) { toast.error('Please enter a valid email address'); return false }
      const digits = form.phoneNumber.replace(/\\D/g, '')
      if (!digits) { toast.error('Please enter your phone number'); return false }
      if (dial === DEFAULT_DIAL && digits.length !== 9) { toast.error('Enter a 9-digit Rwandan number, e.g. 788 123 456'); return false }
      if (dial !== DEFAULT_DIAL && digits.length < 6) { toast.error('Please enter a valid phone number'); return false }
      if (!form.country) { toast.error('Please select your country'); return false }
      if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return false }
      if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return false }
    }
    return true
  }

  const goNext = () => { if (validateStep()) setStep(v => Math.min(3, v + 1)) }
  const buildPayload = (channel) => ({
    firstName: form.firstName.trim(), lastName: form.lastName.trim(), username: form.username,
    gender: form.gender, dateOfBirth: form.dateOfBirth, email: form.email.trim(),
    phoneNumber: combinePhone(dial, form.phoneNumber), password: form.password, country: form.country, channel,
  })

  const sendCode = async (channel) => {
    setSending(true)
    try {
      const data = await requestRegistration(buildPayload(channel))
      setPending(data); setOtp(''); setCooldown(data?.resendInSeconds || 60)
      if (data?.devCode) toast('Dev mode code: ' + data.devCode, { icon: '🔑', duration: 12000 })
      else toast.success('Code sent to ' + data?.destination)
      setTimeout(() => otpRef.current?.focus(), 120)
    } catch {} finally { setSending(false) }
  }

  const resend = async () => {
    if (!pending?.identifier) return
    try {
      const data = await resendVerification(pending.identifier)
      setPending(prev => ({ ...prev, ...data })); setCooldown(data?.resendInSeconds || 60)
      if (data?.devCode) toast('Dev mode code: ' + data.devCode, { icon: '🔑', duration: 12000 })
      else toast.success('A new code is on its way')
    } catch {}
  }

  const confirm = async (event) => {
    event.preventDefault()
    if (otp.replace(/\\D/g, '').length !== 6) return toast.error('Enter the 6-digit code')
    try { await verifyRegistration({ identifier: pending.identifier, code: otp.trim() }) }
    catch { setOtp(''); otpRef.current?.focus() }
  }

  const usernameHint = useMemo(() => {
    switch (usernameStatus) {
      case 'checking': return <span className="flex items-center gap-1.5 text-slate-500"><Loader2 size={11} className="animate-spin" /> Checking…</span>
      case 'available': return <span className="flex items-center gap-1.5 text-emerald-600"><Check size={11} /> {formatHandle(form.username)} is available</span>
      case 'taken': return <span className="flex items-center gap-1.5 text-rose-600"><X size={11} /> {usernameReason || (formatHandle(form.username) + ' is taken')}</span>
      case 'invalid': return <span className="text-rose-600">3+ characters: letters, numbers, . or _</span>
      case 'error': return <span className="text-amber-700">Couldn’t check now — we’ll verify on submit</span>
      default: return <span className="text-slate-500">Your handle, e.g. keza</span>
    }
  }, [usernameStatus, usernameReason, form.username])

  return (
    <div className="space-y-2.5">
      <div className="flex gap-1.5">
        {STEPS.map((label, index) => (
          <div key={label} className="flex-1">
            <div className={'h-1.5 rounded-full transition-colors ' + (index <= step ? 'bg-gradient-brand' : 'bg-slate-200')} />
            <span className={'mt-1 block text-[10px] font-semibold ' + (index === step ? 'text-slate-800' : 'text-slate-400')}>{label}</span>
          </div>
        ))}
      </div>

      {step === 0 ? (
        <div className="animate-fade-in space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Field label="First name"><input value={form.firstName} onChange={set('firstName')} placeholder="Keza" autoComplete="given-name" className={inputClass} /></Field>
            <Field label="Last name"><input value={form.lastName} onChange={set('lastName')} placeholder="Mugisha" autoComplete="family-name" className={inputClass} /></Field>
          </div>
          <Field label="Username" hint={usernameHint}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[color:var(--wchat-primary)]">@</span>
              <input value={form.username} onChange={(e) => setForm(prev => ({ ...prev, username: normalizeUsernameInput(e.target.value) }))} placeholder="keza" autoComplete="off" className={inputClass + ' pl-8'} />
            </div>
          </Field>
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 4).map(s => (
                <button key={s} type="button" onClick={() => setForm(prev => ({ ...prev, username: s }))} className={'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ' + (form.username === s ? 'border-transparent bg-gradient-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[color:var(--wchat-primary)]/35')}>@{s}</button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="animate-fade-in space-y-2.5">
          <Field label="Gender">
            <div className="grid grid-cols-4 gap-1.5">
              {GENDERS.map(option => (
                <button key={option.id} type="button" onClick={() => setForm(prev => ({ ...prev, gender: option.id }))} className={'rounded-xl border px-1 py-1.5 text-center text-[10px] font-semibold leading-tight transition ' + (form.gender === option.id ? 'border-transparent bg-gradient-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[color:var(--wchat-primary)]/35')}>
                  <span className="block text-[13px] leading-none">{option.emoji}</span>
                  <span className="mt-0.5 block">{option.label}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Date of birth">
            <div className="relative"><Calendar size={14} className="icon-left" />
              <input type="date" max={maxDob} value={form.dateOfBirth} onChange={set('dateOfBirth')} className={inputClass + ' pl-9'} />
            </div>
          </Field>
          <p className="text-[11px] text-slate-500">Used for age-appropriate features. Social sign-in can be added later.</p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="animate-fade-in space-y-2.5">
          <Field label="Email">
            <div className="relative"><Mail size={14} className="icon-left" />
              <input type="email" value={form.email} onChange={set('email')} placeholder="keza@example.com" autoComplete="email" className={inputClass + ' pl-9'} />
            </div>
          </Field>
          <Field label="Phone number" hint={<span className="text-slate-500">{dial} · {dialCodes.find(e => e.iso === dialIso)?.name}</span>}>
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <select value={dialIso} onChange={(e) => applyDial(e.target.value)} aria-label="Country calling code" className={inputClass + ' w-[6.5rem] appearance-none pr-5 text-[13px]'}>
                  {dialCodes.map(entry => <option key={entry.iso} value={entry.iso}>{getFlag(entry.iso)} {entry.dial}</option>)}
                </select>
                <ChevronDown size={13} className="icon-right" />
              </div>
              <input value={form.phoneNumber} onChange={(e) => setForm(prev => ({ ...prev, phoneNumber: e.target.value.replace(/[^\d ]/g, '').slice(0, 12) }))} placeholder={phonePlaceholder} inputMode="tel" autoComplete="tel-national" className={inputClass} />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Country">
              <div className="relative"><Globe size={14} className="icon-left" />
                <select value={form.country} onChange={(e) => applyCountry(e.target.value)} className={inputClass + ' appearance-none pl-8 pr-6 text-[13px]'}>
                  <option value="">Country</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="icon-right" />
              </div>
            </Field>
            <Field label="Password"><PasswordInput value={form.password} onChange={(v) => setForm(prev => ({ ...prev, password: v }))} visible={showPassword} onToggle={() => setShowPassword(v => !v)} autoComplete="new-password" /></Field>
          </div>
          <Field label="Confirm password"><PasswordInput value={form.confirmPassword} onChange={(v) => setForm(prev => ({ ...prev, confirmPassword: v }))} visible={showPassword} onToggle={() => setShowPassword(v => !v)} autoComplete="new-password" /></Field>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="animate-fade-in space-y-2.5">
          <InfoBox compact>Choose where to receive your 6-digit code. Your account is created only after confirmation.</InfoBox>
          <div className="space-y-2">
            <ChannelOption active={pending?.channel === 'email'} disabled={sending || !(channels.email || channels.devMode)} icon={<Mail size={15} />} title="Email" subtitle={form.email} note={channels.email ? '' : channels.devMode ? 'dev mode: code shows on screen' : 'not available'} onClick={() => sendCode('email')} />
            <ChannelOption active={pending?.channel === 'sms'} disabled={sending || !(channels.sms || channels.devMode)} icon={<Phone size={15} />} title="SMS" subtitle={combinePhone(dial, form.phoneNumber)} note={channels.sms ? '' : channels.devMode ? 'dev mode: code shows on screen' : 'not available'} onClick={() => sendCode('sms')} />
          </div>
          {pending ? (
            <form onSubmit={confirm} className="space-y-2.5">
              <Field label="Verification code" hint={<span className="text-slate-500">Sent to {pending.destination}</span>}>
                <input ref={otpRef} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" className={inputClass + ' text-center text-lg font-bold tracking-[0.4em]'} />
              </Field>
              <PrimaryButton type="submit" loading={loading}>Verify & create account</PrimaryButton>
              <div className="text-center text-[11px] text-slate-500">
                Didn’t get it? <button type="button" onClick={resend} disabled={cooldown > 0} className="font-semibold text-[color:var(--wchat-primary)] hover:underline disabled:text-slate-400">{cooldown > 0 ? ('Resend in ' + cooldown + 's') : 'Resend'}</button>
                {' · '}<button type="button" onClick={() => setPending(null)} className="font-semibold text-slate-600 hover:underline">Change</button>
              </div>
            </form>
          ) : (
            <p className="text-center text-[11px] text-slate-500">Pick a method above to receive your code.</p>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(v => step === 3 ? 2 : v - 1)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:border-[color:var(--wchat-primary)]/35 hover:text-[color:var(--wchat-primary)]">
            <ArrowLeft size={14} /> Back
          </button>
        ) : null}
        {step < 3 ? (
          <button type="button" onClick={goNext} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-brand text-[13px] font-bold text-white shadow-glow transition hover:brightness-105">Continue</button>
        ) : null}
      </div>

      <p className="text-center text-[13px] text-slate-600">
        Already on Wchat? <button type="button" onClick={onSwitch} className="font-semibold text-[color:var(--wchat-primary)] hover:underline">Sign in</button>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ helpers */

function ChannelOption({ active, disabled, icon, title, subtitle, note, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition disabled:opacity-60 ' + (active ? 'border-[color:var(--wchat-primary)]/35 bg-[color:var(--wchat-primary-soft)]' : 'border-slate-200 bg-white hover:border-[color:var(--wchat-primary)]/30')}>
      <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' + (active ? 'bg-gradient-brand text-white' : 'bg-slate-100 text-slate-600')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">{title}{active ? <Check size={13} className="text-[color:var(--wchat-primary)]" /> : null}</span>
        <span className="block truncate text-[11px] text-slate-500">{subtitle}</span>
        {note ? <span className="block text-[10px] font-medium text-amber-700">{note}</span> : null}
      </span>
    </button>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-0.5 block text-[10px] leading-snug">{hint}</span> : null}
    </label>
  )
}

function PasswordInput({ value, onChange, visible, onToggle, autoComplete }) {
  return (
    <div className="relative">
      <Lock size={14} className="icon-left" />
      <input type={visible ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder="••••••••" autoComplete={autoComplete} className={inputClass + ' pl-8 pr-9'} />
      <button type="button" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-700">
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function PrimaryButton({ children, loading, type = 'button' }) {
  return (
    <button type={type} disabled={loading} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand text-[13px] font-bold text-white shadow-glow transition hover:brightness-105 disabled:opacity-60">
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

function BackButton({ onClick, children }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={14} /> {children}</button>
}

function InfoBox({ children, compact }) {
  return <div className={'rounded-xl border border-slate-200 bg-white leading-relaxed text-slate-700 ' + (compact ? 'px-3 py-2 text-[11px]' : 'px-3 py-2.5 text-[12px]')}>{children}</div>
}

const inputClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-[color:var(--wchat-primary)]/45 focus:ring-4 focus:ring-[color:var(--wchat-primary)]/10'
