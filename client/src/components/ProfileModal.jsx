import { useEffect, useState } from 'react'
import { ChevronDown, Loader2, Save, UserCheck, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import countries from '../data/countries'
import dialCodes, {
  combinePhone,
  getFlag,
  splitPhoneNumber,
  DEFAULT_DIAL,
} from '../data/dialCodes'
import { formatLastSeen, getId, isUserOnline } from '../utils/api'
import { formatHandle, normalizeUsernameInput } from '../utils/handle'
import Avatar from './Avatar'
import ImagePicker, { useObjectUrl } from './ImagePicker'
import Modal, { ModalHeader } from './Modal'
import ProfileSocial from './ProfileSocial'

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export default function ProfileModal({ user: profileUser, onClose }) {
  const { user: authUser, updateUser } = useAuth()
  const { onlineUsers } = useSocket()

  const isSelf = getId(profileUser) === authUser?._id

  return isSelf ? (
    <SelfProfile
      user={authUser}
      updateUser={updateUser}
      onClose={onClose}
      online={onlineUsers.includes(authUser?._id)}
    />
  ) : (
    <OtherProfile user={profileUser} onClose={onClose} onlineUsers={onlineUsers} />
  )
}

/* ------------------------------------------------------------------ self view */
function SelfProfile({ user, updateUser, onClose, online }) {
  const initialPhone = splitPhoneNumber(user?.phoneNumber)
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    gender: user?.gender || 'prefer-not-to-say',
    email: user?.email || '',
    phoneNumber: initialPhone.local,
    dateOfBirth: toDateInput(user?.dateOfBirth),
    country: user?.address?.country || user?.country || '',
  })
  const [dialIso, setDialIso] = useState(
    dialCodes.find((entry) => entry.dial === initialPhone.dial)?.iso || 'RW'
  )
  const [picture, setPicture] = useState({
    file: null,
    preview: user?.profilePicture || '',
  })
  const [pictureError, setPictureError] = useState('')
  const [saving, setSaving] = useState(false)

  useObjectUrl(picture.preview)

  const dial = dialCodes.find((entry) => entry.iso === dialIso)?.dial || DEFAULT_DIAL

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Please enter a valid email address')
      return
    }
    setSaving(true)
    try {
      const fields = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username,
        gender: form.gender,
        email: form.email.trim(),
        phoneNumber: combinePhone(dial, form.phoneNumber),
        dateOfBirth: form.dateOfBirth,
        country: form.country,
      }

      let payload = fields
      if (picture.file) {
        const formData = new FormData()
        Object.entries(fields).forEach(([key, value]) => {
          formData.append(key, value ?? '')
        })
        formData.append('profilePicture', picture.file)
        payload = formData
      } else if (!picture.preview && user?.profilePicture) {
        // Picture was removed — clear it on the server.
        payload = { ...fields, profilePicture: '' }
      }

      const { data } = await api.put('/users/profile', payload)
      const updated = data?.user || data
      updateUser({ ...user, ...updated })
      toast.success('Profile updated')
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not update your profile'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} size="max-w-xl">
      <ModalHeader
        title="My profile"
        subtitle="Keep your details up to date"
        onClose={onClose}
      />
      <div className="space-y-5 px-5 py-5">
        <div className="flex items-center gap-4">
          <Avatar
            src={picture.preview}
            name={`${form.firstName} ${form.lastName}`}
            size={72}
            online={online}
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-zinc-100">
              {`${form.firstName} ${form.lastName}`.trim() || 'Unnamed'}
            </p>
            <p className="truncate text-sm font-semibold text-wchat">
              {formatHandle(user?.username)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <input
              value={form.firstName}
              onChange={set('firstName')}
              className={inputClass}
            />
          </Field>
          <Field label="Last name">
            <input
              value={form.lastName}
              onChange={set('lastName')}
              className={inputClass}
            />
          </Field>
          <Field label="Username" hint="You can change your handle — it must be unique">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-wchat">
                @
              </span>
              <input
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    username: normalizeUsernameInput(event.target.value),
                  }))
                }
                className={`${inputClass} pl-8`}
              />
            </div>
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={set('email')} className={inputClass} />
          </Field>
          <Field label="Phone number">
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <select
                  value={dialIso}
                  onChange={(event) => setDialIso(event.target.value)}
                  className={`${inputClass} w-28 appearance-none pr-7`}
                >
                  {dialCodes.map((entry) => (
                    <option key={entry.iso} value={entry.iso} title={entry.name}>
                      {getFlag(entry.iso)} {entry.dial}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
                />
              </div>
              <input
                value={form.phoneNumber}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    phoneNumber: event.target.value.replace(/[^\d ]/g, '').slice(0, 12),
                  }))
                }
                inputMode="tel"
                autoComplete="tel-national"
                className={inputClass}
              />
            </div>
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={set('dateOfBirth')}
              className={inputClass}
            />
          </Field>
          <Field label="Country">
            <select value={form.country} onChange={set('country')} className={inputClass}>
              <option value="">Select a country</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Profile picture">
            <ImagePicker
              preview={picture.preview}
              error={pictureError}
              disabled={saving}
              onSelect={(file, errorMessage) => {
                if (errorMessage) {
                  setPictureError(errorMessage)
                  return
                }
                setPictureError('')
                setPicture((prev) => ({
                  ...prev,
                  file,
                  preview: file ? URL.createObjectURL(file) : prev.preview,
                }))
              }}
              onRemove={() => {
                setPicture({ file: null, preview: '' })
                setPictureError('')
              }}
            />
          </Field>
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
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-300 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save changes
        </button>
      </div>
    </Modal>
  )
}

/* ----------------------------------------------------------------- other view */
function OtherProfile({ user, onClose, onlineUsers }) {
  const [following, setFollowing] = useState(false)
  const [counts, setCounts] = useState({ followersCount: 0, followingCount: 0 })
  const [socialOpen, setSocialOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const online = isUserOnline(user, onlineUsers)
  const targetId = getId(user)

  // Load the real relationship so the button never lies about being joined,
  // and surface the account's joins / following counts.
  useEffect(() => {
    if (!targetId) return undefined
    let cancelled = false
    api
      .get(`/users/${targetId}/social`)
      .then(({ data }) => {
        if (cancelled) return
        setFollowing(Boolean(data?.isFollowing))
        setCounts({
          followersCount: data?.followersCount || 0,
          followingCount: data?.followingCount || 0,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [targetId])

  const handleFollow = async () => {
    setBusy(true)
    try {
      const { data } = await api.post(`/users/${targetId}/follow`)
      const isFollowing = Array.isArray(data?.following)
        ? data.following.map(getId).includes(targetId)
        : Boolean(data?.following ?? !following)
      setFollowing(isFollowing)
      setCounts((prev) => ({
        ...prev,
        followersCount:
          typeof data?.followerCount === 'number'
            ? data.followerCount
            : prev.followersCount,
      }))
      toast.success(isFollowing ? 'Joined' : 'Left')
    } catch (error) {
      toast.error(getApiError(error, 'Could not update follow status'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} size="max-w-md">
      <ModalHeader title="Profile" onClose={onClose} />
      <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
        <Avatar
          src={user?.profilePicture}
          name={`${user?.firstName || ''} ${user?.lastName || ''}`}
          size={96}
          online={online}
        />
        <div>
          <p className="text-lg font-semibold text-zinc-100">
            {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
          </p>
          <p className="text-sm font-semibold text-wchat">
            {formatHandle(user?.username)}
          </p>
        </div>
        <p className={`text-xs ${online ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {online ? 'Online now' : formatLastSeen(user?.lastSeen)}
        </p>

        <div className="mt-1 flex items-center gap-6">
          <button
            type="button"
            onClick={() => setSocialOpen(true)}
            className="text-center transition hover:opacity-80"
            title="People who joined this profile"
          >
            <span className="block text-sm font-semibold text-zinc-100">
              {counts.followersCount}
            </span>
            <span className="block text-[11px] text-zinc-500">Joins</span>
          </button>
          <button
            type="button"
            onClick={() => setSocialOpen(true)}
            className="text-center transition hover:opacity-80"
            title="People this profile follows"
          >
            <span className="block text-sm font-semibold text-zinc-100">
              {counts.followingCount}
            </span>
            <span className="block text-[11px] text-zinc-500">Following</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleFollow}
          disabled={busy}
          className={`mt-2 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
            following
              ? 'border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
              : 'bg-amber-400 text-white hover:bg-amber-300'
          }`}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : following ? (
            <UserCheck size={16} />
          ) : (
            <UserPlus size={16} />
          )}
          {following ? 'Joined' : 'Join'}
        </button>
      </div>

      {socialOpen ? (
        <ProfileSocial userId={targetId} onClose={() => setSocialOpen(false)} />
      ) : null}
    </Modal>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/60 disabled:opacity-60'

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span> : null}
    </label>
  )
}
