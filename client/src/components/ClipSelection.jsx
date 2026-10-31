import { useCallback, useEffect, useRef, useState } from 'react'
import { Music2, X } from 'lucide-react'

/**
 * Clip Selection: lets the user pick a 5–15 second segment of a track
 * using a time slider. Returns { startTime, endTime } on confirm.
 */
export default function ClipSelection({
  track,
  onConfirm,
  onClose,
  defaultStartTime = 0,
  defaultEndTime = null,
}) {
  const [startTime, setStartTime] = useState(defaultStartTime || 0)
  const [endTime, setEndTime] = useState(
    defaultEndTime || Math.min((defaultStartTime || 0) + 10, track.duration || 30)
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const audioRef = useRef(null)
  const clipRef = useRef(null)

  useEffect(() => {
    if (track?.url) setPreviewUrl(track.url)
  }, [track?.url])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [])

  // Ensure endTime >= startTime + 5 and <= startTime + 15
  useEffect(() => {
    if (endTime < startTime + 5) setEndTime(startTime + 5)
    if (endTime > startTime + 15) setEndTime(startTime + 15)
  }, [startTime, endTime])

  const togglePreview = () => {
    if (!audioRef.current) return
    if (audioRef.current.paused) {
      audioRef.current.currentTime = startTime
      audioRef.current.play()
      setIsPlaying(true)
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Auto-stop preview at endTime
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return undefined
    const check = setInterval(() => {
      if (audioRef.current.currentTime >= endTime) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    }, 100)
    return () => clearInterval(check)
  }, [isPlaying, endTime])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleConfirm = () => {
    onConfirm?.({
      startTime,
      endTime,
      track: {
        title: track.title,
        artist: track.artist,
        url: track.url,
        albumArt: track.albumArt,
        duration: endTime - startTime,
        lyrics: track.lyrics,
      },
    })
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-950/80 backdrop-blur">
        <h3 className="text-sm font-semibold">Select music clip</h3>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white">
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 p-4">
        {/* Track info + preview */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 mb-4">
          <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
            <Music2 size={20} className="text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-zinc-100">{track.title}</span>
            <span className="block truncate text-[10px] text-zinc-500">{track.artist}</span>
          </div>
          <button
            type="button"
            onClick={togglePreview}
            className="p-1.5 text-zinc-400 hover:text-white"
          >
            {isPlaying ? <Music2 size={16} className="text-amber-400" /> : <Music2 size={16} />}
          </button>
        </div>

        {/* Time sliders */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Start</span>
              <span>{formatTime(startTime)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.max(0, track.duration - 5)}
              step="0.1"
              value={startTime}
              onChange={(e) => setStartTime(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>End</span>
              <span>{formatTime(endTime)}</span>
            </div>
            <input
              type="range"
              min={startTime + 5}
              max={track.duration || 30}
              step="0.1"
              value={endTime}
              onChange={(e) => setEndTime(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>
          <p className="text-[10px] text-zinc-500">
            Clip length: {formatTime(endTime - startTime)} (5–15 seconds)
          </p>
        </div>
      </div>

      <footer className="border-t border-zinc-800 bg-zinc-950/80 backdrop-blur p-4">
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {audioRef?.current?.paused === false ? <Music2 size={14} /> : null} Use clip
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-xs text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </footer>
    </div>
  )
}
