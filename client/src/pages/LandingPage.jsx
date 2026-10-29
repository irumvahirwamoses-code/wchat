import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Film,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  Users,
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
    icon: <Share2 size={20} strokeWidth={2} />,
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

export default function LandingPage() {
  const location = useLocation()
  const from = location.state?.from?.pathname || '/auth'

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
              className="h-9 w-9 rounded-xl"
              width={48}
              height={48}
            />
            <span className="text-xl font-bold tracking-tight">Wchat</span>
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
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-300"
          >
            <ArrowRight size={14} /> Get started
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 py-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-4">
            <span className="relative flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Live on Wchat
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Where chats<span className="text-amber-400"> become communities</span>
          </h1>
          <p className="text-lg text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Wchat is a mobile-first social network built around Circles. Create a community, invite
            people with a link or QR code, and chat, call, and share Reels in real time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <PromoReel />
            <div className="hidden sm:block w-1 border border-zinc-800" />
            <div className="flex flex-col gap-4 w-full sm:w-[260px]">
              <Link
                to="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-amber-300 transition"
              >
                Create your account <ArrowRight size={16} />
              </Link>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-5 py-3.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition"
              >
                <Smartphone size={16} /> Explore as a guest
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

        <section className="px-4 py-14 border-y border-zinc-800/60 bg-zinc-900/30">
          <h2 className="text-center text-xl font-semibold mb-10">How it works</h2>
          <ol className="max-w-5xl mx-auto grid gap-8 md:grid-cols-3 text-center">
            {STEPS.map((step) => (
              <li key={step.number} className="flex flex-col items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-white font-bold">
                  {step.number}
                </span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="px-4 py-14">
          <h2 className="text-center text-xl font-semibold mb-10">Built for communities</h2>
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

        <section className="px-4 py-14 text-center">
          <h2 className="text-xl font-semibold mb-6">Frequently asked questions</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {FAQS.map(({ q, a }, index) => (
              <div key={index} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
                <p className="text-sm font-semibold mb-2">{q}</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

          <section className="px-4 py-14 border-t border-zinc-800/60 text-center">
            <h2 className="text-xl font-semibold mb-4">Start your first Circle today</h2>
            <p className="text-lg text-zinc-400 mb-6">Create a community and add the people who matter.</p>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-amber-300 transition"
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

      <footer className="border-t border-zinc-800/60 bg-zinc-900/40 py-8">
        <div className="px-4 text-center">
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} Wchat. Circles, chats, and communities built for real
            connection.
          </p>
        </div>
      </footer>
    </div>
  )
}
