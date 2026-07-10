import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import AttendanceRing from '../../components/AttendanceRing'
import RecentAttendance from '../../components/RecentAttendance'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { IconCamera, IconUser } from '../../components/icons'

export default function StudentDashboard({ data }) {
  const { user } = useAuth()
  const registered = data.face_registered

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Hello, {user.full_name.split(' ')[0]}</h1>
          <p className="page-subtitle">Here's your attendance at a glance.</p>
        </div>
        <Badge tone={registered ? 'present' : 'pending'} plain>
          {registered ? 'Face registered' : 'Face not registered'}
        </Badge>
      </div>

      <div className="quick-actions rise" style={{ animationDelay: '20ms' }}>
        {registered ? (
          <>
            <Link to="/mark">
              <Button icon={<IconCamera size={16} />}>Mark attendance</Button>
            </Link>
            <Link to="/face">
              <Button variant="secondary" icon={<IconUser size={16} />}>
                Update face
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Link to="/face">
              <Button icon={<IconUser size={16} />}>Register your face</Button>
            </Link>
            <Link to="/mark">
              <Button variant="secondary" icon={<IconCamera size={16} />}>
                Mark attendance
              </Button>
            </Link>
          </>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="card rise" style={{ animationDelay: '120ms' }}>
          <div className="card-header">
            <span className="card-title">Overall attendance</span>
          </div>
          <div className="card-pad">
            <AttendanceRing
              percentage={data.attendance_percentage}
              present={data.present}
              late={data.late}
              absent={data.absent}
            />
          </div>
        </div>

        <RecentAttendance limit={6} />
      </div>
    </>
  )
}
