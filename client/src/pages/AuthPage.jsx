import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [tab, setTab] = useState('register')

  useEffect(() => {
    document.title = 'Create Account | Wchat'
  }, [])

  return (
    <div className="min-h-screen bg-surface">
      <Seo
        title="Create Account | Wchat"
        description="Create a Wchat account to join Circles, chat in real time, and invite people with links or QR codes."
        path="/auth"
      />
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* ---------------------------------------------------------- brand side */}
        <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between wchat-gradient p-12 text-white">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <svg viewBox="0 0 48 48" width="26" height="26" fill="none">
                <circle cx="19" cy="24" r="7.5" stroke="white" strokeWidth="3.4" />
                <circle
                  cx="29"
                  cy="24"
                  r="7.5"
                  stroke="white"
                  strokeWidth="3.4"
                  opacity="0.72"
                />
              </svg>
            </span>
            <span className="text-2xl font-extrabold tracking-tight">Wchat</span>
          </div>

          <div className="relative max-w-md">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
              Your communities,
              <br />
              your circles.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/80">
              Join Circles of people who share your fields, share Loops and posts, Spark what you
              love and watch your Buzz grow. Built for Rwanda, made for everyone.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-white/90">
              {[
                { icon: <Users size={16} />, text: 'Circles — groups at the heart of Wchat' },
                { icon: <Sparkles size={16} />, text: 'Loops — short videos from your circles' },
                { icon: <MessageSquare size={16} />, text: 'Real-time chat, calls and voice notes' },
                { icon: <ShieldCheck size={16} />, text: 'Verified accounts, safer communities' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                    {item.icon}
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/60">Kigali · Rwanda · and beyond</p>
        </aside>

        {/* ----------------------------------------------------------- form side */}
        <main className="flex flex-col justify-center px-5 py-10 sm:px-8">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7 flex flex-col items-center gap-3 lg:hidden">
              <Logo size={46} tagline="Your communities, your circles" />
            </div>
            <div className="mb-6 hidden lg:block">
              <Logo size={44} showWord={false} />
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
                {tab === 'register' ? 'Create your Wchat account' : 'Welcome back'}
              </h2>
              <p className="mt-1 text-sm text-ink/55">
                {tab === 'register'
                  ? 'A few details, one verification code, and you are in.'
                  : 'Sign in with your email, phone number or username.'}
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-xl shadow-ink/5">
              <div className="grid grid-cols-2 gap-1 p-1.5">
                <TabButton active={tab === 'register'} onClick={() => setTab('register')}>
                  Create account
                </TabButton>
                <TabButton active={tab === 'login'} onClick={() => setTab('login')}>
                  Sign in
                </TabButton>
              </div>

              <div className="px-5 py-6 sm:px-7">
                {tab === 'register' ? (
                  <RegisterFlow onSwitch={() => setTab('login')} />
                ) : (
                  <LoginForm onSwitch={() => setTab('register')} />
                )}
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-ink/45">
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
      className={`rounded-2xl py-2.5 text-sm font-semibold transition ${
        active ? 'bg-wchat text-white shadow-sm shadow-wchat/30' : 'text-ink/55 hover:bg-surface'
      }`}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------- login */

function LoginForm({ onSwitch }) {
  const { login, loading } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!identifier.trim() || !password) {
      toast.error('Enter your login details to continue')
      return
    }
    try {
      await login(identifier.trim(), password)
    } catch {
      /* toast already shown */
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email, phone number or username">
        <div className="relative">
          <AtSign size={16} className="icon-left" />
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="you@example.com · +250 788 123 456 · keza"
            autoComplete="username"
            className={`${inputClass} pl-9`}
          />
        </div>
      </Field>

      <Field label="Password">
        <PasswordInput
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
          autoComplete="current-password"
        />
      </Field>

      <PrimaryButton type="submit" loading={loading}>
        Sign in
      </PrimaryButton>

      <p className="text-center text-sm text-ink/55">
        New to Wchat?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="font-semibold text-wchat hover:underline"
        >
          Create an account
        </button>
      </p>
    </form>
  )
}

/* ----------------------------------------------------------------- register */

const STEPS = ['About you', 'Account', 'Verify']

function RegisterFlow() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    gender: '',
    dateOfBirth: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    country: DEFAULT_COUNTRY,
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

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  /* --------------------------------------------------- which channels work */
  useEffect(() => {
    api
      .get('/auth/channels')
      .then(({ data }) =>
        setChannels({
          email: data?.email !== false,
          sms: data?.sms !== false,
          devMode: data?.devMode !== false,
        })
      )
      .catch(() => {})
  }, [])

  /* --------------------------------------------------- username suggestions */
  const fetchSuggestions = useCallback(async (firstName, lastName) => {
    if (firstName.trim().length < 2 || lastName.trim().length < 2) return
    try {
      const { data } = await api.get('/auth/usernames', { params: { firstName, lastName } })
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : [])
    } catch {
      /* suggestions are a nicety, never block the form */
    }
  }, [])

  useEffect(() => {
    if (step !== 0) return undefined
    if (form.username) return undefined
    const timer = setTimeout(() => fetchSuggestions(form.firstName, form.lastName), 450)
    return () => clearTimeout(timer)
  }, [form.firstName, form.lastName, form.username, step, fetchSuggestions])

  /* ----------------------------------------------- live availability check */
  useEffect(() => {
    const username = form.username
    if (!username) {
      setUsernameStatus('idle')
      return undefined
    }
    if (username.length < 3) {
      setUsernameStatus('invalid')
      return undefined
    }

    setUsernameStatus('checking')
    setUsernameReason('')

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users/check-username/${encodeURIComponent(username)}`)
        if (cancelled) return
        if (data?.available) {
          setUsernameStatus('available')
        } else {
          setUsernameStatus('taken')
          if (data?.reason) setUsernameReason(data.reason)
        }
      } catch {
        if (!cancelled) setUsernameStatus('error')
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [form.username])

  /* ------------------------------------------------------ resend countdown */
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const applyCountry = (name) => {
    setForm((prev) => ({ ...prev, country: name }))
    const match = dialCodes.find((entry) => entry.name === name)
    if (match) setDialIso(match.iso)
  }

  const applyDial = (iso) => {
    setDialIso(iso)
    const match = dialCodes.find((entry) => entry.iso === iso)
    if (match && countries.includes(match.name)) {
      setForm((prev) => ({ ...prev, country: match.name }))
    }
  }

  /* ------------------------------------------------------------ validations */
  const validateIdentity = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Please enter your first and last name')
      return false
    }
    if (!form.username || usernameStatus === 'invalid') {
      toast.error('Pick a username of at least 3 characters')
      return false
    }
    if (usernameStatus === 'taken') {
      toast.error(usernameReason || 'That username is already taken')
      return false
    }
    if (!form.gender) {
      toast.error('Please select your gender so we can set your avatar')
      return false
    }
    if (!form.dateOfBirth) {
      toast.error('Please enter your date of birth')
      return false
    }
    if (form.dateOfBirth > maxDob) {
      toast.error(`You must be at least ${MIN_AGE} years old to use Wchat`)
      return false
    }
    return true
  }

  const validateAccount = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Please enter a valid email address')
      return false
    }
    const digits = form.phoneNumber.replace(/\D/g, '')
    if (!digits) {
      toast.error('Please enter your phone number')
      return false
    }
    if (dial === DEFAULT_DIAL && digits.length !== 9) {
      toast.error('Enter a 9-digit Rwandan number, e.g. 788 123 456')
      return false
    }
    if (dial !== DEFAULT_DIAL && digits.length < 6) {
      toast.error('Please enter a valid phone number')
      return false
    }
    if (!form.country) {
      toast.error('Please select your country')
      return false
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return false
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return false
    }
    return true
  }

  const goNext = () => {
    if (step === 0 && !validateIdentity()) return
    if (step === 1 && !validateAccount()) return
    setStep((value) => Math.min(STEPS.length - 1, value + 1))
  }

  const buildPayload = (channel) => ({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    username: form.username,
    gender: form.gender,
    dateOfBirth: form.dateOfBirth,
    email: form.email.trim(),
    phoneNumber: combinePhone(dial, form.phoneNumber),
    password: form.password,
    country: form.country,
    channel,
  })

  const sendCode = async (channel) => {
    setSending(true)
    try {
      const data = await requestRegistration(buildPayload(channel))
      setPending(data)
      setOtp('')
      setCooldown(data?.resendInSeconds || 60)
      if (data?.devCode) {
        toast(`Dev mode code: ${data.devCode}`, { icon: '🔑', duration: 12000 })
      } else {
        toast.success(`Code sent to ${data?.destination}`)
      }
      setTimeout(() => otpRef.current?.focus(), 120)
    } catch {
      /* toast already shown */
    } finally {
      setSending(false)
    }
  }

  const resend = async () => {
    if (!pending?.identifier) return
    try {
      const data = await resendVerification(pending.identifier)
      setPending((prev) => ({ ...prev, ...data }))
      setCooldown(data?.resendInSeconds || 60)
      if (data?.devCode) {
        toast(`Dev mode code: ${data.devCode}`, { icon: '🔑', duration: 12000 })
      } else {
        toast.success('A new code is on its way')
      }
    } catch {
      /* toast already shown */
    }
  }

  const confirm = async (event) => {
    event.preventDefault()
    if (otp.replace(/\D/g, '').length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    try {
      // On success the token is stored and the app routes to the dashboard.
      await verifyRegistration({ identifier: pending.identifier, code: otp.trim() })
    } catch {
      setOtp('')
      otpRef.current?.focus()
    }
  }

  /* --------------------------------------------------------------- username */
  const usernameHint = useMemo(() => {
    switch (usernameStatus) {
      case 'checking':
        return (
          <span className="flex items-center gap-1.5 text-ink/50">
            <Loader2 size={12} className="animate-spin" /> Checking…
          </span>
        )
      case 'available':
        return (
          <span className="flex items-center gap-1.5 text-emerald-600">
            <Check size={12} /> {formatHandle(form.username)} is available
          </span>
        )
      case 'taken':
        return (
          <span className="flex items-center gap-1.5 text-rose-600">
            <X size={12} /> {usernameReason || `${formatHandle(form.username)} is taken`}
          </span>
        )
      case 'invalid':
        return <span className="text-rose-600">At least 3 characters: letters, numbers, '.' or '_'</span>
      case 'error':
        return <span className="text-amber-600">Couldn't check right now — we'll verify on submit</span>
      default:
        return <span className="text-ink/40">Your handle on Wchat, e.g. keza</span>
    }
  }, [usernameStatus, usernameReason, form.username])

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------------- steps */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                index < step
                  ? 'bg-wchat text-white'
                  : index === step
                    ? 'bg-ink text-white'
                    : 'bg-surface text-ink/40'
              }`}
            >
              {index < step ? <Check size={13} /> : index + 1}
            </span>
            <span
              className={`hidden text-[11px] font-semibold sm:block ${
                index === step ? 'text-ink' : 'text-ink/40'
              }`}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className={`h-0.5 flex-1 rounded-full ${index < step ? 'bg-wchat/40' : 'bg-line'}`} />
            ) : null}
          </li>
        ))}
      </ol>

      {/* ------------------------------------------------------------ step 0 */}
      {step === 0 ? (
        <div className="animate-fade-in space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input
                value={form.firstName}
                onChange={set('firstName')}
                placeholder="Keza"
                autoComplete="given-name"
                className={inputClass}
              />
            </Field>
            <Field label="Last name">
              <input
                value={form.lastName}
                onChange={set('lastName')}
                placeholder="Mugisha"
                autoComplete="family-name"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Username" hint={usernameHint}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-wchat">
                @
              </span>
              <input
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, username: normalizeUsernameInput(event.target.value) }))
                }
                placeholder="keza"
                autoComplete="off"
                className={`${inputClass} pl-8`}
              />
            </div>
          </Field>

          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="w-full text-[11px] font-medium uppercase tracking-wide text-ink/40">
                Suggestions for you
              </span>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, username: suggestion }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    form.username === suggestion
                      ? 'border-wchat bg-wchat text-white'
                      : 'border-line bg-white text-ink/70 hover:border-wchat hover:text-wchat'
                  }`}
                >
                  @{suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <Field label="Gender" hint={<span className="text-ink/40">We create an avatar to match</span>}>
            <div className="grid grid-cols-2 gap-2">
              {GENDERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, gender: option.id }))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                    form.gender === option.id
                      ? 'border-wchat bg-wchat-50 text-wchat-700'
                      : 'border-line bg-white text-ink/70 hover:border-wchat/40'
                  }`}
                >
                  <span aria-hidden>{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Date of birth" hint={<span className="text-ink/40">Used for age-appropriate features</span>}>
            <div className="relative">
              <Calendar size={15} className="icon-left" />
              <input
                type="date"
                max={maxDob}
                value={form.dateOfBirth}
                onChange={set('dateOfBirth')}
                className={`${inputClass} pl-9`}
              />
            </div>
          </Field>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ step 1 */}
      {step === 1 ? (
        <div className="animate-fade-in space-y-5">
          <Field label="Email">
            <div className="relative">
              <Mail size={15} className="icon-left" />
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="keza@example.com"
                autoComplete="email"
                className={`${inputClass} pl-9`}
              />
            </div>
          </Field>

          <Field
            label="Phone number"
            hint={
              <span className="text-ink/40">
                Country code {dial} · {dialCodes.find((entry) => entry.iso === dialIso)?.name}
              </span>
            }
          >
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <select
                  value={dialIso}
                  onChange={(event) => applyDial(event.target.value)}
                  aria-label="Country calling code"
                  className={`${inputClass} w-[7.5rem] appearance-none pr-7`}
                >
                  {dialCodes.map((entry) => (
                    <option key={entry.iso} value={entry.iso}>
                      {getFlag(entry.iso)} {entry.dial}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="icon-right" />
              </div>
              <input
                value={form.phoneNumber}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    phoneNumber: event.target.value.replace(/[^\d ]/g, '').slice(0, 12),
                  }))
                }
                placeholder={phonePlaceholder}
                inputMode="tel"
                autoComplete="tel-national"
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Country">
            <div className="relative">
              <Globe size={15} className="icon-left" />
              <select
                value={form.country}
                onChange={(event) => applyCountry(event.target.value)}
                className={`${inputClass} appearance-none pl-9 pr-8`}
              >
                <option value="">Select your country</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="icon-right" />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password">
              <PasswordInput
                value={form.password}
                onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm password">
              <PasswordInput
                value={form.confirmPassword}
                onChange={(value) => setForm((prev) => ({ ...prev, confirmPassword: value }))}
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                autoComplete="new-password"
              />
            </Field>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ step 2 */}
      {step === 2 ? (
        <div className="animate-fade-in space-y-5">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm font-semibold text-ink">Verify your account</p>
            <p className="mt-1 text-xs leading-relaxed text-ink/55">
              Choose where to receive your 6-digit code. Your account is created only after the
              code is confirmed.
            </p>
          </div>

          <div className="space-y-2">
            <ChannelOption
              active={pending?.channel === 'email'}
              disabled={sending || !(channels.email || channels.devMode)}
              icon={<Mail size={16} />}
              title="Email"
              subtitle={form.email}
              note={channels.email ? '' : channels.devMode ? 'dev mode: code shows on screen' : 'not available right now'}
              onClick={() => sendCode('email')}
            />
            <ChannelOption
              active={pending?.channel === 'sms'}
              disabled={sending || !(channels.sms || channels.devMode)}
              icon={<Phone size={16} />}
              title="SMS"
              subtitle={combinePhone(dial, form.phoneNumber)}
              note={channels.sms ? '' : channels.devMode ? 'dev mode: code shows on screen' : 'not available right now'}
              onClick={() => sendCode('sms')}
            />
          </div>

          {pending ? (
            <form onSubmit={confirm} className="animate-fade-in space-y-4">
              <Field
                label="Verification code"
                hint={
                  <span className="text-ink/45">
                    Sent to {pending.destination}
                    {pending.devCode ? ' · dev code shown in the toast' : ''}
                  </span>
                }
              >
                <input
                  ref={otpRef}
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-center text-2xl font-bold tracking-[0.5em] text-ink outline-none transition focus:border-wchat focus:ring-4 focus:ring-wchat/10"
                />
              </Field>

              <PrimaryButton type="submit" loading={loading}>
                Verify &amp; create my account
              </PrimaryButton>

              <div className="text-center text-xs text-ink/50">
                Didn't get it?{' '}
                <button
                  type="button"
                  onClick={resend}
                  disabled={cooldown > 0}
                  className="font-semibold text-wchat hover:underline disabled:cursor-not-allowed disabled:text-ink/30"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>{' '}
                ·{' '}
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="font-semibold text-ink/70 hover:underline"
                >
                  Change method
                </button>
              </div>
            </form>
          ) : (
            <p className="text-center text-xs text-ink/45">
              Pick a method above to receive your code.
            </p>
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ controls */}
      {step < 2 ? (
        <div className="flex items-center gap-3 pt-1">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((value) => value - 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink/70 transition hover:border-wchat/40 hover:text-wchat"
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={goNext}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-wchat py-3 text-sm font-semibold text-white shadow-lg shadow-wchat/25 transition hover:bg-wchat-600"
          >
            Continue
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 transition hover:text-wchat"
        >
          <ArrowLeft size={15} /> Back to my details
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ helpers */

function ChannelOption({ active, disabled, icon, title, subtitle, note, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
        active ? 'border-wchat bg-wchat-50' : 'border-line bg-white hover:border-wchat/50'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          active ? 'bg-wchat text-white' : 'bg-surface text-ink/60'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {title}
          {active ? <Check size={14} className="text-wchat" /> : null}
        </span>
        <span className="block truncate text-xs text-ink/50">{subtitle}</span>
        {note ? <span className="block text-[11px] text-amber-600">{note}</span> : null}
      </span>
    </button>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink/45">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px]">{hint}</span> : null}
    </label>
  )
}

function PasswordInput({ value, onChange, visible, onToggle, autoComplete }) {
  return (
    <div className="relative">
      <Lock size={15} className="icon-left" />
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="••••••••"
        autoComplete={autoComplete}
        className={`${inputClass} pl-9 pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink/40 transition hover:text-ink"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

function PrimaryButton({ children, loading, type = 'button' }) {
  return (
    <button
      type={type}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-wchat py-3 text-sm font-semibold text-white shadow-lg shadow-wchat/25 transition hover:bg-wchat-600 disabled:opacity-60"
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder-ink/35 outline-none transition focus:border-wchat focus:ring-4 focus:ring-wchat/10'
