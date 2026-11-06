import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageCircle, Palette, Plus, X } from 'lucide-react'
import api from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import PostCard from '../components/PostCard'
import PostComposer from '../components/PostComposer'
import StoriesBar from '../components/StoriesBar'
import StoryComposer from '../components/StoryComposer'
import StoryViewer from '../components/StoryViewer'
import NotificationBell from '../components/NotificationBell'
import ParticipationRail from '../components/ParticipationRail'
import ErrorBoundary from '../components/ErrorBoundary'
import { applyTheme, getTheme, nextTheme } from '../utils/theme'
import { filterHidden } from '../utils/contentFilter'

const PAGE_SIZE = 10

/**
 * Home — the member's personal stream.
 * Stories tray on top, the ranked feed below, and quick access to Messages,
 * Notifications, Create and the theme switcher in the header.
 */
export default function HomeFeed({ onOpenChat, onExplore, onOpenHub }) {
  const { user } = useAuth()
  const { notifications } = useChat()

  const [rings, setRings] = useState([])
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)
  const [tab, setTab] = useState('for_you')
  const tabRef = useRef(tab)
  // Rolling deploy safety: if the API does not have /feeds/home yet (older
  // server during a client-first deploy), keep Home working on /posts/feed.
  const legacyFeedRef = useRef(false)

  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  useEffect(() => {
    document.title = "Home Feed | Wchat"
  }, [])

  const [composerOpen, setComposerOpen] = useState(false)
  const [storyComposerOpen, setStoryComposerOpen] = useState(false)
  const [activeRing, setActiveRing] = useState(null)
  const [activeRingIndex, setActiveRingIndex] = useState(0)

  const openStory = (storyRing, index = 0) => {
    setActiveRing(storyRing)
    setActiveRingIndex(index)
  }

  const unread = Object.values(notifications || {}).reduce((a, b) => a + b, 0)

  const loadStories = useCallback(() => {
    api
      .get('/stories')
      .then(({ data }) => setRings(data.rings || data || []))
      .catch(() => {})
  }, [])

  const loadPage = useCallback(async (target) => {
    const requestedTab = tab
    setLoading(true)
    try {
      let data
      if (legacyFeedRef.current) {
        ;({ data } = await api.get(`/posts/feed?page=${target}&limit=${PAGE_SIZE}`))
      } else {
        try {
          ;({ data } = await api.get(
            `/feeds/home?tab=${requestedTab}&page=${target}&limit=${PAGE_SIZE}`
          ))
        } catch (error) {
          if (error?.response?.status !== 404) throw error
          legacyFeedRef.current = true
          ;({ data } = await api.get(`/posts/feed?page=${target}&limit=${PAGE_SIZE}`))
        }
      }
      if (requestedTab !== tabRef.current) return
      // The server may force the chronological tab when personalisation is off.
      if (target === 1 && data.tab && data.tab !== requestedTab) {
        tabRef.current = data.tab
        setTab(data.tab)
      }
      const batch = data.posts || []
      setPosts((prev) => {
        if (target === 1) return batch
        // Re-ranking can shift items between requests; never render a post
        // twice when the next page overlaps the previous one.
        const seen = new Set(prev.map((post) => String(post._id)))
        return [...prev, ...batch.filter((post) => !seen.has(String(post._id)))]
      })
      setHasMore(Boolean(data.hasMore))
      setPage(target + 1)
    } catch {
      if (requestedTab === tabRef.current) setHasMore(false)
    } finally {
      if (requestedTab === tabRef.current) {
        setLoading(false)
        setFirstLoad(false)
      }
    }
  }, [tab])

  useEffect(() => {
    loadStories()
  }, [loadStories])

  useEffect(() => {
    loadPage(1)
  }, [loadPage])

  const changeTab = (next) => {
    if (next === tab) return
    tabRef.current = next
    setPosts([])
    setPage(1)
    setHasMore(true)
    setFirstLoad(true)
    setTab(next)
  }

  const onCreated = (post) => setPosts((prev) => [post, ...prev])
  const onDeleted = (id) => setPosts((prev) => prev.filter((p) => p._id !== id))
  const onNotInterested = (id) => setPosts((prev) => prev.filter((p) => p._id !== id))

  // Mute anything containing a hidden word.
  const visiblePosts = useMemo(() => filterHidden(posts, (p) => p.text), [posts])

  return (
    <div className="h-full min-h-0 overflow-y-auto wchat-hero-mesh">
      <header className="sticky top-0 z-20 border-b border-zinc-800/70 wchat-glass">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-100">Wchat</h1>
            <p className="text-[11px] font-medium text-zinc-500">Connect. Share. Belong.</p>
          </div>

          <div className="flex items-center gap-0.5">
            <ThemeButton />
            <button
              type="button"
              onClick={onOpenChat}
              aria-label="Messages"
              className="relative rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-wchat"
            >
              <MessageCircle size={20} />
              {unread > 0 ? (
                <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              aria-label="Create a post"
              className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-wchat"
            >
              <Plus size={20} />
            </button>
            <NotificationBell />
          </div>
        </div>
      </header>

      <StoriesBar
        rings={rings}
        currentUser={user}
        onAddStory={() => setStoryComposerOpen(true)}
        onOpenStory={openStory}
      />

      <div className="border-b border-zinc-800/70 bg-zinc-950/35 backdrop-blur-sm">
        <div className="mx-auto flex max-w-xl gap-1 px-4">
          <FeedTab
            active={tab === 'for_you'}
            onClick={() => changeTab('for_you')}
          >
            For you
          </FeedTab>
          <FeedTab
            active={tab === 'following'}
            onClick={() => changeTab('following')}
          >
            Following
          </FeedTab>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-4">
        {firstLoad ? (
          <div className="flex justify-center py-24">
            <div className="spinner" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-zinc-800/70 bg-zinc-900/45 px-6 py-16 text-center shadow-card backdrop-blur-sm">
            <div className="grid h-16 w-16 place-items-center rounded-2xl wchat-gradient text-2xl font-black text-white wchat-glow">
              W
            </div>
            <p className="text-sm font-semibold text-zinc-100">
              {tab === 'following' ? 'Nothing from your Circles yet' : 'Your Home is ready for a spark'}
            </p>
            <p className="max-w-xs text-xs text-zinc-500">
              {tab === 'following'
                ? 'Join a Circle or follow a few people — their posts will show up here in order.'
                : 'Join a Circle or share your first post — stories, Reels, and community updates will flow in here.'}
            </p>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-2xl wchat-gradient px-4 py-2.5 text-xs font-semibold text-white wchat-glow transition hover:brightness-110"
            >
              <Plus size={14} /> Create a post
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <ParticipationRail onExplore={onExplore} onOpenHub={onOpenHub} />

            {visiblePosts.map((post, index) => (
              <PostCard
                key={post._id}
                post={post}
                showReason
                surface={tab === 'following' ? 'following' : 'home'}
                position={index}
                onDeleted={onDeleted}
                onNotInterested={onNotInterested}
              />
            ))}

            {hasMore ? (
              <button
                type="button"
                onClick={() => loadPage(page)}
                disabled={loading}
                className="mx-auto flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-60"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                Show more
              </button>
            ) : (
              <p className="py-6 text-center text-xs text-zinc-500">You're all caught up ✨</p>
            )}
          </div>
        )}
      </div>

      {composerOpen ? (
        <Overlay>
          <PostComposer onClose={() => setComposerOpen(false)} onCreated={onCreated} />
        </Overlay>
      ) : null}

      {storyComposerOpen ? (
        <Overlay>
          <ErrorBoundary fallback={({ reset }) => (
            <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              <h3 className="text-sm font-semibold text-zinc-100 mb-4">Story composer</h3>
              <p className="text-xs text-zinc-500 mb-4">Unable to load the story composer.</p>
              <button
                type="button"
                onClick={reset}
                className="rounded-md px-3 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
              >
                Try again
              </button>
            </div>
          )}>
            <StoryComposer
              onClose={() => setStoryComposerOpen(false)}
              onCreated={() => {
                setStoryComposerOpen(false)
                loadStories()
              }}
            />
          </ErrorBoundary>
        </Overlay>
      ) : null}

      {activeRing ? (
        <ErrorBoundary fallback={({ reset }) => (
          <div className="fixed inset-0 z-50 flex flex-col bg-black">
            <div className="z-30 px-4 pb-2 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="truncate text-xs font-semibold text-white">Story</p>
              </div>
              <button
                type="button"
                onClick={() => { setActiveRing(null); reset() }}
                className="rounded-full p-1.5 text-white/80 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 items-center justify-center text-zinc-500 text-sm">
              Unable to load story. <button onClick={reset} className="underline">Try again</button>
            </div>
          </div>
        )}>
          <StoryViewer
            ring={activeRing}
            rings={rings}
            startIndex={activeRingIndex}
            currentUser={user}
            onChanged={loadStories}
            onClose={() => {
              setActiveRing(null)
              loadStories()
            }}
          />
        </ErrorBoundary>
      ) : null}
    </div>
  )
}

function Overlay({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {children}
    </div>
  )
}

/** Segmented control for the ranked vs chronological Home feed. */
function FeedTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-2.5 text-xs font-semibold transition ${
        active ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
      <span
        className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full transition ${
          active ? 'bg-wchat' : 'bg-transparent'
        }`}
      />
    </button>
  )
}

/** Cycles Light → Dark → Midnight and applies it instantly. */
function ThemeButton() {
  const [theme, setTheme] = useState(getTheme())
  return (
    <button
      type="button"
      onClick={() => setTheme(applyTheme(nextTheme(theme)))}
      aria-label="Switch theme"
      title={`Theme: ${theme}`}
      className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-wchat"
    >
      <Palette size={20} />
    </button>
  )
}
