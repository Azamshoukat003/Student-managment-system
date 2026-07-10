/* Circular attendance-percentage ring for the student dashboard. */
const SIZE = 132
const STROKE = 12
const R = SIZE / 2 - STROKE
const C = 2 * Math.PI * R

export default function AttendanceRing({ percentage = 0, present = 0, late = 0, absent = 0 }) {
  const pct = Math.max(0, Math.min(100, percentage))
  const offset = C * (1 - pct / 100)
  const color = pct >= 75 ? 'var(--present)' : pct >= 50 ? 'var(--late)' : 'var(--absent)'

  return (
    <div className="att-ring">
      <div className="att-ring-chart">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s var(--ease-out)' }}
          />
        </svg>
        <div className="att-ring-center">
          <span className="att-ring-pct">{pct}%</span>
          <span className="att-ring-label">attendance</span>
        </div>
      </div>

      <div className="att-ring-legend">
        <span className="lg">
          <span className="dot" style={{ background: 'var(--present)' }} />
          Present <b>{present}</b>
        </span>
        <span className="lg">
          <span className="dot" style={{ background: 'var(--late)' }} />
          Late <b>{late}</b>
        </span>
        <span className="lg">
          <span className="dot" style={{ background: 'var(--absent)' }} />
          Absent <b>{absent}</b>
        </span>
      </div>
    </div>
  )
}
