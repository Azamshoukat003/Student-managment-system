import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiError } from '../api/client'
import { Field, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import { IconAlert, IconCamera, IconPin, IconReport } from '../components/icons'

const FEATURES = [
  { icon: IconReport, text: 'Centralized student records' },
  { icon: IconCamera, text: 'Face-verified attendance' },
  { icon: IconPin, text: 'GPS-restricted sessions' },
]

export default function Login() {
  const { user, login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(identifier.trim(), password)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      setError(apiError(err, 'Invalid credentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      {/* Left: branded panel */}
      <aside className="login-brand">
        <div className="login-brand-top login-anim" style={{ animationDelay: '40ms' }}>
          <img src="/logo.png" alt="IUB" className="login-logo" />
          <span className="login-brand-name">Student Management System</span>
        </div>

        <div className="login-brand-mid">
          <h1 className="login-headline login-anim" style={{ animationDelay: '120ms' }}>
            Student records &amp; attendance, in one place.
          </h1>
          <p className="login-tagline login-anim" style={{ animationDelay: '200ms' }}>
            A secure web-based student management system with face &amp; GPS verified
            attendance for the Islamia University of Bahawalpur.
          </p>
          <ul className="login-features">
            {FEATURES.map((f, i) => (
              <li key={f.text} className="login-anim" style={{ animationDelay: `${280 + i * 70}ms` }}>
                <span className="login-feature-icon">
                  <f.icon size={16} />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="login-brand-foot login-anim" style={{ animationDelay: '540ms' }}>
          MTB College Sadiqabad<br />
          <small>Islamia University of Bahawalpur</small>
        </div>
      </aside>

      {/* Right: sign-in form */}
      <main className="login-form-side">
        <div className="login-form-wrap">
          <div className="login-form-brand login-anim" style={{ animationDelay: '60ms' }}>
            <img src="/logo.png" alt="IUB" className="brand-logo" />
            <span className="brand-name">Student Management System</span>
          </div>

          <h2 className="login-form-title login-anim" style={{ animationDelay: '120ms' }}>
            Welcome back
          </h2>
          <p className="login-form-sub login-anim" style={{ animationDelay: '180ms' }}>
            Sign in to continue to your dashboard.
          </p>

          <form onSubmit={onSubmit}>
            {error && (
              <div className="alert alert-error login-shake">
                <IconAlert size={16} />
                <span>{error}</span>
              </div>
            )}
            <div className="login-anim" style={{ animationDelay: '240ms' }}>
              <Field label="Email or registration number">
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@attendance.local"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </Field>
            </div>
            <div className="login-anim" style={{ animationDelay: '300ms' }}>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>
            </div>
            <div className="login-anim" style={{ animationDelay: '360ms' }}>
              <Button type="submit" variant="primary" className="btn-block" loading={loading}>
                Sign in
              </Button>
            </div>
          </form>

          <div className="login-form-hint login-anim" style={{ animationDelay: '440ms' }}>
            Forgot your password? Ask an administrator to reset it.
          </div>
        </div>
      </main>
    </div>
  )
}
