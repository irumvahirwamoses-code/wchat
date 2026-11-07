import { useCallback, useEffect, useRef, useState } from 'react'
import { Crop, Eraser, Pencil, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'

const DRAW_COLORS = ['#ffffff', '#facc15', '#f43f5e', '#38bdf8', '#22c55e', '#000000']

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)) }
function round2(n) { return Math.round(n * 100) / 100 }

/**
 * Image editor.
 * - Default mode exports a cropped/rendered File via `onConfirm(file)`.
 * - Frame mode (`returnFrame=true`) keeps the original image and returns
 *   `{ zoom, x, y }` via `onConfirm(frame)` so the app can position the
 *   visible area without cropping the source (used for profile photos).
 */
export default function ImageEditor({
  imageFile,
  imageSrc,
  onConfirm,
  onClose,
  aspectRatio = null,
  allowDraw = true,
  initialFrame = null,
  returnFrame = false,
  title,
  confirmLabel,
}) {
  const [imgSrc, setImgSrc] = useState('')
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [frameSize, setFrameSize] = useState({ w: 1, h: 1 })
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0])
  const [hasDrawing, setHasDrawing] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const imgRef = useRef(null)
  const frameRef = useRef(null)
  const drawCanvasRef = useRef(null)
  const drawingRef = useRef(false)
  const appliedInitialRef = useRef(false)

  useEffect(() => {
    appliedInitialRef.current = false
  }, [imageFile, imageSrc])

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile)
      setImgSrc(url)
      return () => URL.revokeObjectURL(url)
    }
    setImgSrc(imageSrc || '')
    return undefined
  }, [imageFile, imageSrc])

  useEffect(() => {
    if (!imgSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setNatural({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 })
    }
    img.src = imgSrc
  }, [imgSrc])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined
    const update = () => {
      const r = frame.getBoundingClientRect()
      if (r.width && r.height) setFrameSize({ w: r.width, h: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [imgSrc, aspectRatio])

  // Apply saved frame after we know image/frame sizes.
  useEffect(() => {
    if (!returnFrame || appliedInitialRef.current) return
    if (!initialFrame || !natural.w || !natural.h || !frameSize.w || !frameSize.h) return
    const z = clamp(Number(initialFrame.zoom) || 1, 1, 4)
    const base = Math.max(frameSize.w / natural.w, frameSize.h / natural.h)
    const scale = base * z
    setZoom(z)
    setOffset({
      x: ((Number(initialFrame.x) || 0) / 100) * natural.w * scale,
      y: ((Number(initialFrame.y) || 0) / 100) * natural.h * scale,
    })
    appliedInitialRef.current = true
  }, [returnFrame, initialFrame, natural, frameSize])

  useEffect(() => {
    if (!returnFrame) return
    if (appliedInitialRef.current) return
    setOffset({ x: 0, y: 0 })
    setZoom(1)
  }, [returnFrame, imgSrc])

  useEffect(() => {
    const frame = frameRef.current
    const canvas = drawCanvasRef.current
    if (!frame || !canvas) return undefined
    const resize = () => {
      const rect = frame.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      if (canvas.width === w && canvas.height === h) return
      const snapshot = canvas.width && canvas.height ? canvas.toDataURL() : null
      canvas.width = w
      canvas.height = h
      if (snapshot) {
        const prev = new Image()
        prev.onload = () => canvas.getContext('2d').drawImage(prev, 0, 0, w, h)
        prev.src = snapshot
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [imgSrc, aspectRatio])

  const onPointerDown = (e) => {
    if (drawMode) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (drawMode || !dragging) return
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    })
  }
  const onPointerUp = () => setDragging(false)

  const pointFromEvent = (event) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const startDraw = (e) => {
    if (!drawMode || !allowDraw) return
    e.preventDefault()
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const p = pointFromEvent(e)
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = drawColor
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    drawingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const moveDraw = (e) => {
    if (!drawMode || !drawingRef.current) return
    const ctx = drawCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = pointFromEvent(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setHasDrawing(true)
  }
  const endDraw = () => { drawingRef.current = false }
  const clearDrawing = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawing(false)
  }

  const getFrameMetadata = useCallback(() => {
    const z = clamp(zoom, 1, 4)
    if (!natural.w || !natural.h || !frameSize.w || !frameSize.h) return { zoom: round2(z), x: 0, y: 0 }
    const base = Math.max(frameSize.w / natural.w, frameSize.h / natural.h)
    const scale = base * z
    const x = clamp((offset.x / (natural.w * scale || 1)) * 100, -100, 100)
    const y = clamp((offset.y / (natural.h * scale || 1)) * 100, -100, 100)
    return { zoom: round2(z), x: round2(x), y: round2(y) }
  }, [zoom, offset, natural, frameSize])

  const exportFile = useCallback(async () => {
    const img = imgRef.current
    const frame = frameRef.current
    if (!img || !frame) return null

    let outW = 1080
    let outH = 1080
    if (aspectRatio) {
      if (aspectRatio >= 1) { outW = 1080; outH = Math.round(1080 / aspectRatio) }
      else { outH = 1920; outW = Math.round(1920 * aspectRatio) }
    } else {
      const ratio = img.naturalWidth / img.naturalHeight
      outW = Math.min(1080, img.naturalWidth)
      outH = Math.round(outW / ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, outW, outH)

    const frameRect = frame.getBoundingClientRect()
    const scaleToOutput = outW / frameRect.width

    ctx.save()
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
    ctx.translate(outW / 2 + offset.x * scaleToOutput, outH / 2 + offset.y * scaleToOutput)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(zoom, zoom)
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const coverScale = Math.max(frameRect.width / iw, frameRect.height / ih)
    const dw = iw * coverScale * scaleToOutput
    const dh = ih * coverScale * scaleToOutput
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()

    if (hasDrawing && drawCanvasRef.current) {
      ctx.drawImage(drawCanvasRef.current, 0, 0, outW, outH)
    }

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], imageFile?.name || 'edited.jpg', { type: 'image/jpeg' }) : null),
        'image/jpeg',
        0.92
      )
    })
  }, [aspectRatio, brightness, contrast, saturation, rotation, zoom, offset, imageFile, hasDrawing])

  const handleConfirm = async () => {
    if (returnFrame) {
      onConfirm?.(getFrameMetadata())
      return
    }
    const file = await exportFile()
    if (file && onConfirm) onConfirm(file)
  }

  const baseScale = natural.w && natural.h && frameSize.w && frameSize.h
    ? Math.max(frameSize.w / natural.w, frameSize.h / natural.h)
    : 1
  const imgW = natural.w * baseScale * zoom
  const imgH = natural.h * baseScale * zoom

  const previewStyle = {
    width: natural.w ? `${imgW}px` : undefined,
    height: natural.h ? `${imgH}px` : undefined,
    maxWidth: 'none',
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg)`,
  }

  const frameStyle = aspectRatio ? { aspectRatio: String(aspectRatio) } : { minHeight: '280px' }
  const isCircle = returnFrame && aspectRatio === 1
  const showDraw = allowDraw && !returnFrame

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Close"><X size={18} /></button>
        <span className="text-xs font-medium text-zinc-300">{title || (returnFrame ? 'Adjust profile photo' : 'Edit photo')}</span>
        <button type="button" onClick={handleConfirm} className="rounded-lg bg-[color:var(--wchat-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105">
          {confirmLabel || (returnFrame ? 'Save' : 'Done')}
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <div
          ref={frameRef}
          className={`relative w-full max-w-sm overflow-hidden bg-zinc-900 ${isCircle ? 'rounded-full' : 'rounded-xl'} ${cropMode && !returnFrame ? 'ring-2 ring-[color:var(--wchat-primary)] ring-offset-2 ring-offset-black' : ''}`}
          style={frameStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imgSrc ? (
            <img src={imgSrc} alt="Edit" className="pointer-events-none absolute left-1/2 top-1/2 select-none" style={previewStyle} draggable={false} />
          ) : null}
          {showDraw ? (
            <canvas
              ref={drawCanvasRef}
              className={`absolute inset-0 z-10 h-full w-full touch-none ${drawMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              onPointerCancel={endDraw}
            />
          ) : null}
          {!returnFrame && cropMode ? (
            <div className="pointer-events-none absolute inset-0 z-20">
              <div className="absolute inset-0 border-2 border-white/60" />
              <div className="absolute left-0 right-0 top-1/3 h-px bg-white/30" />
              <div className="absolute left-0 right-0 top-2/3 h-px bg-white/30" />
              <div className="absolute bottom-0 left-1/3 top-0 w-px bg-white/30" />
              <div className="absolute bottom-0 left-2/3 top-0 w-px bg-white/30" />
            </div>
          ) : null}
          {isCircle ? <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/20" /> : null}
        </div>
      </div>

      <footer className="space-y-3 border-t border-zinc-800 bg-black/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          {!returnFrame ? (
            <button type="button" onClick={() => { setCropMode((v) => !v); setDrawMode(false) }} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${cropMode ? 'bg-[color:var(--wchat-primary-soft)] text-[color:var(--wchat-primary)]' : 'text-zinc-400 hover:text-white'}`} title="Crop/reposition">
              <Crop size={16} /> Crop
            </button>
          ) : <span className="text-[11px] font-semibold text-zinc-400">Position</span>}
          {showDraw ? (
            <button type="button" onClick={() => { setDrawMode((v) => !v); setCropMode(false) }} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${drawMode ? 'bg-[color:var(--wchat-primary-soft)] text-[color:var(--wchat-primary)]' : 'text-zinc-400 hover:text-white'}`} title="Draw on photo">
              <Pencil size={16} /> Draw
            </button>
          ) : null}
          {!returnFrame ? <button type="button" onClick={() => setRotation((r) => r - 90)} className="p-1 text-zinc-400 hover:text-white" title="Rotate"><RotateCcw size={18} /></button> : null}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setZoom((z) => clamp(+(z - 0.1).toFixed(2), 1, 4))} className="p-1 text-zinc-400 hover:text-white" aria-label="Zoom out"><ZoomOut size={18} /></button>
            <span className="w-10 text-center text-xs text-zinc-400">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => clamp(+(z + 0.1).toFixed(2), 1, 4))} className="p-1 text-zinc-400 hover:text-white" aria-label="Zoom in"><ZoomIn size={18} /></button>
          </div>
          <button type="button" onClick={() => { setRotation(0); setZoom(1); setOffset({ x: 0, y: 0 }); setBrightness(100); setContrast(100); setSaturation(100); setCropMode(false); setDrawMode(false); appliedInitialRef.current = true }} className="text-xs text-zinc-400 hover:text-white">Reset</button>
        </div>

        {drawMode && showDraw ? (
          <div className="flex items-center gap-2 px-1">
            {DRAW_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setDrawColor(c)} className={`h-6 w-6 rounded-full border-2 ${drawColor === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} aria-label="Draw color" />
            ))}
            <button type="button" onClick={clearDrawing} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 hover:text-white"><Eraser size={13} /> Clear</button>
          </div>
        ) : !returnFrame ? (
          <div className="grid grid-cols-3 gap-3 px-1">
            {[
              { label: 'Brightness', value: brightness, set: setBrightness },
              { label: 'Contrast', value: contrast, set: setContrast },
              { label: 'Saturation', value: saturation, set: setSaturation },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-400"><span>{label}</span><span>{value}%</span></div>
                <input type="range" min="50" max="150" value={value} onChange={(e) => set(Number(e.target.value))} className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-[color:var(--wchat-primary)]" />
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-center text-[10px] text-zinc-500">
          {returnFrame
            ? 'Drag to reposition and zoom to choose what appears in your profile circle. Your original photo is kept.'
            : drawMode ? 'Draw on the photo. Turn off Draw to crop/reposition.' : 'Drag to reposition. Turn on Draw to sketch on the photo.'}
        </p>
      </footer>
    </div>
  )
}
