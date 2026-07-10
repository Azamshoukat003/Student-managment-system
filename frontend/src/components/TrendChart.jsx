import { useId, useRef, useState } from 'react'

/*
 * Single-series area/line chart (attendance over time) with a gradient fill
 * under the line and a hover crosshair + tooltip. Plain inline SVG.
 *
 * data: [{ label, total, present, late, absent }]
 */
const W = 640
const H = 200
const PAD = { l: 10, r: 10, t: 14, b: 24 }

function smoothPath(pts) {
  if (pts.length < 2) return ''
  // Catmull-Rom -> cubic bezier for a gentle smooth line.
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

export default function TrendChart({ data = [] }) {
  const gid = useId().replace(/:/g, '')
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null)

  const n = data.length
  if (n < 2) {
    return <div className="empty" style={{ padding: 'var(--sp-6)' }}>Not enough data to chart yet.</div>
  }

  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const maxV = Math.max(1, ...data.map((d) => d.total))

  const pts = data.map((d, i) => ({
    x: PAD.l + (i * plotW) / (n - 1),
    y: PAD.t + (1 - d.total / maxV) * plotH,
    d,
    i,
  }))

  const baseY = PAD.t + plotH
  const line = smoothPath(pts)
  const area = `${line} L ${pts[n - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`

  // x-axis labels — show at most ~7 to avoid crowding.
  const step = Math.max(1, Math.ceil(n / 7))
  const ticks = data.map((d, i) => ({ ...d, i })).filter((_, i) => i % step === 0 || i === n - 1)

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const idx = Math.round(ratio * (n - 1))
    setHover({ idx, leftPct: (idx / (n - 1)) * 100 })
  }

  const hp = hover ? pts[hover.idx] : null

  return (
    <div className="trend" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trend-svg" role="img" aria-label="Attendance trend">
        <defs>
          <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line x1={PAD.l} y1={baseY} x2={W - PAD.r} y2={baseY} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {/* area + line */}
        <path d={area} fill={`url(#grad-${gid})`} />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

        {/* hover crosshair + dot */}
        {hp && (
          <>
            <line x1={hp.x} y1={PAD.t} x2={hp.x} y2={baseY} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={hp.x} cy={hp.y} r="4" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>

      {/* x labels (HTML for crisp, non-stretched text) */}
      <div className="trend-xaxis">
        {ticks.map((t) => (
          <span key={t.i} style={{ left: `${(t.i / (n - 1)) * 100}%` }}>
            {t.label}
          </span>
        ))}
      </div>

      {hp && (
        <div
          className="trend-tooltip"
          style={{ left: `${hover.leftPct}%` }}
        >
          <div className="trend-tt-label">{hp.d.label}</div>
          <div className="trend-tt-row"><span className="dot" style={{ background: 'var(--present)' }} />Present<b>{hp.d.present}</b></div>
          <div className="trend-tt-row"><span className="dot" style={{ background: 'var(--late)' }} />Late<b>{hp.d.late}</b></div>
          <div className="trend-tt-row"><span className="dot" style={{ background: 'var(--absent)' }} />Absent<b>{hp.d.absent}</b></div>
        </div>
      )}
    </div>
  )
}
