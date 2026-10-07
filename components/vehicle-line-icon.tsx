import type { CSSProperties } from "react"

const ICONS = {
  auto: { src: "/images/icons/auto.png?v=4", ratio: 1103 / 461, width: 120 },
  suv: { src: "/images/icons/suv.png?v=4", ratio: 1027 / 414, width: 120 },
  pickup: { src: "/images/icons/pickup.png?v=4", ratio: 1011 / 384, width: 168 },
} as const

export type VehicleIconId = keyof typeof ICONS

export function VehicleLineIcon({ id, width }: { id: VehicleIconId; width?: number }) {
  const icon = ICONS[id]
  const mask = `url(${icon.src}) center / contain no-repeat`
  return (
    <span
      aria-hidden="true"
      className="block bg-current"
      style={{ width: width ?? icon.width, aspectRatio: icon.ratio, mask, WebkitMask: mask } as CSSProperties}
    />
  )
}
