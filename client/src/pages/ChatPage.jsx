import { useCallback, useEffect, useMemo, useState } from 'react'
import ChatBox from '../components/ChatBox'
import ChatList from '../components/ChatList'
import CallModal from '../components/CallModal'
import CircleHub from '../components/CircleHub'
import CreateSheet from '../components/CreateSheet'
import EditProfileModal from '../components/EditProfileModal'
import GroupDiscovery from '../components/GroupDiscovery'
import GroupInviteModal from '../components/GroupInviteModal'
import GroupModal from '../components/GroupModal'
import IncomingCallModal from '../components/IncomingCallModal'
import MeetingModal from '../components/MeetingModal'
import MobileNav from '../components/MobileNav'
import NotesBar from '../components/NotesBar'
import PostComposer from '../components/PostComposer'
import ProfileModal from '../components/ProfileModal'
import ReelComposer from '../components/ReelComposer'
import StoryComposer from '../components/StoryComposer'
import SideDrawer from '../components/SideDrawer'
import SideRail from '../components/SideRail'
import UpdateGroupModal from '../components/UpdateGroupModal'
import CommunitiesPage from './CommunitiesPage'
import DiscoverPage from './DiscoverPage'
import HomeFeed from './HomeFeed'
import ProfilePage from './ProfilePage'
import ReelsFeed from './ReelsFeed'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import api from '../config/api'
import Seo from '../components/Seo'
import useWebRTC from '../hooks/useWebRTC'

/**
 * The Wchat application shell.
 *
 * Five primary sections — Home, Explore, Create, Reels, Profile — plus Messages
 * and Communities. Desktop gets a persistent rail; mobile gets a bottom bar and
 * a full-screen Create sheet.
 */
export default function ChatPage() {
  const { user } = useAuth()

  useEffect(() => {
    document.title = 'Messages | Wchat'
  }, [])
  const { selectedChat, selectChat, fetchChats, chats, notifications } = useChat()
  const {
    callState,
    callType,
    peer,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useWebRTC()

  const [tab, setTab] = useState('home')
  const [mobileShowChat, setMobileShowChat] = useState(false)

  /* ------------------------------------------------------------ create flow */
  const [createOpen, setCreateOpen] = useState(false)
  const [showPostComposer, setShowPostComposer] = useState(false)
  const [showStoryComposer, setShowStoryComposer] = useState(false)
  const [showReelComposer, setShowReelComposer] = useState(false)
  const [reelKey, setReelKey] = useState(0)

  /* ------------------------------------------------------------ chat modals */
  const [groupOpen, setGroupOpen] = useState(false)
  const [groupInfoOpen, setGroupInfoOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteChat, setInviteChat] = useState(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [manageChat, setManageChat] = useState(null)
  const [hubChat, setHubChat] = useState(null)
  const [meetingChat, setMeetingChat] = useState(null)
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  const { selectedChat: activeChat, selectChat: selectChatCtx, fetchChats: refetchChats } =
    useChat()

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  // On phones the conversation replaces the list; selecting one opens it.
  useEffect(() => {
    if (selectedChat) setMobileShowChat(true)
  }, [selectedChat])

  const unreadTotal = useMemo(
    () => Object.values(notifications || {}).reduce((sum, n) => sum + (n || 0), 0),
    [notifications]
  )

  const goTab = useCallback(
    (next) => {
      if (next === 'create') {
        setCreateOpen(true)
        return
      }
      if (next === 'chat') setMobileShowChat(Boolean(selectedChat))
      setTab(next)
    },
    [selectedChat]
  )

  const openChat = useCallback(
    (chat) => {
      if (chat) selectChat(chat)
      setMobileShowChat(true)
      setTab('chat')
    },
    [selectChat]
  )

  const openProfileModal = useCallback((target) => {
    if (target) setProfileUser(target)
  }, [])

  const startCallWith = useCallback(
    (type, target) => {
      if (target) startCall(target, type)
    },
    [startCall]
  )

  const onComposerCreated = useCallback(() => {
    // Feed pages refetch on mount; nothing else to do here.
  }, [])

  const tabContent = useMemo(() => {
    switch (tab) {
      case 'home':
        return (
          <HomeFeed
            onOpenChat={() => goTab('chat')}
            onExplore={() => setTab('explore')}
            onOpenHub={(chat) => setHubChat(chat)}
          />
        )
      case 'explore':
        return (
          <DiscoverPage
            onOpenProfile={openProfileModal}
            onOpenHub={(chat) => setHubChat(chat)}
            onOpenCommunities={() => setTab('communities')}
          />
        )
      case 'reels':
        return (
          <ReelsFeed
            onOpenProfile={openProfileModal}
            onOpenHub={(chat) => setHubChat(chat)}
          />
        )
      case 'communities':
        return (
          <CommunitiesPage
            onOpenHub={(chat) => setHubChat(chat)}
            onCreate={() => setGroupOpen(true)}
            onOpenChat={openChat}
            onInvite={async (circle) => {
              setInviteChat(circle)
              setInviteOpen(true)
            }}
            onManage={async (circle) => {
              let found = chats.find((item) => String(item._id) === String(circle._id))
              if (!found) {
                try {
                  const { data } = await api.get(`/chats/${circle._id}`)
                  found = data
                } catch {
                  found = circle
                }
              }
              setManageChat(found)
              setManageOpen(true)
            }}
          />
        )
      case 'profile':
        return (
          <ProfilePage
            onEdit={() => setEditProfileOpen(true)}
            onOpenProfile={openProfileModal}
          />
        )
      case 'chat':
        return (
          <div className="flex h-full min-h-0">
            <aside
              className={`${
                mobileShowChat ? 'hidden' : 'flex'
              } w-full min-w-0 flex-col border-r border-zinc-800/80 bg-zinc-900/40 md:flex md:w-[340px] lg:w-[380px]`}
            >
              <SideDrawer
                onOpenProfile={() => setProfileUser(user)}
                onOpenDiscovery={() => setDiscoveryOpen(true)}
                onNewGroup={() => setGroupOpen(true)}
              />
              <NotesBar />
              <ChatList />
            </aside>

            <section
              className={`${
                mobileShowChat ? 'flex' : 'hidden'
              } min-w-0 flex-1 flex-col md:flex`}
            >
              <ChatBox
                onBack={() => setMobileShowChat(false)}
                onOpenProfile={openProfileModal}
                onStartCall={startCallWith}
                onOpenMeeting={() => setMeetingChat(selectedChat)}
                onOpenGroupInfo={() => setGroupInfoOpen(true)}
                onOpenCircleHub={() => setHubChat(selectedChat)}
              />
            </section>
          </div>
        )
      default:
        return null
    }
  }, [
    tab,
    goTab,
    openChat,
    openProfileModal,
    mobileShowChat,
    user,
    user?._id,
    user?.username,
    user?.profilePicture,
    selectedChat,
  ])

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-950 text-zinc-100">
      <Seo
        noIndex
        path="/"
        title="Messages | Wchat"
        description="Your Wchat messages, Circles, and community activity. This is a private app page and is not indexed by search engines."
      />
      <SideRail
        active={tab}
        onChange={goTab}
        onNewPost={() => goTab('create')}
        onOpenProfile={() => setTab('profile')}
        unreadChat={unreadTotal}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1">{tabContent}</main>
        <MobileNav active={tab} onChange={goTab} unread={unreadTotal} />
      </div>

          {createOpen ? (
            <CreateSheet
              onClose={() => setCreateOpen(false)}
              onPick={(kind) => {
                setCreateOpen(false)
                if (kind === 'post') setShowPostComposer(true)
                else if (kind === 'story') setShowStoryComposer(true)
                else if (kind === 'reel') setShowReelComposer(true)
                else if (kind === 'community') setGroupOpen(true)
              }}
            />
          ) : null}

      {showPostComposer ? (
        <Overlay>
          <PostComposer
            onClose={() => setShowPostComposer(false)}
            onCreated={onComposerCreated}
          />
        </Overlay>
      ) : null}

      {showStoryComposer ? (
        <Overlay>
          <StoryComposer
            onClose={() => setShowStoryComposer(false)}
            onCreated={onComposerCreated}
          />
        </Overlay>
      ) : null}

      {showReelComposer ? (
        <ReelComposer
          onClose={() => setShowReelComposer(false)}
          onCreated={() => {
            setShowReelComposer(false)
            setTab('reels')
          }}
        />
      ) : null}

      {groupOpen ? (
        <GroupModal
          onClose={() => {
            setGroupOpen(false)
            fetchChats()
          }}
          onCreated={(created) => {
            setGroupOpen(false)
            setInviteChat(created)
            setInviteOpen(true)
            fetchChats()
          }}
        />
      ) : null}

      {inviteOpen ? (
        <GroupInviteModal
          chat={inviteChat}
          onClose={() => {
            setInviteOpen(false)
            setInviteChat(null)
          }}
        />
      ) : null}

      {groupInfoOpen && selectedChat ? (
        <UpdateGroupModal
          onClose={() => setGroupInfoOpen(false)}
          onOpenProfile={openProfileModal}
        />
      ) : null}

      {manageOpen && manageChat ? (
        <UpdateGroupModal
          chat={manageChat}
          onClose={() => {
            setManageOpen(false)
            setManageChat(null)
            fetchChats()
          }}
          onOpenProfile={openProfileModal}
        />
      ) : null}

      {hubChat ? (
        <CircleHub
          chat={hubChat}
          onClose={() => setHubChat(null)}
          onOpenProfile={openProfileModal}
        />
      ) : null}

      {meetingChat ? (
        <MeetingModal chat={meetingChat} onClose={() => setMeetingChat(null)} />
      ) : null}

      {discoveryOpen ? <GroupDiscovery onClose={() => setDiscoveryOpen(false)} /> : null}

      {profileUser ? (
        <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
      ) : null}

      {editProfileOpen ? (
        <EditProfileModal onClose={() => setEditProfileOpen(false)} />
      ) : null}

      {callState === 'incoming' && incomingCall ? (
        <IncomingCallModal
          call={incomingCall}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      ) : null}

      {callState === 'outgoing' || callState === 'active' ? (
        <CallModal
          state={callState}
          callType={callType}
          peerName={peer?.name || 'Wchat member'}
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onEnd={endCall}
        />
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
