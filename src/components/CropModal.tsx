import { useState } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedImg, type PixelArea } from '../lib/image'
import { IconBack, IconCheck } from './Icons'

interface Props {
  src: string
  onCancel: () => void
  onDone: (dataURL: string) => void
}

export function CropModal({ src, onCancel, onDone }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<PixelArea | null>(null)
  const [busy, setBusy] = useState(false)

  async function done() {
    if (!area) return
    setBusy(true)
    try {
      onDone(await getCroppedImg(src, area))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[95] flex flex-col bg-ink">
      <header className="flex items-center gap-3.5 border-b border-white/10 px-5 pb-4 pt-[38px]">
        <button
          onClick={onCancel}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-surface text-milky"
        >
          <IconBack width={20} height={20} />
        </button>
        <div>
          <h2 className="font-serif text-[19px] font-semibold text-milky">ครอปรูป</h2>
          <div className="text-[11px] text-pewter">เลื่อน / ซูม ให้พอดีกรอบ</div>
        </div>
      </header>

      <div className="relative flex-1 bg-black">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          minZoom={1}
          maxZoom={5}
          zoomSpeed={0.3}
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
        />
      </div>

      <div className="space-y-4 border-t border-white/10 bg-ink px-5 pb-safe pt-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-pewter">ซูม</span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: '#E7CB9C' }}
          />
          <span className="w-9 text-right font-num text-[12px] text-pewter">{zoom.toFixed(1)}×</span>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-none rounded-[15px] border border-white/20 px-4 py-3.5 font-medium text-pewter"
          >
            ยกเลิก
          </button>
          <button
            onClick={done}
            disabled={busy || !area}
            className="flex flex-1 items-center justify-center gap-2 rounded-[15px] bg-electrum py-3.5 text-base font-bold text-[#2a2115] disabled:opacity-50"
          >
            <IconCheck width={20} height={20} />
            ใช้รูปนี้
          </button>
        </div>
      </div>
    </div>
  )
}
