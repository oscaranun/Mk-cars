import type { SVGProps } from "react"

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

export function SuvIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 17H3v-4.5l2-.5 2.5-4A1.5 1.5 0 0 1 8.8 7h6.4a1.5 1.5 0 0 1 1.3.75L18.5 11l2.3.7a1.5 1.5 0 0 1 1.2 1.47V17h-2" />
      <path d="M9 17h6" />
      <path d="M6 11h12.5" />
      <path d="M12.5 7v4" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  )
}

export function PickupIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 17H1.5v-6H11V6.5a.5.5 0 0 1 .5-.5H16a1 1 0 0 1 .8.4L19 10l2.8.7a1.5 1.5 0 0 1 1.2 1.47V17h-2.5" />
      <path d="M8 17h8.5" />
      <path d="M11 10h8" />
      <circle cx="6" cy="17" r="2" />
      <circle cx="18.5" cy="17" r="2" />
    </svg>
  )
}
