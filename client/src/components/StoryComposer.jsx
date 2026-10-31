import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera,
  Check,
  ChevronDown,
  Eraser,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  Music,
  Pencil,
  Shield,
  Type,
  Users,
  Volume2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { getId } from '../utils/api'
import StorySticker, {
  STICKER_META,
  StickerEditor,
  TEXT_BACKGROUNDS,
} from './StoryStickers'
import MusicPicker from './MusicPicker'

const DRAW_COLORS = ['#ffffff', '#facc15', '#f43f5e', '#38bdf8', '#22c55e', '#000000']

const AUDIENCES = [
  { id: 'public', label: 'Public', hint: 'Anyone who follows you', Icon: Globe },
  { id: 'followers', label: 'Followers', hint: 'Your followers only', Icon: Users },
  { id: 'closeFriends', label: 'Close Friends', hint: 'Only your close friends', Icon: Lock },
]

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60'

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-zinc-200">{label}</span>
        {hint ? <span className="block text-[10px] text-zinc-500">{hint}</span> : null}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? 'bg-amber-400' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

/** Search people and add them to a list of chips. */
function PeoplePicker({ label, hint, selected, onChange }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const query = term.trim()
    if (!query) {
      setResults([])
      return undefined
    }
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/users', { params: { search: query } })
        if (active) setResults(Array.isArray(data) ? data : [])
      } catch {
        if (active) setResults([])
      } finally {
        if (active) setLoading(false)
      }
    }, 280)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [term])

  const add = (user) => {
    if (selected.some((item) => String(item._id) === String(user._id))) return
    onChange([...selected, user])
    setTerm('')
    setResults([])
  }

  const remove = (id) => onChange(selected.filter((item) => String(item._id) !== String(id)))

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-zinc-400">{label}</label>
        {hint ? <span className="text-[10px] text-zinc-600">{hint}</span> : null}
      </div>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <span
              key={getId(user)}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200"
            >
              {user.username ? `@${user.username}` : `${user.firstName || ''} ${user.lastName || ''}`.trim()}
              <button type="button" onClick={() => remove(getId(user))} className="text-zinc-500 hover:text-rose-300">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search people…"
        className={inputClass}
      />
      {loading ? <p className="text-[10px] text-zinc-500">Searching…</p> : null}
      {results.length > 0 ? (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950">
          {results.map((user) => (
            <button
              key={getId(user)}
              type="button"
              onClick={() => add(user)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-900"
            >
              <span className="min-w-0 truncate">
                {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                <span className="ml-1 text-[10px] text-zinc-500">@{user.username}</span>
              </span>
              <span className="text-amber-400">Add</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

export default function StoryComposer({ onClose, onCreated }) {
  const { user } = useAuth()
  const { chats } = useChat()
  const communities = chats.filter((chat) => chat.circleType !== 'personal')

  const [mode, setMode] = useState('media')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [mediaType, setMediaType] = useState('image')
  const [text, setText] = useState('')
  const [textStyle, setTextStyle] = useState({ background: '#7c3aed', color: '#ffffff' })
  const [caption, setCaption] = useState('')
  const [circleId, setCircleId] = useState('')
  const [stickers, setStickers] = useState([])
  const [editorType, setEditorType] = useState(null)
  const [busy, setBusy] = useState(false)

  const [music, setMusic] = useState(null)

  const [audience, setAudience] = useState(user?.preferences?.storyAudience || 'followers')
  const [allowReplies, setAllowReplies] = useState(
    user?.preferences?.storyAllowReplies !== false
  )
  const [allowMentions, setAllowMentions] = useState(
    user?.preferences?.storyAllowMentions !== false
  )
  const [closeFriends, setCloseFriends] = useState([])
  const [hideFrom, setHideFrom] = useState([])
  const [closeFriendsTouched, setCloseFriendsTouched] = useState(false)
  const [hideFromTouched, setHideFromTouched] = useState(false)
  const [privacyTouched, setPrivacyTouched] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  const [drawMode, setDrawMode] = useState(false)
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0])
  const [hasDrawing, setHasDrawing] = useState(false)

  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const previewRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  // Keep the drawing canvas the same pixel size as the preview box.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const parent = canvas.parentElement
    if (!parent) return undefined
    const resize = () => {
      const rect = parent.getBoundingClientRect()
      const snapshot = canvas.width && canvas.height ? canvas.toDataURL() : null
      canvas.width = Math.max(1, Math.round(rect.width))
      canvas.height = Math.max(1, Math.round(rect.height))
      if (snapshot) {
        const image = new Image()
        image.onload = () => {
          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        }
        image.src = snapshot
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [previewUrl, mode, mediaType])

  const pickFile = (picked) => {
    if (!picked) return
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
    setMediaType(picked.type?.startsWith('video/') ? 'video' : 'image')
    setMode('media')
    setDrawMode(false)
    setHasDrawing(false)
  }

  const clearDrawing = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawing(false)
  }

  const pointFromEvent = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const startDraw = (event) => {
    if (!drawMode) return
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const point = pointFromEvent(event)
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = drawColor
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    drawingRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveDraw = (event) => {
    if (!drawMode || !drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const point = pointFromEvent(event)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    setHasDrawing(true)
  }

  const endDraw = () => {
    drawingRef.current = false
  }

  const addSticker = (sticker) => {
    setStickers((prev) => {
      const index = prev.length
      const x = 30 + (index % 3) * 20
      const y = 28 + Math.floor(index / 3) * 16
      return [
        ...prev,
        { ...sticker, clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, x, y },
      ]
    })
    setEditorType(null)
  }

  const startDrag = (event, index) => {
    event.stopPropagation()
    event.preventDefault()
    dragRef.current = index
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveDrag = (event) => {
    if (dragRef.current === null || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const x = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(96, Math.max(4, ((event.clientY - rect.top) / rect.height) * 100))
    const index = dragRef.current
    setStickers((prev) => prev.map((item, i) => (i === index ? { ...item, x, y } : item)))
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const composeMedia = async () => {
    if (!file || mediaType !== 'image' || !hasDrawing || !canvasRef.current || !previewUrl) {
      return file
    }
    try {
      const image = await loadImage(previewUrl)
      const out = document.createElement('canvas')
      out.width = image.naturalWidth || image.width
      out.height = image.naturalHeight || image.height
      const ctx = out.getContext('2d')
      ctx.drawImage(image, 0, 0, out.width, out.height)
      ctx.drawImage(canvasRef.current, 0, 0, out.width, out.height)
      const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.92))
      if (!blob) return file
      return new File([blob], 'story.jpg', { type: 'image/jpeg' })
    } catch {
      return file
    }
  }

  const submit = async () => {
    const cleanText = mode === 'text' ? text.trim() : ''
    if (mode === 'media' && !file) return toast.error('Choose a photo or video')
    if (mode === 'text' && !cleanText) return toast.error('Write something first')

    setBusy(true)
    try {
      const privacy = {}
      if (closeFriendsTouched) privacy.closeFriends = closeFriends.map((item) => getId(item))
      if (hideFromTouched) privacy.storyHideFrom = hideFrom.map((item) => getId(item))
      if (privacyTouched) {
        privacy.storyAllowReplies = allowReplies
        privacy.storyAllowMentions = allowMentions
      }
      if (Object.keys(privacy).length > 0) {
        await api.put('/auth/preferences', privacy)
      }

      const upload = mode === 'media' ? await composeMedia() : null
      const fd = new FormData()
      if (upload) fd.append('media', upload)
      if (cleanText) fd.append('text', cleanText)
      fd.append('mediaType', upload ? mediaType : 'text')
      fd.append('textStyle', JSON.stringify(textStyle))
      fd.append('caption', caption)
      if (circleId) fd.append('circleId', circleId)
      if (music) fd.append('music', JSON.stringify(music))
      fd.append('audience', audience)
      fd.append('allowReplies', String(allowReplies))
      fd.append('allowMentions', String(allowMentions))
      fd.append(
        'stickers',
        JSON.stringify(stickers.map(({ clientId, ...rest }) => rest))
      )

      const { data } = await api.post('/stories', fd)
      toast.success('Story posted')
      onCreated?.(data)
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not create story'))
    } finally {
      setBusy(false)
    }
  }

  const audienceMeta = AUDIENCES.find((item) => item.id === audience) || AUDIENCES[1]

  return (
    <div className="animate-scale-in flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-100">New story</h3>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-900/60 p-1">
          <button
            type="button"
            onClick={() => setMode('media')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'media' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'
            }`}
          >
            <ImageIcon size={14} /> Photo / Video
          </button>
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'text' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'
            }`}
          >
            <Type size={14} /> Text
          </button>
        </div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />

        {/* Preview */}
        <div
          ref={previewRef}
          className="relative mx-auto flex aspect-[9/16] max-h-[46vh] w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900"
        >
          {mode === 'media' && file ? (
            mediaType === 'video' ? (
              <video
                src={previewUrl}
                className="h-full w-full object-contain"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img src={previewUrl} alt="Story preview" className="h-full w-full object-contain" />
            )
          ) : mode === 'text' ? (
            <div
              className="flex h-full w-full items-center justify-center p-6 text-center"
              style={{ background: textStyle.background, color: textStyle.color }}
            >
              <p className="whitespace-pre-wrap break-words text-xl font-bold leading-snug">
                {text || 'Your text here…'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-600">
              <ImageIcon size={30} />
              <p className="text-xs">Pick a photo, video or write text</p>
            </div>
          )}

          {file && mediaType === 'image' ? (
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 z-10 h-full w-full touch-none ${
                drawMode ? 'cursor-crosshair' : 'pointer-events-none'
              }`}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
          ) : null}

          {stickers.map((sticker, index) => (
            <div
              key={sticker.clientId}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none"
              style={{ left: `${sticker.x}%`, top: `${sticker.y}%` }}
              onPointerDown={(event) => startDrag(event, index)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
            >
              <div className="relative">
                <StorySticker
                  sticker={sticker}
                  currentUserId={getId(user)}
                  preview
                  inline
                />
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    setStickers((prev) => prev.filter((_, i) => i !== index))
                  }}
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white shadow"
                  title="Remove sticker"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {mode === 'media' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-600"
            >
              <Camera size={15} className="text-amber-400" /> Camera
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-600"
            >
              <ImageIcon size={15} className="text-amber-400" /> Gallery
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Write your story…"
              className={`${inputClass} resize-none`}
            />
            <div className="flex flex-wrap gap-2">
              {TEXT_BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setTextStyle((prev) => ({ ...prev, background: color }))}
                  className={`h-7 w-7 rounded-full border-2 ${
                    textStyle.background === color ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ background: color }}
                  title="Background colour"
                />
              ))}
            </div>
          </div>
        )}

        {file && mediaType === 'image' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                drawMode
                  ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                  : 'border-zinc-800 text-zinc-300'
              }`}
            >
              <Pencil size={13} /> Draw
            </button>
            {drawMode ? (
              <>
                {DRAW_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDrawColor(color)}
                    className={`h-5 w-5 rounded-full border-2 ${
                      drawColor === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ background: color }}
                    title="Brush colour"
                  />
                ))}
                <button
                  type="button"
                  onClick={clearDrawing}
                  disabled={!hasDrawing}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
                >
                  <Eraser size={12} /> Clear
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {/* Sticker toolbar */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-zinc-400">Stickers</p>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {STICKER_META.map(({ type, label, Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setEditorType(type)}
                className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2 text-[10px] text-zinc-300 hover:border-amber-400/60"
              >
                <Icon size={15} className="text-amber-400" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Music */}
        <MusicPicker
          value={music}
          onChange={(track) => setMusic(track)}
          placeholder="Search songs…"
        />

        <select
          value={circleId}
          onChange={(event) => setCircleId(event.target.value)}
          className={inputClass}
        >
          <option value="">My timeline</option>
          {communities.map((chat) => (
            <option key={chat._id} value={chat._id}>
              {chat.chatName}
            </option>
          ))}
        </select>
        <input
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={300}
          placeholder="Caption (optional)"
          className={inputClass}
        />

        {/* Privacy */}
        <div className="rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setShowPrivacy((prev) => !prev)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
          >
            <Shield size={14} className="text-amber-400" />
            <span className="flex-1 text-xs font-semibold text-zinc-200">Story privacy</span>
            <span className="text-[10px] text-zinc-500">
              {audienceMeta.label}
              {closeFriends.length && audience === 'closeFriends'
                ? ` · ${closeFriends.length}`
                : ''}
            </span>
            <ChevronDown
              size={14}
              className={`text-zinc-500 transition ${showPrivacy ? 'rotate-180' : ''}`}
            />
          </button>
          {showPrivacy ? (
            <div className="space-y-3 border-t border-zinc-800 p-3">
              <div className="grid grid-cols-3 gap-1.5">
                {AUDIENCES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAudience(id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-semibold ${
                      audience === id
                        ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                        : 'border-zinc-800 text-zinc-400'
                    }`}
                    title={AUDIENCES.find((item) => item.id === id)?.hint}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500">{audienceMeta.hint}</p>

              <Toggle
                checked={allowReplies}
                label="Allow replies"
                hint="Followers can reply to this story in DMs"
                onChange={(value) => {
                  setAllowReplies(value)
                  setPrivacyTouched(true)
                }}
              />
              <Toggle
                checked={allowMentions}
                label="Allow mentions"
                hint="Others can @mention you in their stories"
                onChange={(value) => {
                  setAllowMentions(value)
                  setPrivacyTouched(true)
                }}
              />

              {audience === 'closeFriends' ? (
                <PeoplePicker
                  label="Close Friends"
                  hint="Only these people will see it"
                  selected={closeFriends}
                  onChange={(next) => {
                    setCloseFriends(next)
                    setCloseFriendsTouched(true)
                  }}
                />
              ) : null}

              <PeoplePicker
                label="Hide story from"
                hint="These people never see your stories"
                selected={hideFrom}
                onChange={(next) => {
                  setHideFrom(next)
                  setHideFromTouched(true)
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[10px] text-zinc-500">Disappears after 24 hours</p>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Share story
          </button>
        </div>
      </div>

      {editorType
        ? createPortal(
            <StickerEditor
              type={editorType}
              onClose={() => setEditorType(null)}
              onSave={addSticker}
            />,
            document.body
          )
        : null}
    </div>
  )
}
