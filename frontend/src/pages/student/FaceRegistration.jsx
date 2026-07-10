import { useState } from 'react'
import api, { apiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import GuidedCapture from '../../components/GuidedCapture'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { IconCheck } from '../../components/icons'

export default function FaceRegistration() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [runKey, setRunKey] = useState(0) // remount GuidedCapture to restart
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null) // {ok, message}

  const onComplete = async (frames) => {
    if (!frames?.length) return
    setSaving(true)
    setResult(null)
    try {
      const r = await api.post('/face/register', { frames })
      const me = await api.get('/users/me')
      setUser(me.data)
      setResult({ ok: true, message: r.data.message || 'Face registered' })
      toast.success('Face registered')
    } catch (err) {
      setResult({ ok: false, message: apiError(err) })
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const restart = () => {
    setResult(null)
    setRunKey((k) => k + 1)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Face Registration</h1>
          <p className="page-subtitle">Follow the prompts — look ahead, then turn right and left.</p>
        </div>
        <Badge tone={user.face_registered ? 'present' : 'pending'} plain>
          {user.face_registered ? 'Registered' : 'Not registered'}
        </Badge>
      </div>

      <div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div className="card-pad stack" style={{ alignItems: 'center' }}>
          {result?.ok ? (
            <>
              <div className="guide-frame" style={{ width: 120, height: 120 }}>
                <div className="guide-overlay done" style={{ inset: 0 }}>
                  <IconCheck size={40} />
                </div>
              </div>
              <div className="guide-prompt ok">{result.message}</div>
              <Button variant="secondary" onClick={restart}>
                Register again
              </Button>
            </>
          ) : (
            <>
              <GuidedCapture key={runKey} mode="register" onComplete={onComplete} busy={saving} />
              {saving && <div className="muted text-sm">Saving your face…</div>}
              {result && !result.ok && (
                <div className="alert alert-error" style={{ width: '100%' }}>
                  {result.message}
                  <Button variant="secondary" size="sm" onClick={restart} style={{ marginLeft: 'auto' }}>
                    Retry
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <p className="muted text-sm" style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
        Tip: good lighting and a plain background help. The green ring fills as each pose is captured.
      </p>
    </>
  )
}
