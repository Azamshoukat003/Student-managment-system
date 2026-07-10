import { Link } from 'react-router-dom'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../auth/AuthContext'
import Badge from './ui/Badge'
import Spinner from './ui/Spinner'
import EmptyState from './ui/EmptyState'
import { IconReport } from './icons'

const STATUS_TONE = { present: 'present', late: 'late', absent: 'absent', pending: 'pending', rejected: 'absent' }

export default function RecentAttendance({ limit = 6 }) {
  const { user } = useAuth()
  const { data, loading } = useFetch('/attendance-records')
  const isStudent = user.role === 'student'
  const rows = (data || []).slice(0, limit)

  return (
    <div className="card rise" style={{ animationDelay: '340ms' }}>
      <div className="card-header">
        <span className="card-title">Recent attendance</span>
        <Link to="/records" className="btn btn-ghost btn-sm">
          View all
        </Link>
      </div>
      {loading ? (
        <div style={{ padding: 'var(--sp-6)', display: 'grid', placeItems: 'center' }}>
          <Spinner />
        </div>
      ) : !rows.length ? (
        <EmptyState icon={IconReport} title="No attendance yet" message="Records will appear here once attendance is marked." />
      ) : (
        <div className="recent-list">
          {rows.map((r) => (
            <div className="recent-row" key={r.id}>
              <div className="recent-main">
                <div className="recent-title">
                  {isStudent ? r.subject_name : r.student_name}
                </div>
                <div className="recent-meta">
                  {isStudent
                    ? `${r.class_name} · ${r.session_date}`
                    : `${r.subject_name} · ${r.session_date}`}
                </div>
              </div>
              <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
