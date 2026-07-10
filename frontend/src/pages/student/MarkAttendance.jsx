import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { apiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import GpsCapture from '../../components/GpsCapture'
import GuidedCapture from '../../components/GuidedCapture'
import LocationMapView from '../../components/LocationMapView'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { IconSession, IconCheck, IconAlert } from '../../components/icons'

export default function MarkAttendance() {
  const { user } = useAuth()
  const toast = useToast()
  const [state, setState] = useState({ loading: true })
  const [coords, setCoords] = useState(null)
  const [checking, setChecking] = useState(false)
  const [locCheck, setLocCheck] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(() => {
    setCoords(null)
    setLocCheck(null)
    setResult(null)
    setState((s) => ({ ...s, loading: true }))
    api
      .get('/attendance-sessions/active')
      .then((r) => setState({ loading: false, ...r.data }))
      .catch((e) => setState({ loading: false, error: apiError(e) }))
  }, [])

  const onFaceCaptured = async (frames) => {
    const frame = Array.isArray(frames) ? frames[0] : frames
    if (!frame) return
    setMarking(true)
    try {
      const r = await api.post('/attendance-records/mark-face', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        gps_accuracy: coords.accuracy,
        frame,
      })
      setResult({ ok: true, ...r.data })
      setCameraOpen(false)
      toast.success(r.data.message)
      setState((s) => ({ ...s, already_marked: true }))
    } catch (err) {
      setResult({ ok: false, message: apiError(err) })
      setCameraOpen(false)
      toast.error(apiError(err))
    } finally {
      setMarking(false)
    }
  }

  useEffect(() => {
    load()
  }, [load])

  const onCapture = async (pos) => {
    setCoords(pos)
    setLocCheck(null)
    if (!pos) return
    setChecking(true)
    try {
      const r = await api.post('/attendance-records/check-location', {
        latitude: pos.latitude,
        longitude: pos.longitude,
        gps_accuracy: pos.accuracy,
      })
      setLocCheck(r.data)
    } catch (e) {
      setLocCheck({ eligible: false, message: apiError(e) })
    } finally {
      setChecking(false)
    }
  }

  const { loading, session, already_marked, message, error } = state

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Mark Attendance</h1>
          <p className="page-subtitle">Mark attendance for your current class session.</p>
        </div>
        <Badge tone={user.face_registered ? 'present' : 'pending'} plain>
          {user.face_registered ? 'Face registered' : 'Face not registered'}
        </Badge>
      </div>

      {loading ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : !session ? (
        <div className="card">
          <EmptyState
            icon={IconSession}
            title="No open session"
            message={message || 'There is no attendance session open for your class right now.'}
            action={
              <Button variant="secondary" onClick={load}>
                Refresh
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-header">
            <span className="card-title">{session.subject_name}</span>
            <Badge tone={session.window_state === 'late' ? 'late' : 'present'}>
              {session.window_state === 'late' ? 'Late window' : 'Open'}
            </Badge>
          </div>
          <div className="card-pad stack">
            <div className="grid-2">
              <div>
                <div className="text-xs muted">Class</div>
                <div className="cell-strong">{session.class_name}</div>
              </div>
              <div>
                <div className="text-xs muted">Time</div>
                <div className="cell-strong tabular">
                  {session.start_time?.slice(0, 5)}–{session.end_time?.slice(0, 5)}
                </div>
              </div>
            </div>

            <LocationMapView
              sessionLat={session.latitude}
              sessionLng={session.longitude}
              radius={session.allowed_radius_meters}
              userLat={coords?.latitude}
              userLng={coords?.longitude}
            />

            {already_marked ? (
              <div className="alert" style={{ background: 'var(--present-weak)', color: 'var(--present)' }}>
                <IconCheck size={16} /> You have already marked attendance for this session.
              </div>
            ) : (
              <>
                <div>
                  <div className="field-label" style={{ marginBottom: 'var(--sp-2)' }}>
                    Step 1 · Confirm your location
                  </div>
                  <GpsCapture coords={coords} onCapture={onCapture} />
                </div>

                {checking && (
                  <div className="row text-sm muted">
                    <Spinner /> Checking your location…
                  </div>
                )}

                {locCheck && (
                  <div
                    className="alert"
                    style={
                      locCheck.eligible
                        ? { background: 'var(--present-weak)', color: 'var(--present)' }
                        : { background: 'var(--absent-weak)', color: 'var(--destructive)' }
                    }
                  >
                    {locCheck.eligible ? <IconCheck size={16} /> : <IconAlert size={16} />}
                    <span>
                      {locCheck.message}
                      {locCheck.distance != null && ` (${Math.round(locCheck.distance)}m from session)`}
                    </span>
                  </div>
                )}

                <div>
                  <div className="field-label" style={{ marginBottom: 'var(--sp-2)' }}>
                    Step 2 · Verify your face
                  </div>
                  <Button
                    onClick={() => setCameraOpen(true)}
                    disabled={!locCheck?.eligible || !user.face_registered}
                    title={!user.face_registered ? 'Register your face first' : undefined}
                  >
                    Capture face & mark attendance
                  </Button>
                  {!user.face_registered && (
                    <div className="field-help" style={{ marginTop: 'var(--sp-2)' }}>
                      You need to{' '}
                      <Link to="/face" style={{ color: 'var(--primary)', fontWeight: 500 }}>
                        register your face
                      </Link>{' '}
                      before marking attendance.
                    </div>
                  )}
                </div>

                {result && (
                  <div
                    className="alert"
                    style={
                      result.ok
                        ? { background: 'var(--present-weak)', color: 'var(--present)' }
                        : { background: 'var(--absent-weak)', color: 'var(--destructive)' }
                    }
                  >
                    {result.ok ? <IconCheck size={16} /> : <IconAlert size={16} />}
                    <span>{result.message}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <Modal
        open={cameraOpen}
        onClose={() => !marking && setCameraOpen(false)}
        title="Verify your face"
      >
        <div className="stack">
          <p className="muted text-sm" style={{ textAlign: 'center' }}>
            Look straight at the camera — it captures automatically.
          </p>
          {cameraOpen && <GuidedCapture mode="mark" onComplete={onFaceCaptured} busy={marking} />}
        </div>
      </Modal>
    </>
  )
}
