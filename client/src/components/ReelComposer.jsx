import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  ArrowDown,
  ArrowUp,
  Captions,
  Clapperboard,
  Film,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Mic,
  Music,
  Plus,
  Scissors,
  Sparkles,
  Timer,
  Trash2,
  Type,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'
import { useChat } from '../context/ChatContext'
import ReelPlayer, { clipDuration } from './ReelPlayer'

/** Instagram-style filter presets. Stored as the CSS filter string. */
export const REEL_FILTERS = [
  { id: 'original', label: 'Original', css: 'none' },
  { id: 'aden', label: 'Aden', css: 'saturate(1.15) contrast(0.95) brightness(1.08)' },
  { id: 'clarendon', label: 'Clarendon', css: 'saturate(1.4) contrast(1.12) brightness(1.05)' },
  { id: 'gingham', label: 'Gingham', css: 'saturate(0.85) contrast(0.95) brightness(1.1)' },
  { id: 'juno', label: 'Juno', css: 'saturate(1.5) contrast(1.05) hue-rotate(-12deg)' },
  { id: 'lark', label: 'Lark', css: 'saturate(1.1) contrast(0.92) brightness(1.12)' },
  { id: 'moon', label: 'Moon', css: 'grayscale(1) contrast(1.1) brightness(1.06)' },
  { id: 'reyes', label: 'Reyes', css: 'sepia(0.35) contrast(0.92) brightness(1.15) saturate(0.85)' },
  { id: 'valencia', label: 'Valencia', css: 'sepia(0.2) saturate(1.3) brightness(1.08)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.3) brightness(0.95)' },
]

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const MAX_CLIPS = 10
const MAX_TOTAL_SECONDS = 180

/** Hands-free capture: the countdown before the camera opens, and the cap
 * applied to each clip so nobody has to touch the trim handles. */
const COUNTDOWNS = [0, 3, 10]
const HANDS_FREE = [0, 15, 30, 60]

/** Starter structures. `clips`/`seconds` are guidance for the editor, `speed`
 * and `captions` seed the Reel so people can shoot to the template. */
const REEL_TEMPLATES = [
  {
    id: 'free',
    name: 'Freeform',
    description: 'No structure — build it your way',
    clips: 0,
    seconds: 0,
    filter: 'original',
    captions: [],
  },
  {
    id: 'single',
    name: 'Single take',
    description: 'One unbroken clip',
    clips: 1,
    seconds: 30,
    filter: 'original',
    captions: [],
  },
  {
    id: 'tutorial',
    name: 'Tutorial',
    description: 'Three clips, one step each',
    clips: 3,
    seconds: 10,
    filter: 'clarendon',
    captions: ['Step 1', 'Step 2', 'Step 3'],
  },
  {
    id: 'beforeafter',
    name: 'Before / After',
    description: 'Two clips that flip',
    clips: 2,
    seconds: 8,
    filter: 'aden',
    captions: ['Before', 'After'],
  },
  {
    id: 'beat',
    name: 'Beat sync',
    description: 'Five quick cuts, sped to 1.5×',
    clips: 5,
    seconds: 6,
    filter: 'juno',
    speed: 1.5,
    captions: [],
  },
  {
    id: 'story',
    name: 'Mini story',
    description: 'A hook, the middle, a close',
    clips: 4,
    seconds: 12,
    filter: 'lark',
    captions: ['Wait for it…', '', '', 'Save this'],
  },
]

const inputClass =
  'w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-wchat/70 focus:ring-4 focus:ring-wchat/10'

const uid = () => Math.random().toString(36).slice(2, 9)

/** Reads a video file's duration without attaching it to the DOM. */
function readDuration(src) {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 0)
    el.onerror = () => resolve(0)
    el.src = src
  })
}

/**
 * The full Reels editor.
 *
 * Clips · trim · speed · filters · cover frame · music/original audio ·
 * timed text overlays · caption & hashtags · Circle + visibility.
 */
export default function ReelComposer({ onClose, onCreated }) {
  const { chats } = useChat()
  const communities = useMemo(
    () => chats.filter((chat) => chat.circleType !== 'personal'),
    [chats]
  )

  const clipInputRef = useRef(null)
  const recordInputRef = useRef(null)
  const audioInputRef = useRef(null)

  const [chatId, setChatId] = useState('')
  const [clips, setClips] = useState([])
  const [activeClip, setActiveClip] = useState(0)
  const [globalFilter, setGlobalFilter] = useState('original')
  const [coverTime, setCoverTime] = useState(0)
  const [music, setMusic] = useState(null) // { file, url, name }
  const [overlays, setOverlays] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [location, setLocation] = useState('')
  const [visibility, setVisibility] = useState('circle')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [countdownLeft, setCountdownLeft] = useState(null)
  const [handsFree, setHandsFree] = useState(0)
  const [templateId, setTemplateId] = useState('free')
  const [guides, setGuides] = useState(false)
  const [snap, setSnap] = useState(true)
  const [captionScript, setCaptionScript] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  const template = useMemo(
    () => REEL_TEMPLATES.find((t) => t.id === templateId) || REEL_TEMPLATES[0],
    [templateId]
  )

  useEffect(() => {
    if (!chatId && communities[0]) setChatId(communities[0]._id)
  }, [communities, chatId])

  // Release object URLs when the composer closes.
  useEffect(
    () => () => {
      clips.forEach((clip) => URL.revokeObjectURL(clip.url))
      if (music) URL.revokeObjectURL(music.url)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const addFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter((file) => file.type.startsWith('video/'))
      if (files.length === 0) return
      setAdding(true)

      // Hands-free length wins; otherwise a template's suggested clip length.
      const cap = handsFree > 0 ? handsFree : template.seconds || 0
      const speed = template.speed || 1
      const next = []

      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const url = URL.createObjectURL(file)
        // eslint-disable-next-line no-await-in-loop
        const duration = await readDuration(url)
        const end = cap > 0 && duration > 0 ? Math.min(duration, cap) : duration
        next.push({
          id: uid(),
          file,
          url,
          name: file.name,
          size: file.size,
          duration,
          trimStart: 0,
          trimEnd: Math.round(end * 10) / 10,
          speed,
          muted: false,
        })
      }

      setClips((prev) => {
        const merged = [...prev, ...next].slice(0, MAX_CLIPS)
        if (prev.length + next.length > MAX_CLIPS) {
          toast.error(`Up to ${MAX_CLIPS} clips per Reel`)
        }
        return merged
      })
      setAdding(false)
    },
    [handsFree, template]
  )

  const updateClip = (id, patch) =>
    setClips((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const removeClip = (id) =>
    setClips((list) => list.filter((c) => c.id !== id))

  const moveClip = (index, direction) => {
    setClips((list) => {
      const target = index + direction
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const totalSeconds = clips.reduce((sum, c) => sum + clipDuration(c), 0)
  const current = clips[activeClip]

  const filterCss = REEL_FILTERS.find((f) => f.id === globalFilter)?.css || 'none'

  /* ------------------------------------------------- rows: hands-free timer */
  // Counts down before opening the camera, and caps every imported clip to the
  // chosen hands-free length so nobody has to touch the trim handles.
  useEffect(() => {
    if (countdownLeft === null) return undefined
    if (countdownLeft <= 0) {
      setCountdownLeft(null)
      recordInputRef.current?.click()
      return undefined
    }
    const timer = setTimeout(
      () => setCountdownLeft((value) => (value === null ? null : value - 1)),
      1000
    )
    return () => clearTimeout(timer)
  }, [countdownLeft])

  const startRecording = () => {
    if (countdown <= 0) {
      recordInputRef.current?.click()
      return
    }
    setCountdownLeft(countdown)
  }

  // Release the microphone if the composer closes mid-dictation.
  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        /* already stopped */
      }
    },
    []
  )

  /* ---------------------------------------------------------------- overlays */
  const addOverlay = () => {
    if (overlays.length >= 12) return toast.error('Up to 12 text overlays')
    setOverlays((list) => [
      ...list,
      { id: uid(), text: 'Your text', x: 50, y: 30, start: 0, end: 0, color: '#ffffff', size: 30 },
    ])
  }

  const updateOverlay = (id, patch) =>
    setOverlays((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)))

  const removeOverlay = (id) => setOverlays((list) => list.filter((o) => o.id !== id))

  /* -------------------------------------------------------------- templates */
  const applyTemplate = (id) => {
    setTemplateId(id)
    const tpl = REEL_TEMPLATES.find((t) => t.id === id)
    if (!tpl) return
    setGlobalFilter(tpl.filter || 'original')

    if (tpl.captions?.length) {
      const per = tpl.seconds || 5
      setOverlays(
        tpl.captions.map((text, index) => ({
          id: uid(),
          text: text || 'Your text',
          x: 50,
          y: 74,
          start: Number((index * per).toFixed(1)),
          end: Number(((index + 1) * per).toFixed(1)),
          color: '#ffffff',
          size: 24,
        }))
      )
    }

    toast.success(`${tpl.name} template applied`)
  }

  /* ---------------------------------------------------------- auto-captions */
  const splitCaptions = (text) =>
    text
      .split(/\r?\n|(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean)

  const generateCaptions = () => {
    const lines = splitCaptions(captionScript)
    if (!lines.length) return toast.error('Type or dictate a caption first')
    // Spread the lines evenly across the Reel (or 2s each before clips exist).
    const span = Math.max(1.5, (totalSeconds || lines.length * 2) / lines.length)
    setOverlays(
      lines.map((text, index) => ({
        id: uid(),
        text,
        x: 50,
        y: 78,
        start: Number((index * span).toFixed(1)),
        end: Number(((index + 1) * span).toFixed(1)),
        color: '#ffffff',
        size: 22,
      }))
    )
    return toast.success(`${lines.length} caption${lines.length === 1 ? '' : 's'} added`)
  }

  const speechAvailable =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

  const toggleDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      return toast.error('Voice dictation is not supported in this browser')
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return undefined
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let spoken = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) spoken += event.results[i][0].transcript
      }
      const text = spoken.trim()
      if (text) setCaptionScript((prev) => (prev ? `${prev}\n${text}` : text))
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
    return undefined
  }

  /* -------------------------------------------------------------- align grid */
  // Nine anchor points so captions can be locked to edges, centre or thirds.
  const ALIGN_POINTS = [
    { x: 12, y: 14 },
    { x: 50, y: 14 },
    { x: 88, y: 14 },
    { x: 12, y: 50 },
    { x: 50, y: 50 },
    { x: 88, y: 50 },
    { x: 12, y: 86 },
    { x: 50, y: 86 },
    { x: 88, y: 86 },
  ]

  /* ------------------------------------------------------------------- save */
  const publish = async () => {
    if (!chatId) return toast.error('Join a Circle to share a Reel')
    if (clips.length === 0) return toast.error('Add at least one video clip')
    if (!title.trim()) return toast.error('Give your Reel a title')
    if (totalSeconds > MAX_TOTAL_SECONDS + 30) {
      return toast.error('Reels are limited to about 3 minutes')
    }
    if (busy) return undefined

    setBusy(true)
    try {
      const payload = new FormData()
      payload.append('kind', 'reel')
      payload.append('title', title.trim())
      payload.append('description', description.trim())
      payload.append('location', location.trim())
      payload.append('tags', hashtags)
      payload.append('visibility', visibility)

      clips.forEach((clip) => payload.append('media', clip.file, clip.name))
      if (music?.file) payload.append('audio', music.file, music.file.name)

      payload.append(
        'reel',
        JSON.stringify({
          clips: clips.map((clip, index) => ({
            index,
            duration: clip.duration,
            trimStart: clip.trimStart,
            trimEnd: clip.trimEnd,
            speed: clip.speed,
            filter: '',
            muted: clip.muted,
          })),
          coverTime,
          filter: filterCss,
          speed: 1,
          audio: music ? { title: music.name } : undefined,
          overlays: overlays.map(({ id, ...rest }) => rest),
          hashtags: hashtags
            .split(/[\s,]+/)
            .map((t) => t.replace(/^#/, '').trim())
            .filter(Boolean),
          durationSec: Math.round(totalSeconds * 10) / 10,
          visibility,
        })
      )

      const { data } = await api.post(`/circles/${chatId}/items`, payload)
      toast.success('Reel published')
      onCreated?.(data)
      onClose?.()
    } catch (error) {
      toast.error(getApiError(error, 'Could not publish the Reel'))
    } finally {
      setBusy(false)
    }
    return undefined
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950/98 backdrop-blur">
      {countdownLeft !== null && countdownLeft > 0 ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/85 backdrop-blur">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
              Recording in
            </p>
            <p className="mt-1 text-7xl font-black text-white">{countdownLeft}</p>
            <button
              type="button"
              onClick={() => setCountdownLeft(null)}
              className="mt-5 rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <header className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-wchat-400 to-wchat text-white">
          <Clapperboard size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-100">New Reel</h2>
          <p className="text-[11px] text-zinc-500">
            {clips.length} clip{clips.length === 1 ? '' : 's'} · {totalSeconds.toFixed(1)}s
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X size={18} />
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-4 lg:flex-row lg:gap-6">
        {/* Preview */}
        <div className="lg:w-[280px] lg:shrink-0">
          <div className="lg:sticky lg:top-2">
            <ReelPlayer
              key={clips.map((c) => c.id).join('-')}
              clips={clips.map((c) => ({
                src: c.url,
                duration: c.duration,
                trimStart: c.trimStart,
                trimEnd: c.trimEnd,
                speed: c.speed,
                muted: c.muted,
              }))}
              audio={music ? { src: music.url } : null}
              overlays={overlays}
              filter={filterCss}
              autoPlay={false}
              guides={guides}
              editable={overlays.length > 0}
              snap={snap}
              onOverlayMove={updateOverlay}
            />
            {totalSeconds > MAX_TOTAL_SECONDS ? (
              <p className="mt-2 text-[11px] text-amber-400">
                Heads up: this is longer than the 3-minute sweet spot for Reels.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 space-y-6 lg:mt-0 lg:min-w-0 lg:flex-1">
          {/* 0. Templates */}
          <Section icon={LayoutTemplate} title="Template" hint="Start from a structure">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {REEL_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl.id)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    templateId === tpl.id
                      ? 'border-wchat bg-wchat/10'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-wchat/50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid size={13} className="text-wchat" />
                    <span className="text-xs font-semibold text-zinc-100">{tpl.name}</span>
                  </span>
                  <span className="mt-1 block text-[10px] leading-tight text-zinc-500">
                    {tpl.description}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* 1. Clips */}
          <Section
            icon={Film}
            title="Clips"
            hint={
              template.clips
                ? `${template.name}: about ${template.clips} clip${template.clips === 1 ? '' : 's'} × ${template.seconds}s`
                : 'Record or upload, then trim each one'
            }
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => clipInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-wchat px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload clips
              </button>
              <button
                type="button"
                onClick={startRecording}
                disabled={countdownLeft !== null}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-wchat/60 hover:text-white disabled:opacity-60"
              >
                <Mic size={14} /> Record
              </button>
              {template.clips ? (
                <span
                  className={`inline-flex items-center rounded-xl px-2.5 py-2 text-[11px] font-semibold ${
                    clips.length >= template.clips
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-zinc-800/70 text-zinc-400'
                  }`}
                >
                  {clips.length}/{template.clips} clips
                </span>
              ) : null}
            </div>

            {/* Hands-free capture: countdown + auto-trim length */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <Timer size={14} className="shrink-0 text-wchat" />
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Countdown
                </span>
                <select
                  value={countdown}
                  onChange={(event) => setCountdown(Number(event.target.value))}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-wchat/60"
                >
                  {COUNTDOWNS.map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? 'Off' : `${value} seconds`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <Clapperboard size={14} className="shrink-0 text-wchat" />
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Hands-free
                </span>
                <select
                  value={handsFree}
                  onChange={(event) => setHandsFree(Number(event.target.value))}
                  className="min-w-0 flex-1 rounded-xl bg-transparent text-[11px] font-semibold text-zinc-200 outline-none"
                >
                  {HANDS_FREE.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds === 0 ? 'Off' : `${seconds}s per clip`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-zinc-500">
              Record waits for the countdown, then opens your camera. Hands-free trims
              every clip to the chosen length automatically.
            </p>
            <input
              ref={clipInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <input
              ref={recordInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files)
                event.target.value = ''
              }}
            />

            {clips.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">
                Add up to {MAX_CLIPS} clips. Each clip can be trimmed, sped up, slowed
                down and muted.
              </p>
            ) : (
              <ul className="space-y-2">
                {clips.map((clip, index) => (
                  <li
                    key={clip.id}
                    className={`rounded-xl border p-2.5 transition ${
                      index === activeClip
                        ? 'border-wchat/60 bg-wchat/5'
                        : 'border-zinc-800 bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveClip(index)}
                        className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-black"
                        title="Preview this clip"
                      >
                        <video src={clip.url} className="h-full w-full object-cover" muted />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-200">
                          Clip {index + 1}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {clipDuration(clip).toFixed(1)}s · {clip.speed}×
                          {clip.muted ? ' · muted' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => moveClip(index, -1)}
                        disabled={index === 0}
                        aria-label="Move up"
                        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveClip(index, 1)}
                        disabled={index === clips.length - 1}
                        aria-label="Move down"
                        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeClip(clip.id)}
                        aria-label="Remove clip"
                        className="rounded-md p-1.5 text-zinc-500 hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {index === activeClip && clip.duration > 0 ? (
                      <div className="mt-3 space-y-2 border-t border-zinc-800/80 pt-3">
                        <div className="flex items-center gap-2">
                          <Scissors size={13} className="text-zinc-500" />
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            Trim
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                          <input
                            type="range"
                            min={0}
                            max={clip.duration}
                            step={0.1}
                            value={clip.trimStart}
                            onChange={(event) => {
                              const value = Math.min(Number(event.target.value), clip.trimEnd - 0.2)
                              updateClip(clip.id, { trimStart: Math.max(0, value) })
                            }}
                            className="flex-1 accent-wchat"
                          />
                          <span className="w-10 text-right">{clip.trimStart.toFixed(1)}s</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                          <input
                            type="range"
                            min={0}
                            max={clip.duration}
                            step={0.1}
                            value={clip.trimEnd}
                            onChange={(event) =>
                              updateClip(clip.id, {
                                trimEnd: Math.max(
                                  clip.trimStart + 0.5,
                                  Number(event.target.value) || clip.duration
                                ),
                              })
                            }
                            className="w-full"
                          />
                          <span className="shrink-0">{clip.trimEnd.toFixed(1)}s</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            Speed
                          </span>
                          {SPEEDS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateClip(clip.id, { speed: s })}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                                clip.speed === s
                                  ? 'bg-wchat text-white'
                                  : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {s}×
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => updateClip(clip.id, { muted: !clip.muted })}
                            className={`ml-auto rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                              clip.muted
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {clip.muted ? 'Muted' : 'Sound on'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* 2. Filters */}
          {clips.length > 0 ? (
            <Section icon={Sparkles} title="Filter" hint="Applies to the whole Reel">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {REEL_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setGlobalFilter(f.id)}
                    className={`shrink-0 rounded-xl border p-1 transition ${
                      globalFilter === f.id ? 'border-wchat' : 'border-zinc-800'
                    }`}
                  >
                    <span
                      className="block h-14 w-14 overflow-hidden rounded-lg bg-black"
                      style={{ filter: f.css }}
                    >
                      <video src={current?.url} className="h-full w-full object-cover" muted />
                    </span>
                    <span className="mt-1 block text-center text-[10px] text-zinc-400">
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </Section>
          ) : null}

          {/* 3. Cover */}
          {current ? (
            <Section icon={Clapperboard} title="Cover" hint="Pick the frame people see first">
              <input
                type="range"
                min={0}
                max={Math.max(0.1, current.duration)}
                step={0.1}
                value={Math.min(coverTime, current.duration)}
                onChange={(event) => setCoverTime(Number(event.target.value))}
                className="w-full"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Cover frame at {coverTime.toFixed(1)}s
              </p>
            </Section>
          ) : null}

          {/* 4. Audio */}
          <Section icon={Music} title="Audio" hint="Original audio, or add a music track">
            {music ? (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2.5">
                <Music size={16} className="text-wchat" />
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">
                  {music.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(music.url)
                    setMusic(null)
                  }}
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                  aria-label="Remove audio"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-wchat/60 hover:text-white"
              >
                <Plus size={14} /> Add music
              </button>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) setMusic({ file, url: URL.createObjectURL(file), name: file.name })
                event.target.value = ''
              }}
            />
            <p className="text-[11px] text-zinc-500">
              Without a music track the Reel plays each clip's original audio.
            </p>
          </Section>

          {/* 5. Text overlays */}
          <Section icon={Type} title="Text" hint="Timed captions that appear over the video">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addOverlay}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800/70 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                <Plus size={14} /> Add text
              </button>
              <button
                type="button"
                onClick={() => setGuides((v) => !v)}
                aria-pressed={guides}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  guides
                    ? 'bg-wchat/15 text-wchat'
                    : 'bg-zinc-800/70 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <LayoutGrid size={14} /> Guides
              </button>
              <button
                type="button"
                onClick={() => setSnap((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  snap
                    ? 'bg-wchat/15 text-wchat'
                    : 'bg-zinc-800/70 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <AlignCenter size={14} /> Snap {snap ? 'on' : 'off'}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Drag any caption on the preview, or use the align grid below.
            </p>

            {/* Auto-captions: dictate, or type a script and spread it out */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex items-center gap-2">
                <Captions size={15} className="text-wchat" />
                <span className="text-xs font-semibold text-zinc-200">Auto-captions</span>
                {speechAvailable ? (
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                      listening
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-zinc-800/70 text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    <Mic size={13} /> {listening ? 'Stop dictating' : 'Dictate'}
                  </button>
                ) : null}
              </div>
              <textarea
                value={captionScript}
                onChange={(event) => setCaptionScript(event.target.value)}
                rows={3}
                placeholder={
                  'Type your captions — one per line, or in sentences.\nSo they appear one after another.'
                }
                className={`${inputClass} mt-2 resize-y`}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateCaptions}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-wchat px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
                >
                  <Wand2 size={14} /> Generate captions
                </button>
                <span className="text-[11px] text-zinc-500">
                  Spreads evenly over {Math.max(1, Math.round(totalSeconds))}s
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {overlays.map((o) => (
                <div key={o.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={o.text}
                      onChange={(event) => updateOverlay(o.id, { text: event.target.value })}
                      placeholder="Type something"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeOverlay(o.id)}
                      aria-label="Remove text"
                      className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1.5 flex items-center gap-2">
                      <AlignCenter size={12} className="text-zinc-500" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Align
                      </span>
                      <button
                        type="button"
                        onClick={() => setSnap((v) => !v)}
                        className={`ml-auto rounded-md px-2 py-1 text-[10px] font-semibold ${
                          snap ? 'bg-wchat/20 text-wchat' : 'bg-zinc-800/70 text-zinc-400'
                        }`}
                      >
                        Snap {snap ? 'on' : 'off'}
                      </button>
                    </div>
                    <div className="grid w-24 grid-cols-3 gap-1">
                      {ALIGN_POINTS.map((point, pointIndex) => (
                        <button
                          key={pointIndex}
                          type="button"
                          onClick={() => updateOverlay(o.id, { x: point.x, y: point.y })}
                          aria-label={`Align to position ${pointIndex + 1}`}
                          className={`h-6 rounded-md border transition ${
                            o.x === point.x && o.y === point.y
                              ? 'border-wchat bg-wchat/25'
                              : 'border-zinc-800 bg-zinc-900/60 hover:border-wchat/50'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
                    <label className="flex items-center gap-2">
                      Across
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={o.x}
                        onChange={(event) => updateOverlay(o.id, { x: Number(event.target.value) })}
                        className="flex-1"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      Down
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={o.y}
                        onChange={(event) => updateOverlay(o.id, { y: Number(event.target.value) })}
                        className="flex-1"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      Size
                      <input
                        type="range"
                        min={14}
                        max={72}
                        value={o.size}
                        onChange={(event) =>
                          updateOverlay(o.id, { size: Number(event.target.value) })
                        }
                        className="flex-1"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      From (s)
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={o.start}
                        onChange={(event) =>
                          updateOverlay(o.id, { start: Number(event.target.value) })
                        }
                        className="w-16 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-zinc-100"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      Until
                      <input
                        type="range"
                        min={0}
                        max={Math.max(1, Math.round(totalSeconds))}
                        value={Math.min(o.end, Math.round(totalSeconds))}
                        onChange={(event) => updateOverlay(o.id, { end: Number(event.target.value) })}
                        className="flex-1"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      Colour
                      <input
                        type="color"
                        value={o.color}
                        onChange={(event) => updateOverlay(o.id, { color: event.target.value })}
                        className="h-7 w-10 rounded border border-zinc-700 bg-transparent"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      Align
                      <select
                        value={o.align}
                        onChange={(event) => updateOverlay(o.id, { align: event.target.value })}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-200"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 6. Details */}
          <Section icon={Upload} title="Details" hint="Caption, hashtags and who can see it">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder="Reel title"
              className={inputClass}
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Write a caption…"
              className={`${inputClass} resize-none`}
            />
            <input
              value={hashtags}
              onChange={(event) => setHashtags(event.target.value)}
              placeholder="#kigali #music #loops"
              className={inputClass}
            />
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location (optional)"
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Circle
                </span>
                <select
                  value={chatId}
                  onChange={(event) => setChatId(event.target.value)}
                  className={inputClass}
                >
                  {communities.length === 0 ? <option value="">No Circles yet</option> : null}
                  {communities.map((chat) => (
                    <option key={chat._id} value={chat._id}>
                      {chat.chatName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Who sees it
                </span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                  className={inputClass}
                >
                  <option value="circle">This Circle only</option>
                  <option value="public">Everyone (reaches Explore)</option>
                </select>
              </label>
            </div>
          </Section>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-zinc-800/80 px-4 py-3">
        <p className="hidden text-[11px] text-zinc-500 sm:block">
          Reels honour each clip's trim, speed, filter and your Circle's rules.
        </p>
        <div className="flex w-full justify-end gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-wchat px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            Publish Reel
          </button>
        </div>
      </footer>
    </div>
  )
}

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-wchat" />
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {hint ? <span className="text-[11px] text-zinc-500">· {hint}</span> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
