import { useEffect, useState } from 'react'
import { Film, MessageCircle, Share, Users, Zap, Play, Pause } from 'lucide-react'

const SCENES = [
  {
    title: 'Chats become communities',
    caption: 'Create a Circle for your team, class, neighborhood, or interest.',
    icon: <Users size={24} strokeWidth={2} />,
  },
  {
    title: 'Invite anyone in seconds',
    caption: 'Share a link or QR code. Open Circles join instantly; request Circles await approval.',
    icon: <Share size={24} strokeWidth={2} />,
  },
  {
    title: 'Chat and call in real time',
    caption: 'Group messaging, reactions, and WebRTC calls inside every Circle.',
    icon: <MessageCircle size={24} strokeWidth={2} />,
  },
  {
    title: 'Reels, Stories, and Library',
    caption: 'Short videos, disappearing stories, documents, events, challenges, and opportunities.',
    icon: <Film size={24} strokeWidth={2} />,
  },
  {
    title: 'Spark, join, and decide',
    caption: 'Members react with Sparks, join activities, and vote in Circle decisions.',
    icon: <Zap size={24} strokeWidth={2} />,
  },
  {
    title: 'One place for your people',
    caption: 'Create your Circle and add others today on Wchat.',
    icon: <Users size={24} strokeWidth={2} />,
  },
]

const SCENE_MS = 4000
const TOTAL_MS = SCENES.length * SCENE_MS

export default function PromoReel() {
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!playing) return

    let start = Date.now() - progress
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(elapsed % TOTAL_MS)
      setCurrent(Math.floor((elapsed % TOTAL_MS) / SCENE_MS))
    }, 50)

    return () => clearInterval(timer)
  }, [playing, progress])

  const scene = SCENES[current]
  const sceneProgress = ((progress % SCENE_MS) / SCENE_MS) * 100
  const minutes = Math.floor((TOTAL_MS - progress) / 60000)
  const seconds = Math.floor(((TOTAL_MS - progress) % 60000) / 1000)
    .toString()
    .padStart(2, '0')

  const togglePlay = () => setPlaying((p) => !p)
  const restart = () => {
    setProgress(0)
    setCurrent(0)
  }

  return (
    <section
      className="relative w-full max-w-[400px] aspect-[9/16] mx-auto"
      aria-label="Wchat promo reel"
    >
      <div
        className="absolute inset-0 bg-[#0a0b0f] rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          {SCENES.map((item, index) => (
            <div
              key={index}
              className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center transition-opacity duration-700 ease-in-out ${
                index === current ? 'opacity-100 z-20' : 'opacity-0 z-0'
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 mb-4">
                {item.icon}
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">{item.title}</h3>
              <p className="text-zinc-400 max-w-xs leading-relaxed">{item.caption}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-2 left-2 right-2 h-1 z-20 overflow-hidden rounded-full bg-zinc-800/60">
          <div
            className="h-full bg-amber-400 transition-all duration-500 ease-linear"
            style={{ width: `${sceneProgress}%` }}
          />
        </div>

        <div className="absolute top-4 left-4 right-4 z-30 flex justify-between items-start px-3">
          <span className="text-xs text-zinc-400">{`${minutes}:${seconds}`}</span>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause reel' : 'Play reel'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={restart}
            aria-label="Restart reel"
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300 transition hover:bg-white/20"
          >
            <Play size={14} />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-30 px-3">
          <p className="text-xs text-zinc-400 leading-relaxed">{scene.caption}</p>
        </div>
      </div>
    </section>
  )
}
