import { IconStore } from './Icons'

export function ShopAvatar({ image, size = 46 }: { image?: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="grid flex-none place-items-center overflow-hidden rounded-full border border-white/15 bg-surface text-pewter"
    >
      {image ? (
        <img src={image} alt="ร้าน" className="h-full w-full object-cover" />
      ) : (
        <IconStore width={Math.round(size * 0.45)} height={Math.round(size * 0.45)} />
      )}
    </div>
  )
}
