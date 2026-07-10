import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import StatCard from '../../components/ui/StatCard'
import AttendanceTrendCard from '../../components/AttendanceTrendCard'
import RecentAttendance from '../../components/RecentAttendance'
import Button from '../../components/ui/Button'
import { IconClass, IconSession, IconCheck, IconPlus, IconReport } from '../../components/icons'

export default function TeacherDashboard({ data }) {
  const { user } = useAuth()
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Welcome back, {user.full_name.split(' ')[0]}</h1>
          <p className="page-subtitle">Your teaching overview for today.</p>
        </div>
        <div className="quick-actions">
          <Link to="/sessions">
            <Button icon={<IconPlus size={16} />}>New session</Button>
          </Link>
          <Link to="/records">
            <Button variant="secondary" icon={<IconReport size={16} />}>
              Attendance
            </Button>
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Assigned classes" value={data.assigned_classes} icon={<IconClass size={18} />} to="/sessions" />
        <StatCard label="Today's sessions" value={data.today_sessions} icon={<IconSession size={18} />} to="/sessions" />
        <StatCard label="Open sessions" value={data.open_sessions} icon={<IconCheck size={18} />} tone="present" to="/sessions" />
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--sp-5)' }}>
        <AttendanceTrendCard title="Attendance trend" />
        <RecentAttendance limit={6} />
      </div>
    </>
  )
}
