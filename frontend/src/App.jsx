import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Users from './pages/admin/Users'
import Students from './pages/admin/Students'
import Classes from './pages/admin/Classes'
import Subjects from './pages/admin/Subjects'
import Assignments from './pages/admin/Assignments'
import Sessions from './pages/teacher/Sessions'
import MarkAttendance from './pages/student/MarkAttendance'
import FaceRegistration from './pages/student/FaceRegistration'
import AttendanceRecords from './pages/AttendanceRecords'
import ActivityLog from './pages/admin/ActivityLog'

function Admin({ children }) {
  return <ProtectedRoute roles={['admin']}>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="users" element={<Admin><Users /></Admin>} />
        <Route path="students" element={<Admin><Students /></Admin>} />
        <Route path="classes" element={<Admin><Classes /></Admin>} />
        <Route path="subjects" element={<Admin><Subjects /></Admin>} />
        <Route path="assignments" element={<Admin><Assignments /></Admin>} />
        <Route path="sessions" element={<ProtectedRoute roles={['teacher', 'admin']}><Sessions /></ProtectedRoute>} />
        <Route path="mark" element={<ProtectedRoute roles={['student']}><MarkAttendance /></ProtectedRoute>} />
        <Route path="face" element={<ProtectedRoute roles={['student']}><FaceRegistration /></ProtectedRoute>} />
        <Route path="records" element={<AttendanceRecords />} />
        <Route path="activity" element={<Admin><ActivityLog /></Admin>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
