import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import Avatar from './Avatar'
import api from '../config/api'
import { getFileUrl, getId } from '../utils/api'
import { formatHandle } from '../utils/handle'

export default function StoryViewer({ ring, onClose }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const story = ring?.stories?.[index]
  const owner = ring?.owner || {}
  const timer = useRef()

  useEffect(() => {
    if (!story) return
    api.post(`/stories/${story._id}/view`).catch(() => {})
    setProgress(0)
    clearInterval(timer.current)
    timer.current = setInterval(() => setProgress((p) => Math.min(p + 4, 100)), 120)
    const id = setTimeout(() => next(), 3000)
    return () => { clearInterval(timer.current); clearTimeout(id) }
  }, [story?._id])

  const next = () => {
    if ((ring.stories || []).length - 1 > index) setIndex(index + 1)
    else onClose?.()
  }
  const prev = () => setIndex(Math.max(0, index - 1))

  if (!story) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center gap-3 px-4 py-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
          <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-2">
          <Avatar src={owner.profilePicture} name={`${owner.firstName||''} ${owner.lastName||''}`} size={32} />
          <p className="text-xs text-white">{formatHandle(owner.username)}</p>
        </div>
        <button type="button" onClick={onClose} className="text-white/80 hover:text-white"><X size={18} /></button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        {story.mediaType === 'image' ? (
          <img src={getFileUrl(story.media)} alt="story" className="max-h-full max-w-full object-contain" />
        ) : (
          <video autoPlay src={getFileUrl(story.media)} className="max-h-full max-w-full" onEnded={next} />
        )}
        <button type="button" onClick={prev} className="absolute left-2 rounded-full bg-black/40 p-1.5 text-white"><ChevronLeft size={18} /></button>
        <button type="button" onClick={next} className="absolute right-2 rounded-full bg-black/40 p-1.5 text-white"><ChevronRight size={18} /></button>
      </div>
    </div>
  )
}
