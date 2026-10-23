import { useEffect, useRef, useState } from 'react'
import { Camera, Globe, Loader2, Lock, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

const ACCOUNT_TYPES = [
  { id: 'personal', label: 'Personal', hint: 'Friends and family' },
  { id: 'creator', label: 'Creator', hint: 'Public figures and influencers' },
  { id: 'business', label: 'Business', hint: 'Brands, shops and organisations' },
]

const inputClass =
  'w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-wchat/70 focus:ring-4 focus:ring-wchat/10'

/**
 * Edit the signed-in member's public profile.
 * Mirrors Instagram's "Edit profile": photo, name, username, bio (150),
 * category label, links (up to 5), account type and privacy.
 */
export default function EditProfileModal({ onClose }) {
  const { user, updateUser } = useAuth()
  const fileRef = useRef(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    bio: '',
    category: '',
    accountType: 'personal',
    isPrivate: false,
    showInSuggestions: true,
  })
  const [links, setLinks] = useState([])
  const [avatar, setAvatar] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      username: user.username || '',
      bio: user.bio || '',
      category: user.category || '',
      accountType: user.accountType || 'personal',
      isPrivate: Boolean(user.isPrivate),
      showInSuggestions: user.showInSuggestions !== false,
    })
    setLinks(Array.isArray(user.links) ? user.links.slice(0, 5) : [])
    setAvatar(user.profilePicture || '')
  }, [user])

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const addLink = () => {
    if (links.length >= 5) {
      toast.error('You can add up to 5 links')
      return
    }
    setLinks((prev) => [...prev, { title: '', url: '' }])
  }

  const updateLink = (index, key, value) =>
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)))

  const removeLink = (index) => setLinks((prev) => prev.filter((_, i) => i !== index))

  const pickAvatar = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const payload = new FormData()
      payload.append('profilePicture', file)
      const { data } = await api.put('/users/profile', payload)
      setAvatar(data.profilePicture)
      updateUser(data)
      toast.success('Photo updated')
    } catch (error) {
      toast.error(getApiError(error, 'Could not upload your photo'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const save = async () => {
    if (!form.firstName.trim()) return toast.error('First name is required')
    if (busy) return undefined
    setBusy(true)
    try {
      const payload = {
        ...form,
        bio: form.bio.slice(0, 150),
        links: links
          .map((l) => ({ title: (l.title || '').trim(), url: (l.url || '').trim() }))
          .filter((l) => l.url),
      }
      const { data } = await api.put('/users/profile', payload)
      updateUser(data)
      toast.success('Profile updated')
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not save your profile'))
    } finally {
      setBusy(false)
    }
    return undefined
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-scale-in flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-950 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Edit profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative rounded-full"
              title="Change photo"
            >
              <Avatar
                src={avatar}
                name={`${form.firstName} ${form.lastName}`}
                size={92}
              />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
                {uploadingAvatar ? (
                  <Loader2 className="animate-spin text-white" size={20} />
                ) : (
                  <Camera className="text-white" size={20} />
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs font-semibold text-wchat hover:underline"
            >
              Change profile photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={pickAvatar}
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input
                value={form.firstName}
                onChange={set('firstName')}
                className={inputClass}
                placeholder="First name"
              />
            </Field>
            <Field label="Last name">
              <input
                value={form.lastName}
                onChange={set('lastName')}
                className={inputClass}
                placeholder="Last name"
              />
            </Field>
          </div>

          <Field label="Username">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                @
              </span>
              <input
                value={form.username}
                onChange={set('username')}
                className={`${inputClass} pl-7`}
                placeholder="username"
              />
            </div>
          </Field>

          <Field label={`Bio (${form.bio.length}/150)`}>
            <textarea
              value={form.bio}
              onChange={(event) => setForm((f) => ({ ...f, bio: event.target.value.slice(0, 150) }))}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Tell people about yourself"
            />
          </Field>

          <Field label="Category label">
            <input
              value={form.category}
              onChange={set('category')}
              maxLength={40}
              className={inputClass}
              placeholder="Digital Creator, Entrepreneur, Photographer…"
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Links ({links.length}/5)
              </span>
              {links.length < 5 ? (
                <button
                  type="button"
                  onClick={() => setLinks((l) => [...l, { title: '', url: '' }])}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-wchat hover:underline"
                >
                  <Plus size={12} /> Add link
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              {links.length === 0 ? (
                <p className="text-xs text-zinc-600">Add up to 5 links to your profile.</p>
              ) : null}
              {links.map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={link.title || ''}
                    onChange={(event) =>
                      setLinks((list) =>
                        list.map((l, i) =>
                          i === index ? { ...l, title: event.target.value } : l
                        )
                      )
                    }
                    placeholder="Label"
                    className="w-28 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-wchat/70"
                  />
                  <input
                    value={link.url || ''}
                    onChange={(event) =>
                      setLinks((list) =>
                        list.map((l, i) =>
                          i === index ? { ...l, url: event.target.value } : l
                        )
                      )
                    }
                    placeholder="https://…"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-wchat/70"
                  />
                  <button
                    type="button"
                    onClick={() => setLinks((list) => list.filter((_, i) => i !== index))}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                    aria-label="Remove link"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Account type
            </span>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((type) => {
                const on = form.accountType === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, accountType: id }))}
                    className={`rounded-xl border px-2 py-2.5 text-center transition ${
                      on
                        ? 'border-wchat bg-wchat/10 text-wchat'
                        : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{type.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-zinc-500">
                      {type.hint}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-800 p-3.5">
            <Toggle
              icon={form.isPrivate ? Lock : Globe}
              label="Private account"
              hint="Only people you approve can see your posts"
              checked={form.isPrivate}
              onChange={(v) => setForm((f) => ({ ...f, isPrivate: v }))}
            />
            <Toggle
              icon={Globe}
              label="Show in suggestions"
              hint="Let Wchat recommend your profile to similar people"
              checked={form.showInSuggestions}
              onChange={(v) => setForm((f) => ({ ...f, showInSuggestions: v }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-wchat px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function Toggle({ icon: Icon, label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 text-left"
    >
      <Icon size={17} className="shrink-0 text-zinc-500" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        <span className="block text-[11px] text-zinc-500">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-wchat' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}
