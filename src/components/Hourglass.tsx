import { useId } from 'react'

export default function Hourglass({
  remaining,
  total,
  danger,
  running,
  size = 120,
}: {
  remaining: number
  total: number
  danger: boolean
  running: boolean
  size?: number
}) {
  const rawId = useId().replace(/:/g, '')
  const topClip = `hg-top-${rawId}`
  const botClip = `hg-bot-${rawId}`

  const r = Math.max(0, Math.min(1, total > 0 ? remaining / total : 0))
  const sand = danger ? '#ef4444' : '#f59e0b'
  // The frame reads the themed muted-ink token through currentColor (set on
  // the <svg> below) — a hard-coded slate was invisible on light palettes.
  const frame = 'currentColor'
  const bulbFill = 'rgba(148, 163, 184, 0.08)'

  const topSandY = (1 - r) * 100
  const topSandH = r * 100
  const botSandY = 100 + r * 100
  const botSandH = (1 - r) * 100

  // SVG viewBox is 100x200; width is half-ish to keep an hourglass silhouette
  const width = size * 0.55

  return (
    <svg
      viewBox="0 0 100 200"
      width={width}
      height={size}
      className={`shrink-0 ${danger ? 'text-red-300' : 'text-slate-400'}`}
      role="img"
      aria-label={`${remaining} seconds remaining`}
    >
      <defs>
        <clipPath id={topClip}>
          <polygon points="0,0 100,0 50,100" />
        </clipPath>
        <clipPath id={botClip}>
          <polygon points="0,200 100,200 50,100" />
        </clipPath>
      </defs>

      {/* Frame caps (top and bottom plates) */}
      <rect x="-2" y="0" width="104" height="6" fill={frame} rx="2" />
      <rect x="-2" y="194" width="104" height="6" fill={frame} rx="2" />

      {/* Top bulb outline */}
      <polygon
        points="0,4 100,4 50,100"
        fill={bulbFill}
        stroke={frame}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Bottom bulb outline */}
      <polygon
        points="0,196 100,196 50,100"
        fill={bulbFill}
        stroke={frame}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Top sand (drains down) */}
      <g clipPath={`url(#${topClip})`}>
        <rect
          x="0"
          width="100"
          y={topSandY}
          height={topSandH}
          fill={sand}
          style={{ transition: 'y 1s linear, height 1s linear' }}
        />
      </g>

      {/* Bottom sand (accumulates) */}
      <g clipPath={`url(#${botClip})`}>
        <rect
          x="0"
          width="100"
          y={botSandY}
          height={botSandH}
          fill={sand}
          style={{ transition: 'y 1s linear, height 1s linear' }}
        />
      </g>

      {/* Falling stream between bulbs, visible only while running */}
      {running && r > 0 && r < 1 && (
        <rect x="48" y="97" width="4" height="7" fill={sand} rx="1">
          <animate
            attributeName="opacity"
            values="0.3;1;0.3"
            dur="0.7s"
            repeatCount="indefinite"
          />
        </rect>
      )}
    </svg>
  )
}
