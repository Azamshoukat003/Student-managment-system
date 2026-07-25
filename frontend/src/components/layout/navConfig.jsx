import {
  IconDashboard,
  IconUsers,
  IconClass,
  IconSubject,
  IconAssign,
  IconUser,
  IconSession,
  IconCamera,
  IconReport,
} from '../icons'

/* Nav items per role. */
export const NAV = {
  admin: [
    { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
    { to: '/students', label: 'Students', icon: IconUsers },
    { to: '/users', label: 'Users', icon: IconUsers },
    { to: '/classes', label: 'Classes', icon: IconClass },
    { to: '/subjects', label: 'Subjects', icon: IconSubject },
    { to: '/assignments', label: 'Assignments', icon: IconAssign },
    { to: '/records', label: 'Attendance', icon: IconReport },
    { to: '/activity', label: 'Activity Log', icon: IconSession },
    { to: '/profile', label: 'Profile', icon: IconUser },
  ],
  teacher: [
    { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
    { to: '/sessions', label: 'Sessions', icon: IconSession },
    { to: '/records', label: 'Attendance', icon: IconReport },
    { to: '/profile', label: 'Profile', icon: IconUser },
  ],
  student: [
    { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
    { to: '/face', label: 'Face Registration', icon: IconUser },
    { to: '/mark', label: 'Mark Attendance', icon: IconCamera },
    { to: '/records', label: 'My Attendance', icon: IconReport },
    { to: '/profile', label: 'Profile', icon: IconUser },
  ],
}

export const ROLE_LABEL = {
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
}
