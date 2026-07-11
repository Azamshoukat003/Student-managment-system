import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { NAV, ROLE_LABEL } from './navConfig'
import { IconMenu } from '../icons'
import UserMenu from './UserMenu'
import PullToRefresh from '../PullToRefresh'

export default function AppLayout() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const items = NAV[user.role] || []

  // Current page title from the active nav item.
  const active = items.find((i) =>
    i.end ? location.pathname === i.to : location.pathname.startsWith(i.to),
  )

  return (
    <div className="layout">
      <PullToRefresh />
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo.jpg" alt="IUB" className="brand-logo" />
          <span className="brand-name">IUB Attendance System</span>
        </div>
        <nav className="nav">
          <span className="nav-section">{ROLE_LABEL[user.role]}</span>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button
              className="btn btn-ghost btn-icon menu-btn"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <IconMenu size={20} />
            </button>
            <span className="topbar-title">{active?.label || 'Dashboard'}</span>
          </div>
          <UserMenu />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
