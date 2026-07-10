import { useEffect, useState } from 'react'
import api, { apiError } from '../api/client'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { Field, Select, Textarea } from '../components/ui/Field'

/* Teacher/admin manually marks a student for a session (spec §13). */
export default function ManualMarkModal({ open, onClose, onDone }) {
  const toast = useToast()
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [form, setForm] = useState({ session_id: '', student_id: '', status: 'present', reason: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ session_id: '', student_id: '', status: 'present', reason: '' })
    setStudents([])
    api.get('/attendance-sessions').then((r) => setSessions(r.data)).catch(() => setSessions([]))
  }, [open])

  const onSession = async (session_id) => {
    setForm((f) => ({ ...f, session_id, student_id: '' }))
    const s = sessions.find((x) => String(x.id) === String(session_id))
    if (!s) return setStudents([])
    try {
      const r = await api.get(`/classes/${s.class_id}/students`)
      setStudents(r.data)
    } catch {
      setStudents([])
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.session_id || !form.student_id) return toast.error('Select a session and student')
    if (!form.reason.trim()) return toast.error('A reason is required')
    setSaving(true)
    try {
      await api.post('/attendance-records/manual', {
        session_id: Number(form.session_id),
        student_id: Number(form.student_id),
        status: form.status,
        reason: form.reason.trim(),
      })
      toast.success('Attendance marked')
      onDone?.()
      onClose()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manual attendance"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Mark
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={submit}>
        <Field label="Session" required>
          <Select value={form.session_id} onChange={(e) => onSession(e.target.value)} required>
            <option value="">Select session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.session_date} · {s.class_name} · {s.subject_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Student" required>
          <Select
            value={form.student_id}
            onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))}
            disabled={!form.session_id}
            required
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.registration_number})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" required>
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </Select>
        </Field>
        <Field label="Reason" required help="Manual attendance always records a reason.">
          <Textarea
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="e.g. Camera not working; verified in person"
            required
          />
        </Field>
      </form>
    </Modal>
  )
}
