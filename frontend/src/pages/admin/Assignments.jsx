import { useMemo, useState } from 'react'
import api, { apiError } from '../../api/client'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Field, Select } from '../../components/ui/Field'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { IconPlus, IconTrash, IconAssign } from '../../components/icons'

const empty = { teacher_id: '', class_id: '', subject_id: '' }

export default function Assignments() {
  const { data: rows, loading, reload } = useFetch('/teacher-classes')
  const { data: teachers } = useFetch('/users?role=teacher')
  const { data: classes } = useFetch('/classes')
  const { data: subjects } = useFetch('/subjects')
  const toast = useToast()

  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Subjects filtered to the chosen class.
  const classSubjects = useMemo(
    () => (subjects || []).filter((s) => String(s.class_id) === String(modal?.form.class_id)),
    [subjects, modal?.form.class_id],
  )

  const openAdd = () => setModal({ form: { ...empty } })
  const setForm = (patch) =>
    setModal((m) => {
      const form = { ...m.form, ...patch }
      if (patch.class_id !== undefined) form.subject_id = '' // reset subject when class changes
      return { ...m, form }
    })

  const save = async (e) => {
    e.preventDefault()
    if (!modal.form.teacher_id || !modal.form.class_id || !modal.form.subject_id) {
      return toast.error('Please select teacher, class and subject')
    }
    setSaving(true)
    try {
      await api.post('/teacher-classes', {
        teacher_id: Number(modal.form.teacher_id),
        class_id: Number(modal.form.class_id),
        subject_id: Number(modal.form.subject_id),
      })
      toast.success('Assignment created')
      setModal(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/teacher-classes/${toDelete.id}`)
      toast.success('Assignment removed')
      setToDelete(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setDeleting(false)
    }
  }

  const canAssign = teachers?.length && classes?.length && subjects?.length

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Teacher Assignments</h1>
          <p className="page-subtitle">Assign teachers to a class and subject.</p>
        </div>
        <Button icon={<IconPlus size={16} />} onClick={openAdd} disabled={!canAssign}>
          Add assignment
        </Button>
      </div>

      {loading ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : !canAssign ? (
        <div className="card">
          <EmptyState
            icon={IconAssign}
            title="Setup required"
            message="You need at least one teacher, one class, and one subject before assigning."
          />
        </div>
      ) : !rows?.length ? (
        <div className="card">
          <EmptyState
            icon={IconAssign}
            title="No assignments yet"
            action={
              <Button icon={<IconPlus size={16} />} onClick={openAdd}>
                Add assignment
              </Button>
            }
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Class</th>
                <th>Subject</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-strong">{r.teacher_name}</td>
                  <td>{r.class_name}</td>
                  <td>{r.subject_name}</td>
                  <td className="col-actions">
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} onClick={() => setToDelete(r)} aria-label="Remove" />
                    </div>
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
        title="Add assignment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Assign
            </Button>
          </>
        }
      >
        {modal && (
          <form className="stack" onSubmit={save}>
            <Field label="Teacher" required>
              <Select value={modal.form.teacher_id} onChange={(e) => setForm({ teacher_id: e.target.value })} required>
                <option value="">Select teacher</option>
                {(teachers || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Class" required>
              <Select value={modal.form.class_id} onChange={(e) => setForm({ class_id: e.target.value })} required>
                <option value="">Select class</option>
                {(classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" required help={modal.form.class_id && !classSubjects.length ? 'This class has no subjects yet.' : ''}>
              <Select
                value={modal.form.subject_id}
                onChange={(e) => setForm({ subject_id: e.target.value })}
                disabled={!modal.form.class_id}
                required
              >
                <option value="">Select subject</option>
                {classSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title="Remove assignment"
        message={`Remove ${toDelete?.teacher_name} from ${toDelete?.subject_name}?`}
        confirmLabel="Remove"
        danger
        loading={deleting}
      />
    </>
  )
}
