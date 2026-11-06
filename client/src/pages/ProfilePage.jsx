import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, Bookmark, Grid3x3, Link2, Loader2, Lock, Settings } from 'lucide-react'
import api from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import Avatar from '../components/Avatar'
import PostCard from '../components/PostCard'
import StoryComposer from '../components/StoryComposer'
import ProfileInsights from '../components/ProfileInsights'
import ProfileSocial from '../components/ProfileSocial'
import SettingsPanel from '../components/Settings'
import SideRail from '../components/SideRail'
import MobileNav from '../components/MobileNav'
import EditProfileModal from '../components/EditProfileModal'
import AdminDashboard from './AdminDashboard'
import FeedbackModal from '../components/FeedbackModal'
import NotificationPage from './NotificationPage'
import { formatHandle } from '../utils/handle'
import { getId } from '../utils/api'

const TABS = [
  { id: 'posts', label: 'Posts', icon: Grid3x3 },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
]

export default function ProfilePage({ onEdit, onOpenProfile, embedded = false }) {
  const navigate = useNavigate()
  const { userId } = useParams()
  const { user, isSuperAdmin } = useAuth()
  const { unreadCount: notificationUnreadCount, notifications } = useChat()
  const targetId = userId || getId(user)
  const isMe = String(targetId) === String(getId(user))

  const [posts, setPosts] = useState([])
  const [saved, setSaved] = useState([])
  const [profile, setProfile] = useState(null)
  const [circleCount, setCircleCount] = useState(0)
  const [social, setSocial] = useState({ followersCount: 0, followingCount: 0 })
  const [socialOpen, setSocialOpen] = useState(false)
  const [socialTab, setSocialTab] = useState('followers')
  const [tab, setTab] = useState('posts')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [storyComposerOpen, setStoryComposerOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)

  useEffect(() => {
    document.title = 'Profile | Wchat'
  }, [])

  const openSocial = (which) => {
    setSocialTab(which)
    setSocialOpen(true)
  }

  /** Keep the rail / bottom bar behaving exactly like the main app shell. */
  const goSection = useCallback(
    (id) => {
      if (id === 'profile') {
        if (!isMe) navigate(`/user/${getId(user)}`, { replace: true })
        return
      }
      if (id === 'create') {
        navigate('/', { state: { tab: 'home', openCreate: true } })
        return
      }
      navigate('/', { state: { tab: id } })
    },
    [navigate, isMe, user]
  )

  const load = useCallback(
    async (signal) => {
      if (!targetId) return

      setLoading(true)
      setNotFound(false)
      // Never flash the previous profile (or your own) while this one loads.
      setProfile(null)
      setPosts([])
      setSaved([])
      setSocial({ followersCount: 0, followingCount: 0 })
      setCircleCount(0)

      // Each request is settled independently: one failing endpoint must not
      // turn another member's profile into your own data.
      const results = await Promise.allSettled([
        isMe ? api.get('/auth/me') : api.get(`/users/${targetId}`),
        api.get(`/posts/user/${targetId}?page=1&limit=12`),
        isMe ? api.get('/circles/mine') : Promise.resolve({ data: [] }),
        isMe ? api.get('/posts/saved?limit=12') : Promise.resolve({ data: { posts: [] } }),
        api.get(`/users/${targetId}/social`),
      ])

      if (signal?.aborted) return

      const [profRes, feedRes, circlesRes, savedRes, socialRes] = results

      if (profRes.status === 'fulfilled') {
        setProfile(profRes.value.data || (isMe ? user : null))
      } else if (isMe) {
        setProfile(user)
      } else {
        const status = profRes.reason?.response?.status
        setNotFound(status === 404 || status === 400)
      }

      if (feedRes.status === 'fulfilled') {
        setPosts(feedRes.value.data?.posts || [])
      }

      if (circlesRes.status === 'fulfilled') {
        const circles = circlesRes.value.data
        setCircleCount(
          Array.isArray(circles) ? circles.length : circles?.circles?.length || 0
        )
      }

      if (savedRes.status === 'fulfilled') {
        setSaved(savedRes.value.data?.posts || [])
      }

      if (socialRes.status === 'fulfilled') {
        setSocial({
          followersCount: socialRes.value.data?.followersCount || 0,
          followingCount: socialRes.value.data?.followingCount || 0,
        })
      }

      setLoading(false)
    },
    [targetId, isMe, user]
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const del = (id) => setPosts((prev) => prev.filter((x) => x._id !== id))
  const delSaved = (id) => setSaved((prev) => prev.filter((x) => x._id !== id))

  const content = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
          <header className="border-b border-zinc-800/80 px-4 py-5">
            <div className="mx-auto mb-3 max-w-2xl">
              <button
                type="button"
                onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
              >
                <ArrowLeft size={13} /> Back
              </button>
            </div>
            <div className="mx-auto flex max-w-2xl items-start gap-4">
              <Avatar
                src={profile?.profilePicture}
                name={`${profile?.firstName || ''} ${profile?.lastName || ''}`}
                size={84}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-zinc-100">
                      {`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()}
                    </h2>
                    <p className="text-xs text-wchat">{formatHandle(profile?.username)}</p>
                    {profile?.category ? (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-wchat/10 px-2 py-0.5 text-[10px] font-semibold text-wchat">
                          {profile.category}
                        </span>
                        {profile.accountType && profile.accountType !== 'personal' ? (
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold capitalize text-zinc-300">
                            {profile.accountType}
                          </span>
                        ) : null}
                      </p>
                    ) : profile?.accountType && profile.accountType !== 'personal' ? (
                      <span className="mt-1 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold capitalize text-zinc-300">
                        {profile.accountType}
                      </span>
                    ) : null}
                  </div>
                  <div className="ml-auto flex gap-2">
                    {isMe ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditProfileOpen(true)}
                          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-wchat/50 hover:text-wchat"
                        >
                          Edit profile
                        </button>
                        <button
                          type="button"
                          onClick={() => setStoryComposerOpen(true)}
                          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-wchat/50 hover:text-wchat"
                        >
                          Add story
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSettings(true)}
                          title="Settings"
                          className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-zinc-400 hover:bg-zinc-900"
                        >
                          <Settings size={14} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-3 flex gap-5 text-center">
                  <div>
                    <dt className="text-[11px] text-zinc-500">Posts</dt>
                    <dd className="text-sm font-semibold text-zinc-100">{posts.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-zinc-500">Circles</dt>
                    <dd className="text-sm font-semibold text-zinc-100">{circleCount}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-zinc-500">Joins</dt>
                    <dd>
                      <button
                        type="button"
                        onClick={() => openSocial('followers')}
                        className="text-sm font-semibold text-zinc-100 transition hover:text-wchat"
                        title="People who joined this profile"
                      >
                        {social.followersCount}
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-zinc-500">Following</dt>
                    <dd>
                      <button
                        type="button"
                        onClick={() => openSocial('following')}
                        className="text-sm font-semibold text-zinc-100 transition hover:text-wchat"
                        title="People this profile follows"
                      >
                        {social.followingCount}
                      </button>
                    </dd>
                  </div>
                </dl>

                {profile?.bio ? (
                  <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-400">
                    {profile.bio}
                  </p>
                ) : null}
                {profile?.interests?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.interests.slice(0, 6).map((i) => (
                      <span key={i} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        {i}
                      </span>
                    ))}
                  </div>
                ) : null}

                {Array.isArray(profile?.links) && profile.links.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.links.slice(0, 5).map((link) => (
                      <a
                        key={`${link.title}-${link.url}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-wchat transition hover:border-wchat/50"
                      >
                        <Link2 size={12} className="shrink-0" />
                        <span className="truncate">{link.title || link.url}</span>
                      </a>
                    ))}
                  </div>
                ) : null}

                {profile?.isPrivate ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/70 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                    <Lock size={11} /> Private account
                  </p>
                ) : null}
              </div>
            </div>
          </header>

          <nav className="flex border-b border-zinc-800/80">
            {TABS.map((t) => {
              const Icon = t.icon
              const on = tab === t.id
              if ((t.id === 'saved' || t.id === 'insights') && !isMe) return null
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition ${
                    on ? 'border-b-2 border-wchat text-wchat' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon size={14} /> {t.label}
                </button>
              )
            })}
          </nav>

          <main className="px-4 py-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-wchat" size={18} />
              </div>
            ) : notFound ? (
              <p className="py-10 text-center text-xs text-zinc-600">
                This profile could not be loaded. It may have been removed or the
                link is invalid.
              </p>
            ) : tab === 'insights' ? (
              <div className="px-4">
                <ProfileInsights />
              </div>
            ) : tab === 'posts' ? (
              posts.length ? (
                posts.map((p, index) => (
                  <PostCard
                    key={p._id}
                    post={p}
                    surface="profile"
                    position={index}
                    onDeleted={del}
                  />
                ))
              ) : (
                <p className="py-10 text-center text-xs text-zinc-600">
                  {profile?.isPrivate && !isMe ? 'This account is private. Join them to see their posts.' : 'No posts yet'}
                </p>
              )
            ) : saved.length ? (
              saved.map((p, index) => (
                <PostCard
                  key={p._id}
                  post={p}
                  surface="profile"
                  position={index}
                  onDeleted={delSaved}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-zinc-600">Nothing saved yet</p>
            )}
          </main>
      </div>

      {socialOpen ? (
        <ProfileSocial
          userId={targetId}
          initialTab={socialTab}
          onClose={() => setSocialOpen(false)}
          onOpenProfile={(person) => {
            const id = getId(person)
            if (id) {
              setSocialOpen(false)
              navigate(`/user/${id}`)
            }
          }}
        />
      ) : null}

      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}

      {storyComposerOpen && (
        <StoryComposer
          onClose={() => setStoryComposerOpen(false)}
          onCreated={() => setStoryComposerOpen(false)}
        />
      )}

      {editProfileOpen && (
        <EditProfileModal onClose={() => setEditProfileOpen(false)} />
      )}

      {adminOpen && (
        <AdminDashboard onClose={() => setAdminOpen(false)} />
      )}

      {feedbackOpen ? (
        <FeedbackModal onClose={() => setFeedbackOpen(false)} />
      ) : null}

      {notificationOpen ? (
        <NotificationPage onClose={() => setNotificationOpen(false)} />
      ) : null}
    </>
  )

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col bg-zinc-950 text-zinc-100">{content}</div>
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-950 text-zinc-100">
      <SideRail
        active="profile"
        onChange={goSection}
        onNewPost={() =>
          navigate('/', { state: { tab: 'home', openCreate: true } })
        }
        onOpenProfile={() => navigate(`/user/${getId(user)}`)}
        onOpenAdmin={isSuperAdmin ? () => setAdminOpen(true) : null}
        onOpenFeedback={() => setFeedbackOpen(true)}
        onOpenNotifications={() => setNotificationOpen(true)}
        unreadChat={Object.values(notifications || {}).reduce((sum, n) => sum + (n || 0), 0)}
        unreadNotifications={notificationUnreadCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {content}
        <MobileNav
          active="profile"
          onChange={goSection}
          unread={Object.values(notifications || {}).reduce((sum, n) => sum + (n || 0), 0)}
          onOpenNotifications={() => setNotificationOpen(true)}
          unreadNotifications={notificationUnreadCount}
        />
      </div>
    </div>
  )
}
