import { useEffect, useRef, useState } from 'react'
import {
  Music2,
  Image as ImageIcon,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { getFileUrl } from '../utils/api'

/**
 * Music sticker displayed on stories/posts.
 * Supports three visual styles:
 *   - 'lyrics'      → animated scrolling lyrics line by line
 *   - 'albumArt'    → album cover art
 *   - 'titleLabel'  → clean title + artist label
 */
export default function MusicSticker({
  music,
  style = 'titleLabel',
  className = '',
  isPlaying = false,
  onToggleMute,
  currentTime = 0,
  duration = 0,
}) {
  if (!music?.url) return null

  const audioRef = useRef(null)
  const lyricsRef = useRef(null)
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1)
  const [volumeMuted, setVolumeMuted] = useState(false)

  const lyrics = Array.isArray(music.lyrics) ? music.lyrics : []

  // Highlight the current lyric line based on playback position.
  useEffect(() => {
    if (!lyrics.length || !audioRef.current) return
    const time = audioRef.current.currentTime
    let idx = -1
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (time >= lyrics[i].time) {
        idx = i
        break
      }
    }
    setActiveLyricIndex(idx)
  }, [audioRef.current?.currentTime, lyrics])

  // Scroll the active lyric into view.
  useEffect(() => {
    if (activeLyricIndex < 0 || !lyricsRef.current) return
    const item = lyricsRef.current.children[activeLyricIndex]
    if (item) item.scrollIntoView({ block: 'center', inline: 'center' })
  }, [activeLyricIndex])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (audioRef.current.paused) audioRef.current.play()
    else audioRef.current.pause()
  }

  const handleVolume = () => {
    setVolumeMuted((prev) => {
      const next = !prev
      if (audioRef.current) audioRef.current.muted = next
      return next
    })
    onToggleMute?.(next)
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 backdrop-blur ${className}`}
    >
      {/* Visual style */}
      {style === 'albumArt' && music.albumArt ? (
        <div className="flex-shrink-0 h-12 w-12 rounded-lg overflow-hidden border border-zinc-700">
          <img src={music.albumArt} alt="Album art" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
          <Music2 size={20} className="text-zinc-400" />
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {style === 'lyrics' ? (
            <div className="h-6 overflow-hidden">
              {lyrics.length ? (
                <div className="space-y-0.5" ref={lyricsRef}>
                  {lyrics.map((line, i) => (
                    <div
                      key={i}
                      className={`text-[10px] leading-tight truncate transition-colors ${
                        activeLyricIndex === i
                          ? 'text-amber-400 font-medium'
                          : 'text-zinc-500'
                      }`}
                    >
                      {line.text}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-zinc-500 truncate">
                  {music.title}{music.artist ? ` — ${music.artist}` : ''}
                </span>
              )}
            </div>
          ) : (
            <>
              <span className="block truncate text-xs font-medium text-zinc-200">
                {music.title}
              </span>
              <span className="block truncate text-[10px] text-zinc-500">
                {music.artist}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <button
          type="button"
          onClick={togglePlay}
          className="p-1 text-zinc-400 hover:text-white"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Music2 size={14} className="text-amber-400" /> : <Music2 size={14} />}
        </button>
        {style !== 'lyrics' && (
          <button
            type="button"
            onClick={handleVolume}
            className="p-1 text-zinc-400 hover:text-white"
            title={volumeMuted ? 'Unmute' : 'Mute'}
          >
            {volumeMuted ? <VolumeX size={14} className="text-zinc-500" /> : <Volume2 size={14} />}
          </button>
        )}
      </div>

      <audio
        ref={audioRef}
        src={getFileUrl(music.url)}
        preload="metadata"
        onLoadedMetadata={(e) => {
          if (e.currentTarget.duration) {
            // No-op; duration available
          }
        }}
      />
    </div>
  )
}
