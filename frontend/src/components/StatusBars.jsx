/* Simple accessible bar chart for attendance status counts. */
const ROWS = [
  { key: 'present', label: 'Present', color: 'var(--present)' },
  { key: 'late', label: 'Late', color: 'var(--late)' },
  { key: 'absent', label: 'Absent', color: 'var(--absent)' },
  { key: 'pending', label: 'Pending', color: 'var(--pending)' },
]

export default function StatusBars({ summary, hidePending = false }) {
  const rows = ROWS.filter((r) => !(hidePending && r.key === 'pending'))
  const max = Math.max(1, ...rows.map((r) => summary?.[r.key] || 0))

  return (
    <div className="barchart">
      {rows.map((r) => {
        const val = summary?.[r.key] || 0
        return (
          <div className="barrow" key={r.key}>
            <span className="muted">{r.label}</span>
            <span className="bartrack">
              <span
                className="barfill"
                style={{ width: `${(val / max) * 100}%`, background: r.color }}
              />
            </span>
            <span className="tabular cell-strong" style={{ textAlign: 'right' }}>
              {val}
            </span>
          </div>
        )
      })}
    </div>
  )
}
