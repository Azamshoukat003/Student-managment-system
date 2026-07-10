import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Spinner from '../components/ui/Spinner'

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-loading">
        <Spinner />
        <span>Loading…</span>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}
