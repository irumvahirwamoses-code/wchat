import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image as ImageIcon,
  Maximize,
  Minimize,
  RotateCcw,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

/**
 * Canvas-based image editor: crop, rotate, brightness, contrast, saturation.
 * Returns a File (blob) on confirm so the caller can append it to FormData.
 */
export default function ImageEditor({
  imageFile,
  onConfirm,
  onClose,
  aspectRatio = null, // e.g. 1 for square, 4/5, 16/9
}) {
  const [imgSrc, setImgSrc] = useState('')
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const imgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const loadImage = useCallback((src) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      const container = containerRef.current
      if (!container) return
      const { width: cw, height: ch } = container.getBoundingClientRect()

      // Fit image to container, preserving aspect ratio.
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const scaleFit = Math.min(cw / iw, ch / ih, 1)
      setScale(scaleFit)

      let cwCrop = iw * scaleFit
      let chCrop = ih * scaleFit
      if (aspectRatio) {
        if (cwCrop / chCrop > aspectRatio) {
          cwCrop = chCrop * aspectRatio
        } else {
          chCrop = cwCrop / aspectRatio
        }
      }
      setCrop({ x: 0, y: 0, width: cwCrop, height: chCrop })
      setPosition({ x: (cw - cwCrop) / 2, y: (ch - chCrop) / 2 })
      draw()
    }
    img.src = src
  }, [aspectRatio])

  useEffect(() => {
    if (imgSrc) loadImage(imgSrc)
  }, [imgSrc, loadImage])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    const img = imgRef.current
    if (!canvas || !ctx || !img) return

    const { width, height } = crop
    canvas.width = width
    canvas.height = height

    ctx.save()
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
    ctx.translate(width / 2, height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-width / 2, -height / 2)
    ctx.drawImage(img, position.x, position.y, width, height)
    ctx.restore()

    // Draw crop overlay (dashed border).
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1)
    ctx.setLineDash([])
  }, [brightness, contrast, rotation, saturation, crop, position])

  useEffect(() => {
    draw()
  }, [draw])

  // Mouse drag to reposition the image within the crop.
  const onMouseDown = (e) => {
    if (e.target !== canvasRef.current) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const onMouseMove = (e) => {
    if (!isDragging) return
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const onMouseUp = () => setIsDragging(false)

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, dragStart])

  // Export the edited image as a File.
  const exportFile = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null)
        const file = new File([blob], imageFile?.name || 'edited.jpg', {
          type: imageFile?.type || 'image/jpeg',
        })
        resolve(file)
      }, imageFile?.type || 'image/jpeg', 0.92)
    })
  }, [imageFile])

  const handleConfirm = async () => {
    const file = await exportFile()
    if (file && onConfirm) onConfirm(file)
  }

  const zoom = (delta) => {
    setScale((s) => Math.max(0.5, Math.min(3, s + delta)))
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
      onMouseDown={onMouseDown}
      style={{ touchAction: 'none' }}
    >
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-black/80 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-white"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-3 text-xs font-medium text-zinc-300">
          <span>Edit image</span>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-xs font-semibold text-white hover:bg-amber-300 disabled:opacity-50"
        >
          Done
        </button>
      </header>

      <div className="flex-1 relative overflow-hidden bg-zinc-900 p-2">
        <canvas
          ref={(el) => {
            canvasRef.current = el
            ctxRef.current = el?.getContext('2d')
          }}
          className="absolute top-1/2 left-1/2 cursor-grab bg-zinc-950 rounded-lg shadow-2xl"
          style={{
            transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
          }}
        />
      </div>

      <footer className="border-t border-zinc-800 bg-black/80 backdrop-blur p-4 space-y-3">
        {/* Rotation */}
        <div className="flex items-center justify-between gap-4 px-2">
          <button
            type="button"
            onClick={() => setRotation((r) => r - 90)}
            className="text-zinc-400 hover:text-white"
          >
            <RotateCcw size={16} />
          </button>
          <div className="flex-1 text-center text-xs text-zinc-400">
            Rotate {rotation}°
          </div>
          <button
            type="button"
            className="text-zinc-400 hover:text-white hidden md:block"
          />
        </div>

        {/* Adjustments */}
        <div className="grid grid-cols-3 gap-4 px-2">
          {[
            { label: 'Brightness', value: brightness, icon: <Sun size={14} />, onChange: setBrightness },
            { label: 'Contrast', value: contrast, icon: <Sun size={14} />, onChange: setContrast },
            { label: 'Saturation', value: saturation, icon: <Sun size={14} />, onChange: setSaturation },
          ].map(({ label, value, icon, onChange }) => (
            <div key={label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                {icon}
                <span>{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          ))}
        </div>

        {/* Crop aspect ratio */}
        <div className="flex items-center justify-between gap-4 px-2 text-xs text-zinc-400">
          <span>Crop: {aspectRatio ? 'Free' : 'Original'}</span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="text-zinc-400 hover:text-white"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, s + 0.1))}
            className="text-zinc-400 hover:text-white"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </footer>
    </div>
  )
}
