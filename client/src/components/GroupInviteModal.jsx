import { useEffect, useState } from 'react'
import { Copy, Loader2, QrCode, Share2, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api, { getApiError } from '../config/api'

/**
 * Shows the QR invite for a Circle. Scanning the code opens `/join/:code`,
 * which either adds the person straight away or files a join request, based on
 * the Circle's join policy.
 */
export default function GroupInviteModal({ chat, onClose }) {
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .post(`/chats/${chat._id}/invite`)
      .then(({ data }) => {
        if (!cancelled) setInvite(data)
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(getApiError(requestError, 'Could not build the invite'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chat._id])

  const link = invite ? `${window.location.origin}/join/${invite.inviteCode}` : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Invite link copied')
    } catch {
      toast.error('Copy failed — select the link and copy it manually')
    }
  }

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${chat.chatName} on Wchat`,
          text: `Join my Circle “${chat.chatName}” on Wchat`,
          url: link,
        })
        return
      } catch {
        /* the person cancelled — fall back to copying */
      }
    }
    copyLink()
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-wchat/15 text-wchat">
            <QrCode size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-zinc-100">
              Invite to {chat.chatName}
            </h2>
            <p className="text-[11px] text-zinc-500">
              {chat.joinPolicy === 'request'
                ? 'Scans become join requests you approve.'
                : 'Scanning joins the Circle straight away.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="grid h-56 place-items-center">
            <Loader2 size={22} className="animate-spin text-wchat" />
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}

        {invite ? (
          <>
            <div className="mt-4 grid place-items-center rounded-xl bg-white p-4">
              <QRCodeSVG
                value={link}
                size={168}
                level="M"
                marginSize={0}
                fgColor="#0f172a"
              />
            </div>
            <p className="mt-3 break-all rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-400">
              {link}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-wchat px-3 py-2.5 text-xs font-semibold text-white hover:brightness-110"
              >
                <Copy size={14} /> Copy link
              </button>
              <button
                type="button"
                onClick={shareLink}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2.5 text-xs font-semibold text-zinc-300 hover:border-wchat/60 hover:text-white"
              >
                <Share2 size={14} /> Share
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Code <span className="font-mono text-zinc-300">{invite.inviteCode}</span>
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
