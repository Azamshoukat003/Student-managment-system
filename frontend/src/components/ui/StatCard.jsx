import { Link } from 'react-router-dom'

export default function StatCard({ label, value, icon, tone, sub, to }) {
  const iconStyle = tone ? { background: `var(--${tone}-weak)`, color: `var(--${tone})` } : undefined
  const body = (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="stat-icon" style={iconStyle}>
            {icon}
          </span>
        )}
      </div>
      <span className="stat-value tabular">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </>
  )

  if (to) {
    return (
      <Link to={to} className="stat stat-link">
        {body}
      </Link>
    )
  }
  return <div className="stat">{body}</div>
}
