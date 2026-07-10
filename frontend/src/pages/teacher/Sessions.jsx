import { useMemo, useState } from 'react'
import api, { apiError } from '../../api/client'
import { useFetch } from '../../lib/useFetch'
import { getCurrentPosition } from '../../lib/geo'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { Field, Input, Select } from '../../components/ui/Field'
import DatePicker from '../../components/ui/DatePicker'
import TimePicker from '../../components/ui/TimePicker'
import LocationMapPicker, { DEFAULT_CENTER } from '../../components/LocationMapPicker'
import { IconPlus, IconSession, IconPin } from '../../components/icons'

const WINDOW_TONE = { present: 'present', late: 'late', upcoming: 'pending', closed: 'neutral' }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const emptyForm = {
  class_id: '',
  subject_id: '',
  session_date: todayStr(),
  start_time: '',
  end_time: '',
  late_cutoff_time: '',
  latitude: DEFAULT_CENTER.lat.toFixed(6),
  longitude: DEFAULT_CENTER.lng.toFixed(6),
  allowed_radius_meters: 100,
}

export default function Sessions() {
  const { data: sessions, loading, reload } = useFetch('/attendance-sessions')
  const { data: assignments } = useFetch('/teacher-classes')
  const toast = useToast()

  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [recenter, setRecenter] = useState(0)
  const [toClose, setToClose] = useState(null)
  const [closing, setClosing] = useState(false)

  // Unique classes and subjects-per-class from the teacher's assignments.
  const classes = useMemo(() => {
    const map = new Map()
    ;(assignments || []).forEach((a) => map.set(a.class_id, a.class_name))
    return [...map].map(([id, name]) => ({ id, name }))
  }, [assignments])

  const subjectsForClass = useMemo(() => {
    return (assignments || [])
      .filter((a) => String(a.class_id) === String(modal?.form.class_id))
      .map((a) => ({ id: a.subject_id, name: a.subject_name }))
  }, [assignments, modal?.form.class_id])

  const setForm = (patch) =>
    setModal((m) => {
      const form = { ...m.form, ...patch }
      if (patch.class_id !== undefined) form.subject_id = ''
      return { ...m, form }
    })

  const useMyLocation = async () => {
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      setForm({ latitude: pos.latitude.toFixed(6), longitude: pos.longitude.toFixed(6) })
      setRecenter((r) => r + 1)
      toast.success(`Location set (±${Math.round(pos.accuracy)}m)`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLocating(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    const f = modal.form
    if (!f.class_id || !f.subject_id) return toast.error('Select class and subject')
    if (!f.latitude || !f.longitude) return toast.error('Set the session location')
    setSaving(true)
    try {
      await api.post('/attendance-sessions', {
        class_id: Number(f.class_id),
        subject_id: Number(f.subject_id),
        session_date: f.session_date,
        start_time: f.start_time,
        end_time: f.end_time,
        late_cutoff_time: f.late_cutoff_time || null,
        latitude: Number(f.latitude),
        longitude: Number(f.longitude),
        allowed_radius_meters: Number(f.allowed_radius_meters) || 100,
      })
      toast.success('Session created')
      setModal(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const doClose = async () => {
    setClosing(true)
    try {
      await api.put(`/attendance-sessions/${toClose.id}/close`)
      toast.success('Session closed')
      setToClose(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setClosing(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Attendance Sessions</h1>
          <p className="page-subtitle">Open a GPS-restricted session for your class.</p>
        </div>
        <Button
          icon={<IconPlus size={16} />}
          onClick={() => setModal({ form: { ...emptyForm } })}
          disabled={!classes.length}
        >
          Create session
        </Button>
      </div>

      {loading ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : !classes.length ? (
        <div className="card">
          <EmptyState
            icon={IconSession}
            title="No classes assigned"
            message="An administrator needs to assign you to a class and subject first."
          />
        </div>
      ) : !sessions?.length ? (
        <div className="card">
          <EmptyState
            icon={IconSession}
            title="No sessions yet"
            message="Create your first attendance session."
            action={
              <Button icon={<IconPlus size={16} />} onClick={() => setModal({ form: { ...emptyForm } })}>
                Create session
              </Button>
            }
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Class · Subject</th>
                <th>Time</th>
                <th>Window</th>
                <th>Marked</th>
                <th>Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="nowrap tabular">{s.session_date}</td>
                  <td>
                    <div className="cell-strong">{s.class_name}</div>
                    <div className="text-xs muted">{s.subject_name}</div>
                  </td>
                  <td className="nowrap tabular">
                    {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                  </td>
                  <td>
                    <Badge tone={WINDOW_TONE[s.window_state] || 'neutral'}>{s.window_state}</Badge>
                  </td>
                  <td className="tabular">{s.marked_count}</td>
                  <td>
                    <Badge tone={s.status}>{s.status}</Badge>
                  </td>
                  <td className="col-actions">
                    {s.status === 'open' ? (
                      <Button variant="secondary" size="sm" onClick={() => setToClose(s)}>
                        Close
                      </Button>
                    ) : (
                      <span className="muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        size="lg"
        title="Create attendance session"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Create
            </Button>
          </>
        }
      >
        {modal && (
          <form className="stack" onSubmit={save}>
            <div className="form-grid">
              <Field label="Class" required>
                <Select value={modal.form.class_id} onChange={(e) => setForm({ class_id: e.target.value })} required>
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subject" required>
                <Select
                  value={modal.form.subject_id}
                  onChange={(e) => setForm({ subject_id: e.target.value })}
                  disabled={!modal.form.class_id}
                  required
                >
                  <option value="">Select subject</option>
                  {subjectsForClass.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date" required className="full">
                <DatePicker
                  value={modal.form.session_date}
                  onChange={(v) => setForm({ session_date: v })}
                  clearable={false}
                />
              </Field>
              <Field label="Start time" required>
                <TimePicker value={modal.form.start_time} onChange={(v) => setForm({ start_time: v })} />
              </Field>
              <Field label="End time" required>
                <TimePicker value={modal.form.end_time} onChange={(v) => setForm({ end_time: v })} />
              </Field>
              <Field label="Late cutoff" help="Optional — until when late marks are allowed." className="full">
                <TimePicker value={modal.form.late_cutoff_time} onChange={(v) => setForm({ late_cutoff_time: v })} placeholder="Optional" />
              </Field>
            </div>

            <div className="card" style={{ padding: 'var(--sp-4)', background: 'var(--surface-2)' }}>
              <div className="row-between" style={{ marginBottom: 'var(--sp-3)' }}>
                <span className="field-label">Session location</span>
                <Button type="button" variant="secondary" size="sm" icon={<IconPin size={15} />} onClick={useMyLocation} loading={locating}>
                  Use my location
                </Button>
              </div>

              <LocationMapPicker
                lat={parseFloat(modal.form.latitude)}
                lng={parseFloat(modal.form.longitude)}
                radius={Number(modal.form.allowed_radius_meters) || 100}
                recenterSignal={recenter}
                onChange={({ lat, lng }) =>
                  setForm({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) })
                }
              />
              <div className="map-hint">Tap the map or drag the pin to set the exact classroom location.</div>

              <div className="radius-row" style={{ marginTop: 'var(--sp-4)' }}>
                <span className="field-label" style={{ minWidth: 96 }}>Allowed radius</span>
                <input
                  type="range"
                  className="radius-slider"
                  min="20"
                  max="500"
                  step="10"
                  value={modal.form.allowed_radius_meters}
                  onChange={(e) => setForm({ allowed_radius_meters: e.target.value })}
                />
                <span className="radius-value">{modal.form.allowed_radius_meters} m</span>
              </div>

              <div className="coord-readout" style={{ marginTop: 'var(--sp-2)' }}>
                <span>Lat: {modal.form.latitude || '—'}</span>
                <span>Lng: {modal.form.longitude || '—'}</span>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toClose}
        onClose={() => setToClose(null)}
        onConfirm={doClose}
        title="Close session"
        message="Students will no longer be able to mark attendance for this session."
        confirmLabel="Close session"
        loading={closing}
      />
    </>
  )
}
