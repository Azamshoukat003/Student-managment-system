import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import StatCard from '../../components/ui/StatCard'
import AttendanceTrendCard from '../../components/AttendanceTrendCard'
import RecentAttendance from '../../components/RecentAttendance'
import Button from '../../components/ui/Button'
import {
  IconUsers,
  IconUser,
  IconClass,
  IconSubject,
  IconSession,
  IconCheck,
  IconPlus,
} from '../../components/icons'

export default function AdminDashboard({ data }) {
  const { user } = useAuth()
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Welcome back, {user.full_name.split(' ')[0]}</h1>
          <p className="page-subtitle">Overview of the attendance system.</p>
        </div>
        <div className="quick-actions">
          <Link to="/users">
            <Button icon={<IconPlus size={16} />}>Add user</Button>
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Students" value={data.total_students} icon={<IconUsers size={18} />} to="/users" />
        <StatCard label="Teachers" value={data.total_teachers} icon={<IconUser size={18} />} to="/users" />
        <StatCard label="Classes" value={data.total_classes} icon={<IconClass size={18} />} to="/classes" />
        <StatCard label="Subjects" value={data.total_subjects} icon={<IconSubject size={18} />} to="/subjects" />
        <StatCard label="Sessions" value={data.total_sessions} icon={<IconSession size={18} />} />
        <StatCard
          label="Today's attendance"
          value={data.today_attendance_count}
          icon={<IconCheck size={18} />}
          tone="present"
          to="/records"
        />
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--sp-5)' }}>
        <AttendanceTrendCard title="Attendance trend" />
        <RecentAttendance limit={6} />
      </div>
    </>
  )
}
