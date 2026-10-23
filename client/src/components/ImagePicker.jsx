import { useEffect, useRef } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Profile-picture picker that imports a local image file (instead of a URL).
 *
 * @param preview  object URL (or existing image URL) to display
 * @param onSelect called with the chosen File
 * @param onRemove called when the picture is cleared
 * @param error    optional validation message to show
 */
export default function ImagePicker({ preview, onSelect, onRemove, error, disabled }) {
  const inputRef = useRef(null)

  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950/70">
          {preview ? (
            <img src={preview} alt="Profile preview" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={22} className="text-zinc-500" />
          )}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-60"
          >
            <ImagePlus size={16} />
            {preview ? 'Change photo' : 'Import photo'}
          </button>

          {preview ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (inputRef.current) inputRef.current.value = ''
                onRemove?.()
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-60"
            >
              <Trash2 size={15} />
              Remove
            </button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            if (!file.type.startsWith('image/')) {
              onSelect?.(null, 'Please choose an image file (jpg, png, gif…)')
              return
            }
            if (file.size > MAX_BYTES) {
              onSelect?.(null, 'Image is too large (maximum 5MB)')
              return
            }
            onSelect?.(file, '')
          }}
        />
      </div>

      <p className={`mt-1.5 text-[11px] ${error ? 'text-red-400' : 'text-zinc-600'}`}>
        {error || 'Optional — import a JPG, PNG or GIF up to 5MB.'}
      </p>
    </div>
  )
}

/** Revoke an object URL when it changes or the component unmounts. */
export function useObjectUrl(url) {
  useEffect(() => {
    return () => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [url])
}
