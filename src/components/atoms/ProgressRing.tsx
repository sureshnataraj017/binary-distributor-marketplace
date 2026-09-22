interface ProgressRingProps {
  /** 0-100+; the ring caps at a full circle. */
  percent: number
  size?: number
  label?: string
}

export function ProgressRing({ percent, size = 72, label }: ProgressRingProps) {
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, percent))
  const done = percent >= 100

  return (
    <div
      role="img"
      aria-label={`${label ?? 'Progress'}: ${Math.round(percent)}%`}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="var(--line)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={done ? 'var(--series-3)' : 'var(--series-1)'}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-sm font-semibold">{Math.round(percent)}%</span>
    </div>
  )
}
