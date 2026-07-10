import { useMemo, useState } from 'react'
import api, { apiError } from '../../api/client'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Field, Input, Select } from '../../components/ui/Field'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { IconPlus, IconEdit, IconTrash, IconSubject } from '../../components/icons'

const empty = { name: '', code: '', class_id: '' }

export default function Subjects() {
  const { data: subjects, loading, reload } = useFetch('/subjects')
  const { data: classes } = useFetch('/classes')
  const toast = useToast()
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const classMap = useMemo(
    () => Object.fromEntries((classes || []).map((c) => [c.id, c.name])),
    [classes],
  )

  const openAdd = () => setModal({ mode: 'add', form: { ...empty } })
  const openEdit = (s) =>
    setModal({ mode: 'edit', id: s.id, form: { name: s.name, code: s.code || '', class_id: s.class_id } })
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }))

  const save = async (e) => {
    e.preventDefault()
    if (!modal.form.class_id) return toast.error('Please select a class')
    setSaving(true)
    try {
      const body = {
        name: modal.form.name,
        code: modal.form.code || null,
        class_id: Number(modal.form.class_id),
      }
      if (modal.mode === 'add') await api.post('/subjects', body)
      else await api.put(`/subjects/${modal.id}`, body)
      toast.success(modal.mode === 'add' ? 'Subject created' : 'Subject updated')
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
      await api.delete(`/subjects/${toDelete.id}`)
      toast.success('Subject deleted')
      setToDelete(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">Manage subjects within each class.</p>
        </div>
        <Button icon={<IconPlus size={16} />} onClick={openAdd} disabled={!classes?.length}>
          Add subject
        </Button>
      </div>

      {loading ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : !classes?.length ? (
        <div className="card">
          <EmptyState
            icon={IconSubject}
            title="Add a class first"
            message="Subjects belong to a class. Create a class before adding subjects."
          />
        </div>
      ) : !subjects?.length ? (
        <div className="card">
          <EmptyState
            icon={IconSubject}
            title="No subjects yet"
            action={
              <Button icon={<IconPlus size={16} />} onClick={openAdd}>
                Add subject
              </Button>
            }
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Class</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td className="cell-strong">{s.name}</td>
                  <td>{s.code || '—'}</td>
                  <td>{classMap[s.class_id] || '—'}</td>
                  <td className="col-actions">
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" icon={<IconEdit size={16} />} onClick={() => openEdit(s)} aria-label="Edit" />
                      <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} onClick={() => setToDelete(s)} aria-label="Delete" />
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
        title={modal?.mode === 'add' ? 'Add subject' : 'Edit subject'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        {modal && (
          <form className="stack" onSubmit={save}>
            <Field label="Subject name" required>
              <Input
                value={modal.form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="Artificial Intelligence"
                autoFocus
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Code">
                <Input
                  value={modal.form.code}
                  onChange={(e) => setForm({ code: e.target.value })}
                  placeholder="AI-301"
                />
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
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title="Delete subject"
        message={`Delete "${toDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </>
  )
}
