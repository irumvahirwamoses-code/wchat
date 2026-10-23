import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Users, XCircle } from 'lucide-react'
import api, { getApiError } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'

/**
 * Landing page for a scanned QR invite: `/join/:code`. Signed-in visitors are
 * added on the spot; signed-out visitors are sent to sign in and the code is
 * redeemed afterwards.
 */
export default function JoinCirclePage() {
  const { code } = useParams()
  const { token } = useAuth()
  const { fetchChats, selectChat } = useChat()
  const navigate = useNavigate()

  const [status, setStatus] = useState('joining') // joining | joined | pending | error
  const [circle, setCircle] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (token) return
    try {
      localStorage.setItem('wchatPendingJoin', code || '')
    } catch {
      /* storage unavailable */
    }
    navigate('/auth', { replace: true })
  }, [token, code, navigate])

  useEffect(() => {
    if (!token || !code) return undefined
    let cancelled = false

    api
      .post(`/chats/join/${encodeURIComponent(code)}`)
      .then(({ data }) => {
        if (cancelled) return
        setCircle(data?.chat || null)
        if (data?.joined) {
          setStatus('joined')
          fetchChats()
        } else if (data?.pending) {
          setStatus('pending')
        } else {
          setStatus('joined')
        }
      })
      .catch((error) => {
        if (cancelled) return
        setStatus('error')
        setMessage(getApiError(error, 'That invite could not be redeemed'))
      })

    return () => {
      cancelled = true
    }
  }, [token, code, fetchChats])

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl">
        {status === 'joining' ? (
          <>
            <Loader2 size={30} className="mx-auto animate-spin text-wchat" />
            <p className="mt-3 text-sm text-zinc-400">Checking your invite…</p>
          </>
        ) : null}

        {status === 'joined' ? (
          <>
            <CheckCircle2 size={34} className="mx-auto text-emerald-400" />
            <h1 className="mt-3 text-lg font-bold text-zinc-100">
              Welcome to {circle?.chatName || 'the Circle'}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              You are in. Say hello, or see what the Circle has been sharing.
            </p>
            <button
              type="button"
              onClick={() => {
                if (circle?._id) selectChat(circle)
                navigate('/', { replace: true })
              }}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wchat px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <Users size={16} /> Open the Circle
            </button>
          </>
        ) : null}

        {status === 'pending' ? (
          <>
            <Users size={34} className="mx-auto text-amber-400" />
            <h1 className="mt-3 text-lg font-bold text-zinc-100">
              Request sent
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {circle?.chatName || 'This Circle'} approves members before they join.
              You will be added once an admin accepts.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:border-wchat/60 hover:text-white"
            >
              Back to Wchat
            </Link>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <XCircle size={34} className="mx-auto text-rose-400" />
            <h1 className="mt-3 text-lg font-bold text-zinc-100">
              Invite not valid
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{message}</p>
            <Link
              to="/"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:border-wchat/60 hover:text-white"
            >
              Back to Wchat
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}
