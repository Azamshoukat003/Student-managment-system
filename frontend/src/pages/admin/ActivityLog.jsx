import { useFetch } from '../../lib/useFetch'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { IconReport } from '../../components/icons'

const LABELS = {
  face_registered: 'Face registered',
  attendance_marked: 'Attendance marked',
  manual_attendance: 'Manual attendance',
}

export default function ActivityLog() {
  const { data, loading } = useFetch('/activity-logs')

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Activity Log</h1>
          <p className="page-subtitle">Recent important actions across the system.</p>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : !data?.length ? (
        <div className="card">
          <EmptyState icon={IconReport} title="No activity yet" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>User</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <tr key={log.id}>
                  <td className="nowrap tabular text-sm">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <Badge tone="role" plain>
                      {LABELS[log.action] || log.action}
                    </Badge>
                  </td>
                  <td>{log.user_name || '—'}</td>
                  <td className="text-sm muted">{log.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
