import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircle, Palette, Plus } from 'lucide-react'
import api from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import PostCard from '../components/PostCard'
import PostComposer from '../components/PostComposer'
import CommentsPanel from '../components/CommentsPanel'
import StoriesBar from '../components/StoriesBar'
import StoryComposer from '../components/StoryComposer'
import StoryViewer from '../components/StoryViewer'
import NotificationBell from '../components/NotificationBell'
import ParticipationRail from '../components/ParticipationRail'
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

  const [composerOpen, setComposerOpen] = useState(false)
  const [storyComposerOpen, setStoryComposerOpen] = useState(false)
  const [activeRing, setActiveRing] = useState(null)
  const [activePost, setActivePost] = useState(null)

  const unread = Object.values(notifications || {}).reduce((a, b) => a + b, 0)

  const loadStories = useCallback(() => {
    api
      .get('/stories')
      .then(({ data }) => setRings(data.rings || data || []))
      .catch(() => {})
  }, [])

  const loadPage = useCallback(async (target) => {
    setLoading(true)
    try {
      const { data } = await api.get(`/posts/feed?page=${target}&limit=${PAGE_SIZE}`)
      const batch = data.posts || []
      setPosts((prev) => (target === 1 ? batch : [...prev, ...batch]))
      setHasMore(Boolean(data.hasMore))
      setPage(target + 1)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
      setFirstLoad(false)
    }
  }, [])

  useEffect(() => {
    loadStories()
    loadPage(1)
  }, [loadStories, loadPage])

  const onCreated = (post) => setPosts((prev) => [post, ...prev])
  const onDeleted = (id) => setPosts((prev) => prev.filter((p) => p._id !== id))

  // Mute anything containing a hidden word.
  const visiblePosts = useMemo(() => filterHidden(posts, (p) => p.text), [posts])

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2.5">
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-100">Wchat</h1>

          <div className="flex items-center gap-0.5">
            <ThemeButton />
            <button
              type="button"
              onClick={onOpenChat}
              aria-label="Messages"
              className="relative rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-wchat"
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
              className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-wchat"
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
        onOpenStory={setActiveRing}
      />

      <div className="mx-auto max-w-xl px-4 py-4">
        {firstLoad ? (
          <div className="flex justify-center py-24">
            <div className="spinner" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-wchat-400 to-wchat text-2xl font-black text-white">
              K
            </div>
            <p className="text-sm font-semibold text-zinc-200">Your Home is quiet</p>
            <p className="max-w-xs text-xs text-zinc-500">
              Join a Circle or share your first post — it will show up right here.
            </p>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-wchat px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
            >
              <Plus size={14} /> Create a post
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <ParticipationRail onExplore={onExplore} onOpenHub={onOpenHub} />

            {visiblePosts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                showReason
                onCommentClick={setActivePost}
                onDeleted={onDeleted}
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
          <StoryComposer
            onClose={() => setStoryComposerOpen(false)}
            onCreated={() => {
              setStoryComposerOpen(false)
              loadStories()
            }}
          />
        </Overlay>
      ) : null}

      {activeRing ? (
        <StoryViewer
          ring={activeRing}
          onClose={() => {
            setActiveRing(null)
            loadStories()
          }}
        />
      ) : null}

      {activePost ? (
        <CommentsPanel post={activePost} onClose={() => setActivePost(null)} />
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
