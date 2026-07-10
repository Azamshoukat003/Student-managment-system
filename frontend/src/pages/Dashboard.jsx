import { useEffect, useState } from 'react'
import api, { apiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Spinner from '../components/ui/Spinner'
import AdminDashboard from './admin/AdminDashboard'
import TeacherDashboard from './teacher/TeacherDashboard'
import StudentDashboard from './student/StudentDashboard'

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/dashboard/summary')
      .then((r) => setData(r.data))
      .catch((e) => setError(apiError(e)))
  }, [])

  if (error) return <div className="alert alert-error">{error}</div>
  if (!data)
    return (
      <div className="page-loading">
        <Spinner />
      </div>
    )

  if (user.role === 'admin') return <AdminDashboard data={data} />
  if (user.role === 'teacher') return <TeacherDashboard data={data} />
  return <StudentDashboard data={data} />
}
