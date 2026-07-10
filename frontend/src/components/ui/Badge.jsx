/* Status pill. `tone` maps to a badge-<tone> class (present, late, active, open…). */
export default function Badge({ tone = 'neutral', plain = false, children }) {
  return <span className={`badge badge-${tone}${plain ? ' badge-plain' : ''}`}>{children}</span>
}
