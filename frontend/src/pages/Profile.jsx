import { useState } from 'react'
import api, { apiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABEL } from '../components/layout/navConfig'
import { useToast } from '../components/ui/Toast'
import { Field, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

export default function Profile() {
  const { user, setUser } = useAuth()
  const toast = useToast()

  const [fullName, setFullName] = useState(user.full_name || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const saveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const r = await api.put('/users/me', { full_name: fullName, phone })
      setUser(r.data)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setPwError('')
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match')
      return
    }
    if (newPw.length < 6) {
      setPwError('Password must be at least 6 characters')
      return
    }
    setSavingPw(true)
    try {
      await api.put('/auth/password', { old_password: oldPw, new_password: newPw })
      toast.success('Password changed')
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      setPwError(apiError(err, 'Could not change password'))
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your account details.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Account details</span>
            <Badge tone="role" plain>
              {ROLE_LABEL[user.role]}
            </Badge>
          </div>
          <form className="card-pad stack" onSubmit={saveProfile}>
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <Field label="Email" help="Contact an administrator to change your email.">
              <Input value={user.email} disabled />
            </Field>
            {user.role === 'student' && (
              <Field label="Registration number">
                <Input value={user.registration_number || ''} disabled />
              </Field>
            )}
            <Field label="Phone">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
                type="tel"
              />
            </Field>
            <div className="row">
              <Button type="submit" loading={savingProfile}>
                Save changes
              </Button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Change password</span>
          </div>
          <form className="card-pad stack" onSubmit={savePassword}>
            <Field label="Current password" error={pwError && !oldPw ? pwError : ''}>
              <Input
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Confirm new password" error={pwError}>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <div className="row">
              <Button type="submit" loading={savingPw}>
                Update password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
