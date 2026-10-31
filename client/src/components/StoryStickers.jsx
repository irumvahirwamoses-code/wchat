import { useEffect, useState } from 'react'
import {
  AtSign,
  BarChart3,
  Check,
  Film,
  Hash,
  HelpCircle,
  Link2,
  ListChecks,
  MapPin,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Timer,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'

export const STICKER_META = [
  { type: 'location', label: 'Location', Icon: MapPin },
  { type: 'mention', label: 'Mention', Icon: AtSign },
  { type: 'hashtag', label: 'Hashtag', Icon: Hash },
  { type: 'gif', label: 'GIF', Icon: Film },
  { type: 'poll', label: 'Poll', Icon: BarChart3 },
  { type: 'question', label: 'Question', Icon: HelpCircle },
  { type: 'quiz', label: 'Quiz', Icon: ListChecks },
  { type: 'emojiSlider', label: 'Emoji slider', Icon: SlidersHorizontal },
  { type: 'link', label: 'Link', Icon: Link2 },
  { type: 'countdown', label: 'Countdown', Icon: Timer },
  { type: 'addYours', label: 'Add Yours', Icon: Sparkles },
]

export const GIF_SAMPLES = [
  'https://media.giphy.com/media/3o7aCSPqXE5C6T8tBC/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',
  'https://media.giphy.com/media/3oz8xAFtqoOUUrsh7W/giphy.gif',
  'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
  'https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif',
]

const SLIDER_EMOJIS = ['😍', '🔥', '😂', '😮', '😢', '👏']
export const TEXT_BACKGROUNDS = [
  '#111827',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0d9488',
  '#1d4ed8',
  '#ca8a04',
  '#334155',
]

const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/70'

/** Configure a sticker before it is placed on the story. */
export function StickerEditor({ type, onClose, onSave }) {
  const meta = STICKER_META.find((item) => item.type === type)
  const [text, setText] = useState('')
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [correctIndex, setCorrectIndex] = useState(0)
  const [emoji, setEmoji] = useState(SLIDER_EMOJIS[0])
  const [url, setUrl] = useState('')
  const [endsAt, setEndsAt] = useState(() =>
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  )

  const setOption = (index, value) =>
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)))

  const save = () => {
    const clean = String(text).trim()
    const cleanPrompt = String(prompt).trim()
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean)

    if (['location', 'mention', 'hashtag'].includes(type) && !clean) {
      return toast.error('Add some text first')
    }
    if (type === 'gif' && !url.trim()) return toast.error('Pick or paste a GIF link')
    if (['poll', 'quiz'].includes(type) && !cleanPrompt) {
      return toast.error('Add a question first')
    }
    if (['poll', 'quiz'].includes(type) && cleanOptions.length < 2) {
      return toast.error('Add at least two options')
    }
    if (type === 'question' && !cleanPrompt) return toast.error('Add a question first')
    if (type === 'emojiSlider' && !cleanPrompt) return toast.error('Add a prompt first')
    if (type === 'link' && !url.trim()) return toast.error('Add a link first')
    if (type === 'countdown' && !clean) return toast.error('Add a countdown title')
    if (type === 'addYours' && !cleanPrompt) return toast.error('Add a prompt first')

    const sticker = { type }
    if (['location', 'mention', 'hashtag'].includes(type)) sticker.text = clean
    if (type === 'gif') sticker.url = url.trim()
    if (type === 'poll') {
      sticker.prompt = cleanPrompt
      sticker.options = cleanOptions.map((option) => ({ text: option }))
    }
    if (type === 'question') sticker.prompt = cleanPrompt
    if (type === 'quiz') {
      sticker.prompt = cleanPrompt
      sticker.options = cleanOptions.map((option) => ({ text: option }))
      sticker.correctIndex = Math.min(correctIndex, cleanOptions.length - 1)
    }
    if (type === 'emojiSlider') {
      sticker.prompt = cleanPrompt
      sticker.emoji = emoji
    }
    if (type === 'link') {
      sticker.url = url.trim()
      sticker.text = clean
    }
    if (type === 'countdown') {
      sticker.text = clean
      const when = new Date(endsAt)
      sticker.endsAt = Number.isNaN(when.getTime())
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : when
    }
    if (type === 'addYours') sticker.prompt = cleanPrompt
    onSave?.(sticker)
    return undefined
  }

  const Icon = meta?.Icon || Sparkles

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Icon size={16} className="text-amber-400" />
            {meta?.label || 'Sticker'}
          </h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {['location', 'mention', 'hashtag'].includes(type) ? (
            <input
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={80}
              placeholder={
                type === 'location'
                  ? 'Where are you?'
                  : type === 'mention'
                    ? '@username'
                    : '#hashtag'
              }
              className={inputClass}
            />
          ) : null}

          {type === 'gif' ? (
            <div className="space-y-2">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste a GIF link"
                className={inputClass}
              />
              <div className="grid grid-cols-3 gap-2">
                {GIF_SAMPLES.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setUrl(sample)}
                    className={`overflow-hidden rounded-lg border ${
                      url === sample ? 'border-amber-400' : 'border-zinc-800'
                    }`}
                  >
                    <img src={sample} alt="GIF option" className="h-16 w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {['poll', 'quiz', 'question', 'emojiSlider', 'addYours'].includes(type) ? (
            <input
              autoFocus
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={140}
              placeholder={
                type === 'poll'
                  ? 'Ask a question…'
                  : type === 'quiz'
                    ? 'Quiz question…'
                    : type === 'question'
                      ? 'Ask me anything…'
                      : type === 'emojiSlider'
                        ? 'How do you feel about this?'
                        : 'Add Yours prompt…'
              }
              className={inputClass}
            />
          ) : null}

          {['poll', 'quiz'].includes(type) ? (
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  {type === 'quiz' ? (
                    <button
                      type="button"
                      onClick={() => setCorrectIndex(index)}
                      title="Mark as the correct answer"
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                        correctIndex === index
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                          : 'border-zinc-700 text-zinc-500'
                      }`}
                    >
                      <Check size={12} />
                    </button>
                  ) : null}
                  <input
                    value={option}
                    onChange={(event) => setOption(index, event.target.value)}
                    maxLength={80}
                    placeholder={`Option ${index + 1}`}
                    className={inputClass}
                  />
                </div>
              ))}
              {options.length < 4 ? (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                >
                  <Plus size={13} /> Add option
                </button>
              ) : null}
            </div>
          ) : null}

          {type === 'emojiSlider' ? (
            <div className="flex flex-wrap gap-2">
              {SLIDER_EMOJIS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  className={`grid h-10 w-10 place-items-center rounded-full border text-lg ${
                    emoji === item
                      ? 'border-amber-400 bg-amber-400/15'
                      : 'border-zinc-700 bg-zinc-900'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          {type === 'link' ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                className={inputClass}
              />
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={80}
                placeholder="Link label (optional)"
                className={inputClass}
              />
            </div>
          ) : null}

          {type === 'countdown' ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={80}
                placeholder="What are you counting down to?"
                className={inputClass}
              />
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
          >
            Add sticker
          </button>
        </div>
      </div>
    </div>
  )
}

const cardClass =
  'rounded-xl bg-black/60 px-3 py-2 text-white shadow-lg backdrop-blur-sm'

function Countdown({ endsAt }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const target = new Date(endsAt).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - now
  if (diff <= 0) return <span className="text-sm font-bold">It&apos;s time!</span>
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  const parts = days > 0 ? [days, 'd', hours, 'h'] : hours > 0 ? [hours, 'h', minutes, 'm'] : [minutes, 'm', seconds, 's']
  return (
    <span className="text-lg font-extrabold tracking-tight">
      {parts[0]}
      {parts[1]} {parts[2]}
      {parts[3]}
    </span>
  )
}

/**
 * Render one sticker. Poll / quiz / slider / question stickers talk to the API
 * so votes and answers are stored with the story.
 */
export default function StorySticker({
  sticker,
  storyId,
  currentUserId,
  isAuthor = false,
  preview = false,
  inline = false,
  onChange,
}) {
  const [data, setData] = useState(sticker)
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState(null)
  const [sliderValue, setSliderValue] = useState(() => {
    const mine = (sticker.responses || []).find(
      (response) => String(response.user) === String(currentUserId)
    )
    return typeof mine?.value === 'number' ? mine.value : 50
  })
  const [questionText, setQuestionText] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    setData(sticker)
  }, [sticker])

  const me = String(currentUserId || '')
  const post = async (path, body) => {
    if (preview || !storyId || !data?._id) return
    setBusy(true)
    try {
      const { data: response } = await api.post(
        `/stories/${storyId}/stickers/${data._id}/${path}`,
        body
      )
      if (response.sticker) setData({ ...response.sticker })
      onChange?.(response)
      return response
    } catch (error) {
      toast.error(getApiError(error, 'Could not send that'))
      return null
    } finally {
      setBusy(false)
    }
  }

  const myVote = (data.options || []).findIndex((option) =>
    (option.votes || []).some((vote) => String(vote) === me)
  )
  const myQuiz = (data.responses || []).find(
    (response) => String(response.user) === me && response.answerIndex !== null
  )
  const mySlider = (data.responses || []).find(
    (response) => String(response.user) === me && response.value !== null
  )
  const answeredIndex = myQuiz ? myQuiz.answerIndex : null
  const correctIndex =
    revealed?.correctIndex !== undefined ? revealed.correctIndex : data.correctIndex
  const totalVotes = (data.options || []).reduce(
    (sum, option) => sum + (option.votes?.length || 0),
    0
  )
  const sliderAverage = (() => {
    const values = (data.responses || [])
      .map((response) => response.value)
      .filter((value) => typeof value === 'number')
    if (!values.length) return 0
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  })()
  const myAnswered = Boolean(myQuiz)

  const inner = (() => {
    switch (data.type) {
      case 'location':
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
            <MapPin size={13} /> {data.text}
          </div>
        )
      case 'mention':
        return (
          <div className="rounded-lg bg-black/50 px-3 py-1.5 text-lg font-extrabold text-white shadow-lg backdrop-blur-sm">
            {data.text?.startsWith('@') ? data.text : `@${data.text || ''}`}
          </div>
        )
      case 'hashtag':
        return (
          <div className="rounded-lg bg-black/50 px-3 py-1.5 text-lg font-extrabold text-white shadow-lg backdrop-blur-sm">
            {data.text?.startsWith('#') ? data.text : `#${data.text || ''}`}
          </div>
        )
      case 'gif':
        return (
          <img
            src={data.url}
            alt="GIF sticker"
            className="max-h-36 max-w-[150px] rounded-xl object-contain shadow-lg"
          />
        )
      case 'link':
        return (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className={`${cardClass} flex max-w-[220px] items-center gap-2`}
            onClick={(event) => preview && event.preventDefault()}
          >
            <Link2 size={16} className="shrink-0 text-sky-300" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">
                {data.text || 'Open link'}
              </span>
              <span className="block truncate text-[10px] text-white/70">{data.url}</span>
            </span>
          </a>
        )
      case 'countdown':
        return (
          <div className={`${cardClass} min-w-[150px] text-center`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
              {data.text || 'Countdown'}
            </p>
            <div className="mt-1 text-white">
              <Countdown endsAt={data.endsAt} />
            </div>
          </div>
        )
      case 'addYours':
        return (
          <div className={`${cardClass} max-w-[200px] text-center`}>
            <p className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
              <Sparkles size={12} /> Add Yours
            </p>
            <p className="mt-1 text-sm font-semibold">{data.prompt}</p>
          </div>
        )
      case 'poll':
        return (
          <div className={`${cardClass} w-[210px] space-y-2`}>
            <p className="text-sm font-bold leading-snug">{data.prompt}</p>
            <div className="space-y-1.5">
              {(data.options || []).map((option, index) => {
                const votes = option.votes?.length || 0
                const percent = totalVotes ? Math.round((votes / totalVotes) * 100) : 0
                const chosen = myVote === index
                if (myVote >= 0 || preview || isAuthor) {
                  return (
                    <div
                      key={index}
                      className={`relative overflow-hidden rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        chosen ? 'bg-amber-400 text-zinc-950' : 'bg-white/15 text-white'
                      }`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-white/15"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="relative flex items-center justify-between gap-2">
                        <span className="truncate">{option.text}</span>
                        <span>{percent}%</span>
                      </span>
                    </div>
                  )
                }
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={busy}
                    onClick={() => post('vote', { optionIndex: index })}
                    className="block w-full rounded-lg bg-white/15 px-2.5 py-1.5 text-left text-xs font-semibold text-white hover:bg-white/25"
                  >
                    {option.text}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-white/60">{totalVotes} vote{totalVotes === 1 ? '' : 's'}</p>
          </div>
        )
      case 'quiz':
        return (
          <div className={`${cardClass} w-[220px] space-y-2`}>
            <p className="text-sm font-bold leading-snug">{data.prompt}</p>
            <div className="space-y-1.5">
              {(data.options || []).map((option, index) => {
                const isCorrect = (myAnswered || isAuthor) && index === correctIndex
                const isWrong = myAnswered && index === answeredIndex && index !== correctIndex
                const isChosen = index === answeredIndex
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={busy || myAnswered || preview || isAuthor}
                    onClick={async () => {
                      const response = await post('quiz', { answerIndex: index })
                      if (response) setRevealed(response)
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold ${
                      isCorrect
                        ? 'bg-emerald-400 text-emerald-950'
                        : isWrong
                          ? 'bg-rose-500 text-white'
                          : isChosen
                            ? 'bg-white/30 text-white'
                            : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    <span className="truncate">{option.text}</span>
                    {isCorrect ? <Check size={13} /> : null}
                    {isWrong ? <X size={13} /> : null}
                  </button>
                )
              })}
            </div>
            {myAnswered ? (
              <p className="text-[10px] font-semibold text-white/70">
                {answeredIndex === correctIndex ? 'Correct! 🎉' : 'Not quite — try the next one.'}
              </p>
            ) : null}
          </div>
        )
      case 'emojiSlider':
        return (
          <div className={`${cardClass} w-[220px] space-y-2 text-center`}>
            <p className="text-xs font-semibold">{data.prompt}</p>
            <div className="text-3xl">{data.emoji || '😍'}</div>
            <input
              type="range"
              min="0"
              max="100"
              value={mySlider?.value ?? sliderValue}
              disabled={busy || preview || isAuthor}
              onChange={(event) => setSliderValue(Number(event.target.value))}
              onPointerUp={() => post('slider', { value: sliderValue })}
              onTouchEnd={() => post('slider', { value: sliderValue })}
              className="w-full accent-amber-400"
            />
            <p className="text-[10px] text-white/70">
              {mySlider ? `You: ${mySlider.value}%` : 'Slide to react'}
              {sliderAverage > 0 ? ` · Avg ${sliderAverage}%` : ''}
            </p>
          </div>
        )
      case 'question':
        return (
          <div className={`${cardClass} w-[220px] space-y-2`}>
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
              <HelpCircle size={12} /> Question
            </p>
            <p className="text-sm font-semibold">{data.prompt}</p>
            {isAuthor ? (
              <p className="text-[10px] text-white/70">
                {(data.responses || []).length} response
                {(data.responses || []).length === 1 ? '' : 's'}
              </p>
            ) : sent || (data.responses || []).some((response) => String(response.user) === me) ? (
              <p className="text-[10px] font-semibold text-emerald-300">Answer sent ✓</p>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  maxLength={200}
                  placeholder="Type your answer…"
                  className="min-w-0 flex-1 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-[11px] text-white placeholder:text-white/50"
                />
                <button
                  type="button"
                  disabled={busy || preview || !questionText.trim()}
                  onClick={async () => {
                    const response = await post('answer', { text: questionText.trim() })
                    if (response) {
                      setQuestionText('')
                      setSent(true)
                    }
                  }}
                  className="rounded-md bg-amber-400 px-2 py-1 text-[11px] font-bold text-zinc-950 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  })()

  if (!inner) return null

  if (inline) {
    return <div className={preview ? 'pointer-events-none' : ''}>{inner}</div>
  }

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${data.x ?? 50}%`, top: `${data.y ?? 50}%` }}
    >
      <div className={preview ? 'pointer-events-none' : 'pointer-events-auto'}>{inner}</div>
    </div>
  )
}
