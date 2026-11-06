import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Bell, BookOpen, Briefcase, CalendarDays, Clapperboard, Compass, Globe, Heart,
  MessageCircle, Play, Send, ShieldCheck, Sparkles, StickyNote, Trophy, UserPlus, UsersRound, Video, Zap,
} from 'lucide-react'
import { WchatMark } from '../components/Logo'
import LandingPhoneMockup from '../components/LandingPhoneMockup'
import { cn } from '../utils/cn'
import reelDance from '../assets/landing/reel-dance.jpg'
import postHackathon from '../assets/landing/post-hackathon.jpg'
import postKigali from '../assets/landing/post-kigali.jpg'
import postTea from '../assets/landing/post-tea.jpg'
import postRobotics from '../assets/landing/post-robotics.jpg'
import postFootball from '../assets/landing/post-football.jpg'

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://wchat-site.vercel.app').replace(/\/$/, '')
const avatar = (seed, bg = 'c7d5ff') =>
  `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`

const circles = [
  { id: 'kigali-devs', name: 'Kigali Devs', emoji: '💻', members: 12480 },
  { id: 'young-innovators', name: 'Young Innovators', emoji: '🤖', members: 4310 },
  { id: 'amavubi-fans', name: 'Amavubi Fans', emoji: '⚽', members: 28900 },
  { id: 'coffee-lovers', name: 'Rwanda Coffee Lovers', emoji: '☕', members: 7650 },
  { id: 'scholarships', name: 'Scholarships & Careers', emoji: '🎓', members: 19300 },
  { id: 'visit-rwanda', name: 'Visit Rwanda', emoji: '🌄', members: 15100 },
  { id: 'afro-beats', name: 'Afro Beats Studio', emoji: '🎶', members: 9840 },
  { id: 'gasabo', name: 'Gasabo District', emoji: '📍', members: 6230 },
]

const featuredCircles = [
  { id: 'kigali-devs', name: 'Kigali Devs', emoji: '💻', members: 12480, category: 'Technology', cover: postHackathon },
  { id: 'amavubi-fans', name: 'Amavubi Fans', emoji: '⚽', members: 28900, category: 'Sports', cover: postFootball },
  { id: 'coffee-lovers', name: 'Rwanda Coffee Lovers', emoji: '☕', members: 7650, category: 'Food & Drink', cover: postTea },
]

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export default function LandingPage() {
  useEffect(() => {
    document.title = 'Wchat — Where chats become communities'
  }, [])

  return (
    <div className="landing-page min-h-dvh overflow-x-clip bg-[#eef2f8] text-slate-950">
      <Hero />
      <CircleMarquee />
      <VideoShowcase />
      <Features />
      <CirclesSection />
      <Vocabulary />
      <BuiltBy />
      <FinalCta />
      <Footer />
    </div>
  )
}

function Hero() {
  const avatars = [avatar('Eric'), avatar('Aline', 'ffd6dc'), avatar('Diane', 'fde7c4'), avatar('Grace', 'e8d5ff'), avatar('Patrick', 'c7e7ff')]
  return (
    <section className="relative isolate overflow-hidden bg-gradient-hero text-white">
      <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      <div className="animate-drift absolute -left-32 top-20 -z-10 size-[28rem] rounded-full bg-[color:var(--landing-blue)]/40 blur-[110px]" />
      <div className="animate-drift absolute -right-24 bottom-0 -z-10 size-[24rem] rounded-full bg-[color:var(--landing-spark)]/25 blur-[110px]" style={{ animationDelay: '-6s' }} />

      <nav className="relative z-20 mx-auto flex max-w-6xl items-center gap-6 px-5 py-5">
        <Link to="/" aria-label="Wchat home" className="inline-flex items-center gap-2.5">
          <WchatMark size={38} rounded="rounded-xl" />
          <span className="font-display text-xl font-extrabold tracking-tight text-white">Wchat</span>
        </Link>
        <div className="ml-6 hidden items-center gap-7 text-sm font-semibold text-white/85 md:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#circles" className="transition-colors hover:text-white">Circles</a>
          <a href="#video" className="transition-colors hover:text-white">Video</a>
          <a href="#team" className="transition-colors hover:text-white">Our team</a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/auth?mode=login" className="rounded-full px-4 py-2 text-sm font-semibold text-white/95 transition hover:bg-white/10">Log in</Link>
          <Link to="/auth?mode=register" className="rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:brightness-105">Get started</Link>
        </div>
      </nav>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-10 lg:grid-cols-[1.1fr_1fr] lg:pb-32 lg:pt-16">
        <div className="animate-rise text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/20 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <span className="relative flex size-2">
              <span className="animate-ping-soft absolute inline-flex size-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Messaging · Reels · Circles — in one app
          </span>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
            Connect.
            <br />
            Share. <span className="text-gradient-glow">Belong.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/85 lg:mx-0">
            Wchat goes beyond chat. Message and call your friends, share Reels and stories, and find your people in Circles — communities built around what you love and where you live.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link to="/auth?mode=register" className="inline-flex h-13 items-center gap-2 rounded-full bg-gradient-brand px-7 text-base font-bold text-white shadow-glow transition hover:brightness-105">
              Join Wchat free <ArrowRight className="size-5" />
            </Link>
            <a href="#video" className="inline-flex h-13 items-center gap-2 rounded-full border border-white/25 bg-slate-950/20 px-7 text-base font-bold text-white backdrop-blur transition hover:bg-white/10">
              <Play className="size-4 fill-current" /> Watch the video
            </a>
          </div>
          <div className="mt-10 flex items-center justify-center gap-3 lg:justify-start">
            <div className="flex -space-x-2.5">
              {avatars.map((src, i) => (
                <img key={i} src={src} alt="" className="size-9 rounded-full bg-white/20 ring-2 ring-[color:var(--landing-indigo)]" />
              ))}
            </div>
            <p className="text-left text-sm text-white/80">
              Made by students,
              <br />
              <span className="font-semibold text-white">for everyone.</span>
            </p>
          </div>
        </div>

        <div className="relative mx-auto">
          <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-[color:var(--landing-blue-glow)]/30 blur-3xl" />
          <LandingPhoneMockup className="animate-float-slow" />
          <FloatCard className="-left-28 top-16 hidden sm:flex" delay="0s">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[color:var(--landing-spark)] text-white"><Zap className="size-4 fill-current" /></span>
            <span><b className="block text-sm text-slate-900">+128 Sparks</b><span className="text-xs text-slate-600">on your Reel</span></span>
          </FloatCard>
          <FloatCard className="-right-24 top-44 hidden sm:flex" delay="-2s">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white"><Video className="size-4" /></span>
            <span><b className="block text-sm text-slate-900">Video call</b><span className="text-xs text-slate-600">Kigali Devs · 6 live</span></span>
          </FloatCard>
          <FloatCard className="-left-20 bottom-24 hidden sm:flex" delay="-4s">
            <span className="text-2xl">☕</span>
            <span><b className="block text-sm text-slate-900">Coffee Lovers</b><span className="text-xs text-slate-600">invited you to join</span></span>
          </FloatCard>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#eef2f8]" />
    </section>
  )
}

function FloatCard({ children, className, delay }) {
  return (
    <div className={cn('animate-float-slow absolute z-10 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/96 px-3.5 py-3 shadow-float backdrop-blur', className)} style={{ animationDelay: delay }}>
      {children}
    </div>
  )
}

function CircleMarquee() {
  const list = [...circles, ...circles]
  return (
    <section aria-label="Circles on Wchat" className="relative py-8">
      <div className="[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="animate-marquee flex w-max gap-3">
          {list.map((c, i) => (
            <span key={`${c.id}-${i}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-card">
              <span className="text-lg">{c.emoji}</span>
              {c.name}
              <span className="text-xs font-medium text-slate-600">{formatCount(c.members)}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function VideoShowcase() {
  return (
    <section id="video" className="mx-auto max-w-6xl scroll-mt-10 px-5 py-16">
      <div className="reveal grid items-center gap-8 rounded-[2.5rem] border border-slate-200 bg-slate-50 p-6 shadow-float lg:grid-cols-[.95fr_1.25fr] lg:p-8">
        <div>
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--landing-blue)]">See Wchat in action</span>
          <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight text-slate-950">
            A quick look at the <span className="text-gradient-brand">Wchat experience</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">
            Watch how Wchat brings messaging, Reels, stories, and Circles into one place. This preview shows the experience the community is building.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/auth?mode=register" className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-glow">Create account <ArrowRight className="size-4" /></Link>
            <Link to="/auth?mode=login" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:border-[color:var(--landing-blue)]/35">Sign in</Link>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 shadow-float ring-1 ring-black/10">
          <video controls playsInline preload="metadata" className="aspect-video w-full bg-black" src="/take-1.mp4" poster={postKigali}>
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-10 px-5 py-20">
      <SectionTitle
        eyebrow="Everything in one place"
        title={<>One app for your <span className="text-gradient-brand">whole social life</span></>}
        text="No more jumping between apps. Talk, watch, post and gather — all with the people who matter."
      />

      <div className="mt-14 grid auto-rows-[minmax(220px,auto)] gap-4 md:grid-cols-6">
        <article className="reveal group relative overflow-hidden rounded-[2rem] bg-[color:var(--landing-indigo)] p-7 text-white shadow-float md:col-span-4 md:row-span-2">
          <img src={postHackathon} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-20 mix-blend-luminosity" />
          <div className="bg-grid absolute inset-0 opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--landing-indigo)]/92 via-[color:var(--landing-indigo)]/75 to-[color:var(--landing-blue)]/40" />
          <div className="relative flex h-full flex-col">
            <FeatureIcon icon={MessageCircle} inverted />
            <h3 className="mt-5 text-3xl font-bold">Real-time chat & calls</h3>
            <p className="mt-3 max-w-md text-white/85">
              Instant messages with read receipts, voice notes, photos and files. Jump into an audio or video call with one tap — one-to-one or with your whole Circle.
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-8">
              {['Typing indicators', 'Voice notes', 'HD video calls', 'Seen ✓✓', 'File sharing'].map((t) => (
                <span key={t} className="rounded-full border border-white/20 bg-slate-950/15 px-3.5 py-1.5 text-sm font-semibold text-white backdrop-blur">{t}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="reveal group relative overflow-hidden rounded-[2rem] shadow-float md:col-span-2 md:row-span-2">
          <img src={reelDance} alt="A dancer performing in a Wchat Reel" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-110" />
          <div className="bg-gradient-scrim absolute inset-0" />
          <div className="relative flex h-full min-h-[420px] flex-col justify-end p-6 text-white">
            <span className="glass-dark mb-auto flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"><Clapperboard className="size-3.5" /> Reels</span>
            <h3 className="text-2xl font-bold">Short videos that move</h3>
            <p className="mt-2 text-sm text-white/85">Swipe, Spark and remix Reels from creators in your Circles.</p>
            <div className="mt-4 flex gap-4 text-sm font-semibold">
              <span className="flex items-center gap-1.5"><Heart className="size-4 fill-[color:var(--landing-spark)] text-[color:var(--landing-spark)]" /> 12.4k</span>
              <span className="flex items-center gap-1.5"><Send className="size-4" /> 860</span>
            </div>
          </div>
        </article>

        <SmallFeature className="md:col-span-2" icon={Sparkles} title="Stories & Notes" text="Share 24-hour stories, or drop a 60-character Note so friends know what you're up to." />
        <SmallFeature className="md:col-span-2" icon={Compass} title="Buzz" text="Explore trending posts, new Circles and people who share your interests." />
        <SmallFeature className="md:col-span-2" icon={Bell} title="Smart notifications" text="Sparks, replies, mentions and Circle invites — the moments that matter, never noise." />
      </div>
    </section>
  )
}

function SmallFeature({ icon, title, text, className }) {
  return (
    <article className={cn('reveal border-glow group rounded-[2rem] bg-slate-50 p-6 shadow-card transition-transform duration-300 hover:-translate-y-1.5', className)}>
      <FeatureIcon icon={icon} />
      <h3 className="mt-5 text-xl font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{text}</p>
    </article>
  )
}

function FeatureIcon({ icon: Icon, inverted }) {
  return (
    <span className={cn('flex size-12 items-center justify-center rounded-2xl', inverted ? 'bg-white/15 text-white backdrop-blur' : 'bg-gradient-brand text-white shadow-glow')}>
      <Icon className="size-6" />
    </span>
  )
}

const hubSections = [
  { icon: MessageCircle, label: 'Chat', text: 'Group conversations for every member' },
  { icon: Clapperboard, label: 'Reels', text: 'Videos made by and for the Circle' },
  { icon: BookOpen, label: 'Library', text: 'Notes, guides and shared resources' },
  { icon: Trophy, label: 'Challenges', text: 'Compete, create and level up together' },
  { icon: CalendarDays, label: 'Events', text: 'Meetups, matches and hackathons' },
  { icon: Briefcase, label: 'Opportunities', text: 'Jobs, scholarships and gigs' },
]

function CirclesSection() {
  return (
    <section id="circles" className="relative scroll-mt-10 overflow-hidden py-24">
      <div className="bg-grid-light absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <div className="reveal">
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--landing-blue)]">The heart of Wchat</span>
          <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl">
            Circles bring your <span className="text-gradient-brand">people together</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-700">
            A Circle is more than a group chat. Topic Circles unite people around a passion, local Circles connect your neighbourhood, and personal Circles keep your closest friends close.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {hubSections.map(({ icon: Icon, label, text }) => (
              <div key={label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 shadow-card transition-colors hover:border-[color:var(--landing-blue)]/40">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[color:var(--landing-blue)]"><Icon className="size-5" /></span>
                <span><b className="block text-sm text-slate-900">{label}</b><span className="text-xs text-slate-600">{text}</span></span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto h-[520px] w-full max-w-md">
          {featuredCircles.map((c, i) => (
            <article key={c.id} className={cn('reveal absolute w-[78%] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-50 shadow-float transition-transform duration-500 hover:z-20 hover:scale-[1.03]', i === 0 && 'left-0 top-0 -rotate-6', i === 1 && 'right-0 top-32 rotate-3', i === 2 && 'bottom-0 left-6 -rotate-2')}>
              <img src={c.cover} alt="" loading="lazy" className="h-32 w-full object-cover" />
              <div className="flex items-center gap-3 p-4">
                <span className="-mt-10 flex size-12 items-center justify-center rounded-2xl border-4 border-slate-50 bg-white text-2xl shadow-sm">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-600">{formatCount(c.members)} members · {c.category}</p>
                </div>
                <Link to="/auth?mode=register" className="rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-bold text-white">Join</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const words = [
  { icon: Zap, word: 'Spark', means: 'Like a post or Reel' },
  { icon: Send, word: 'Drop', means: 'Share with friends' },
  { icon: UserPlus, word: 'Join', means: 'Follow people & Circles' },
  { icon: Compass, word: 'Buzz', means: "Explore what's trending" },
  { icon: StickyNote, word: 'Notes', means: '60 characters, 24 hours' },
  { icon: UsersRound, word: 'Circles', means: 'Your communities' },
]

function Vocabulary() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="reveal relative overflow-hidden rounded-[2.5rem] bg-gradient-hero px-6 py-14 text-white shadow-float sm:px-12">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="relative">
          <h2 className="text-center font-display text-4xl font-extrabold sm:text-5xl">Speak <span className="text-gradient-glow">Wchat</span></h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-white/85">A social network with its own language. Here&apos;s what you&apos;ll be saying.</p>
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
            {words.map(({ icon: Icon, word, means }) => (
              <div key={word} className="group rounded-3xl border border-white/15 bg-slate-950/15 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/10">
                <Icon className="size-6 text-[color:var(--landing-blue-glow)] transition-transform duration-300 group-hover:scale-125" />
                <p className="mt-4 font-display text-2xl font-bold">{word}</p>
                <p className="mt-1 text-sm text-white/80">{means}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function BuiltBy() {
  const promises = [
    { icon: ShieldCheck, title: 'Private by design', text: 'You decide who can see and message you.' },
    { icon: Globe, title: 'Local & global', text: 'From your school to the whole world.' },
    { icon: Sparkles, title: 'Made to feel good', text: 'Smooth, fast and beautiful on any phone.' },
  ]
  return (
    <section id="team" className="mx-auto max-w-6xl scroll-mt-10 px-5 py-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="reveal overflow-hidden rounded-[2rem] shadow-float">
          <img src={postRobotics} alt="Students building a robot together" loading="lazy" className="h-full max-h-[440px] w-full object-cover" />
        </div>
        <div className="reveal">
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--landing-blue)]">Who&apos;s behind Wchat</span>
          <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight text-slate-950">
            Built by students at <span className="text-gradient-brand">Saint Kizito Save</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-700">
            Wchat is designed and developed by the WT Company team — students who wanted a place where messaging, social sharing and real communities finally live together.
          </p>
          <div className="mt-8 space-y-4">
            {promises.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-card">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-[color:var(--landing-blue)]"><Icon className="size-5" /></span>
                <span><b className="block text-slate-900">{title}</b><span className="text-sm text-slate-700">{text}</span></span>
              </div>
            ))}
          </div>
          <a href={SITE_URL} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 font-semibold text-[color:var(--landing-blue)] hover:underline">
            Visit wchat-site.vercel.app <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="reveal relative overflow-hidden rounded-[2.5rem] bg-gradient-brand px-6 py-16 text-center text-white shadow-glow">
        <div className="bg-grid absolute inset-0 opacity-30" />
        <div className="animate-drift absolute -left-10 -top-10 size-60 rounded-full bg-[color:var(--landing-blue-glow)]/50 blur-3xl" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">Your Circle is waiting.</h2>
          <p className="mx-auto mt-4 max-w-md text-white/85">Create your account in under a minute and start connecting today.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth?mode=register" className="inline-flex h-13 items-center gap-2 rounded-full bg-white px-8 text-base font-bold text-[color:var(--landing-blue)] shadow-float hover:bg-slate-50">
              Create my account <ArrowRight className="size-5" />
            </Link>
            <Link to="/auth?mode=login" className="inline-flex h-13 items-center rounded-full border border-white/25 px-8 text-base font-bold text-white hover:bg-white/10">
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-100/90">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-sm text-slate-700 md:flex-row md:flex-wrap">
        <span className="inline-flex items-center gap-2.5"><WchatMark size={34} rounded="rounded-xl" /><span className="font-display text-lg font-extrabold text-slate-950">Wchat</span></span>
        <p className="md:ml-4">Connect. Share. Belong.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-semibold md:ml-auto">
          <Link to="/auth?mode=login" className="hover:text-[color:var(--landing-blue)]">Log in</Link>
          <Link to="/auth?mode=register" className="hover:text-[color:var(--landing-blue)]">Create account</Link>
          <Link to="/join/demo" className="hover:text-[color:var(--landing-blue)]">Join a Circle</Link>
          <a href={`${SITE_URL}/homepage.html`} className="hover:text-[color:var(--landing-blue)]">About page</a>
          <a href={SITE_URL} target="_blank" rel="noreferrer" className="hover:text-[color:var(--landing-blue)]">wchat-site.vercel.app</a>
        </nav>
      </div>
      <div className="border-t border-slate-200 px-5 py-4 text-center text-xs font-medium text-slate-600">© 2026 WT Company · Saint Kizito Save</div>
    </footer>
  )
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="reveal mx-auto max-w-2xl text-center">
      <span className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--landing-blue)]">{eyebrow}</span>
      <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl">{title}</h2>
      <p className="mt-4 text-lg text-slate-700">{text}</p>
    </div>
  )
}
