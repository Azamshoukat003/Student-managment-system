import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_LABEL } from './navConfig'
import { IconUser, IconLogout, IconChevronDown } from '../icons'

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="usermenu" ref={ref}>
      <button className="usermenu-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="avatar">{initials(user.full_name)}</span>
        <IconChevronDown size={16} />
      </button>
      {open && (
        <div className="usermenu-pop">
          <div className="usermenu-info">
            <div className="usermenu-name">{user.full_name}</div>
            <div className="usermenu-sub">{ROLE_LABEL[user.role]}</div>
          </div>
          <button
            className="usermenu-item"
            onClick={() => {
              setOpen(false)
              navigate('/profile')
            }}
          >
            <IconUser size={16} /> Profile
          </button>
          <button
            className="usermenu-item danger"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <IconLogout size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
