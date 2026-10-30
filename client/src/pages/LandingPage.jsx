import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Film,
  MessageCircle,
  Phone,
  ShieldCheck,
  Share,
  Smartphone,
  Users,
  Video,
  Zap,
} from 'lucide-react'
import Logo from '../components/Logo'
import PromoReel from '../components/PromoReel'
import Seo from '../components/Seo'
import logoImage from '../../logo.png'

const FEATURES = [
  {
    icon: <Users size={20} strokeWidth={2} />,
    title: 'Create a Circle',
    body: 'Make a topic or local community in seconds. Members optional at start; invite people later.',
  },
  {
    icon: <Share size={20} strokeWidth={2} />,
    title: 'Invite with link or QR',
    body: 'Every Circle gets a shareable invite code and QR code. Open Circles join instantly.',
  },
  {
    icon: <MessageCircle size={20} strokeWidth={2} />,
    title: 'Chat and call',
    body: 'Realtime group messaging, presence, and WebRTC calls inside your Circle.',
  },
  {
    icon: <Film size={20} strokeWidth={2} />,
    title: 'Reels, Stories, Library',
    body: 'Share short videos, disappearing stories, documents, events, challenges, and opportunities.',
  },
  {
    icon: <ShieldCheck size={20} strokeWidth={2} />,
    title: 'Circle access control',
    body: 'Admins set one policy for who can post, invite, publish, and manage members.',
  },
  {
    icon: <Phone size={20} strokeWidth={2} />,
    title: 'Events and decisions',
    body: 'Schedule events, track participation, and record group decisions in one place.',
  },
]

const STEPS = [
  {
    number: '1',
    title: 'Create your Circle',
    body: 'Pick a name, optional avatar, description, and whether anyone can join or needs approval.',
  },
  {
    number: '2',
    title: 'Add people',
    body: 'Invite contacts by username, share the invite link, or let people scan your QR code.',
  },
  {
    number: '3',
    title: 'Build together',
    body: 'Chat, call, share Reels, Spark posts, join challenges, and manage members as the Circle grows.',
  },
]

const FAQS = [
  {
    q: 'Is Wchat free to use?',
    a: 'Yes. Wchat is free to create Circles, chat, and share content. Optional media storage may use Cloudinary when configured.',
  },
  {
    q: 'Can I create a community without adding members first?',
    a: 'Yes. Create the Circle yourself, then invite others with a link, QR code, or username search.',
  },
  {
    q: 'Who can join my Circle?',
    a: 'You choose. Open Circles let anyone with the link join instantly. Request Circles require admin approval.',
  },
  {
    q: 'Is my profile data public?',
    a: 'No. Search and public profiles show only name, username, profile picture, and online status. Email, phone, and address are never exposed in search.',
  },
]

const INSIDE = [
  {
    icon: <MessageCircle size={26} strokeWidth={2} />,
    title: 'Real-time Circles chat',
    body: 'Group messaging with replies, reactions, read receipts, and WebRTC voice/video calls.',
  },
  {
    icon: <Video size={26} strokeWidth={2} />,
    title: 'Reels & Stories',
    body: 'Short videos and disappearing stories, now with music search to score your moments.',
  },
  {
    icon: <Zap size={26} strokeWidth={2} />,
    title: 'Spark, Challenges & Events',
    body: 'React to posts, join challenges, schedule events, and record group decisions.',
  },
  {
    icon: <ShieldCheck size={26} strokeWidth={2} />,
    title: 'Admin control panel',
    body: 'Set join policies, access rules, member roles, and moderate content from one place.',
  },
]

export default function LandingPage() {
  const location = useLocation()
  const from = location.state?.from?.pathname || '/auth'
  const [musicSearch, setMusicSearch] = useState('')

  return (
    <div className="flex h-full flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <Seo
        title="Wchat — Where chats become communities"
        description="Mobile-first community network built around Circles. Create a Circle, invite people with a link or QR code, chat in real time, and share Reels, Stories, and Library content."
        path="/"
      />

      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logoImage}
              alt="Wchat"
              className="h-9 w-9 rounded-xl shadow-lg shadow-amber-500/20"
              width={48}
              height={48}
            />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-br from-amber-400 to-wchat-500 bg-clip-text text-transparent">
              Wchat
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <Link to="/auth" className="text-zinc-300 hover:text-white transition">
              Sign in
            </Link>
            <a
              href="https://www.wchat.app/privacy"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition"
            >
              Privacy
            </a>
          </div>
          <Link
            to="/auth"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-300"
          >
            <ArrowRight size={14} /> Get started
          </Link>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {/* Hero gradient glow behind */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <section className="px-4 py-16 md:py-24 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20 mb-6">
            <span className="relative flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Live on Wchat
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Where chats<span className="text-amber-400"> become communities</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Wchat is a mobile-first social network built around Circles. Create a community, invite
            people with a link or QR code, chat in real time, and share Reels, Stories with music,
            and Library content.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="relative w-full sm:w-[320px] max-w-[320px] aspect-[9/16] rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-2xl shadow-amber-500/10">
              <PromoReel />
              <div className="absolute inset-0 flex items-end p-4">
                <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-full backdrop-blur">
                  <div className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-white font-medium">Live preview</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 w-full sm:w-[300px]">
              <Link
                to="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-300 hover:shadow-amber-500/40"
              >
                Create your account <ArrowRight size={16} />
              </Link>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-5 py-3.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition"
              >
                <Smartphone size={16} /> Explore as guest
              </button>
              <p className="text-xs text-zinc-500">
                Already have an account?{' '}
                <Link to="/auth" className="text-amber-400 hover:text-amber-300 underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-16 border-y border-zinc-800/60 bg-zinc-900/30 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-xl md:text-2xl font-semibold mb-3">How it works</h2>
            <p className="text-sm text-zinc-500">From empty screen to active Circle in three taps.</p>
          </div>
          <ol className="max-w-5xl mx-auto grid gap-8 md:grid-cols-3 text-center">
            {STEPS.map((step) => (
              <li key={step.number} className="flex flex-col items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-white font-bold shadow-lg shadow-amber-500/30">
                  {step.number}
                </span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Inside Wchat gallery */}
        <section className="px-4 py-16 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-xl md:text-2xl font-semibold mb-3">Inside Wchat</h2>
            <p className="text-sm text-zinc-500">What your Circle looks like once you&apos;re in.</p>
          </div>
          <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {INSIDE.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 hover:border-zinc-700 hover:bg-zinc-900/80 transition group"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 mb-4 group-hover:bg-amber-500/20 transition">
                  {item.icon}
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features grid */}
        <section className="px-4 py-16 bg-zinc-900/30 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-xl md:text-2xl font-semibold mb-3">Built for communities</h2>
            <p className="text-sm text-zinc-500">Everything a Circle needs to grow and stay active.</p>
          </div>
          <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 hover:border-zinc-700 transition"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 py-16 text-center relative z-10">
          <h2 className="text-xl md:text-2xl font-semibold mb-6">Frequently asked questions</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {FAQS.map(({ q, a }, index) => (
              <div key={index} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
                <p className="text-sm font-semibold mb-2">{q}</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16 border-t border-zinc-800/60 text-center relative z-10">
          <h2 className="text-xl md:text-2xl font-semibold mb-4">Start your first Circle today</h2>
          <p className="text-lg text-zinc-400 mb-6">Create a community and add the people who matter.</p>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-300 hover:shadow-amber-500/40"
          >
            Create account <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-xs text-zinc-500">
            Already have an account?{' '}
            <Link to={from} className="text-amber-400 hover:text-amber-300 underline">
              Sign in
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-zinc-800/60 bg-zinc-900/40 py-8 relative z-10">
        <div className="px-4 text-center">
          <p className="text-xs text-zinc-500 mb-1">
            A product of <span className="text-amber-400 font-semibold">WUT Company</span>
          </p>
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} WUT Company. Wchat — Circles, chats, and communities
            built for real connection.
          </p>
        </div>
      </footer>
    </div>
  )
}
