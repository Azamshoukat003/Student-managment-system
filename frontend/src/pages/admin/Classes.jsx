import { useState } from 'react'
import api, { apiError } from '../../api/client'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Field, Input } from '../../components/ui/Field'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { IconPlus, IconEdit, IconTrash, IconClass } from '../../components/icons'

const empty = { name: '', program: '', semester: '' }

export default function Classes() {
  const { data: classes, loading, reload } = useFetch('/classes')
  const toast = useToast()
  const [modal, setModal] = useState(null) // {mode:'add'|'edit', form}
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const openAdd = () => setModal({ mode: 'add', form: { ...empty } })
  const openEdit = (c) =>
    setModal({ mode: 'edit', id: c.id, form: { name: c.name, program: c.program || '', semester: c.semester || '' } })

  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        name: modal.form.name,
        program: modal.form.program || null,
        semester: modal.form.semester ? Number(modal.form.semester) : null,
      }
      if (modal.mode === 'add') await api.post('/classes', body)
      else await api.put(`/classes/${modal.id}`, body)
      toast.success(modal.mode === 'add' ? 'Class created' : 'Class updated')
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
      await api.delete(`/classes/${toDelete.id}`)
      toast.success('Class deleted')
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
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">Manage class and program groups.</p>
        </div>
        <Button icon={<IconPlus size={16} />} onClick={openAdd}>
          Add class
        </Button>
      </div>

      {loading ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : !classes?.length ? (
        <div className="card">
          <EmptyState
            icon={IconClass}
            title="No classes yet"
            message="Create your first class to get started."
            action={
              <Button icon={<IconPlus size={16} />} onClick={openAdd}>
                Add class
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
                <th>Program</th>
                <th>Semester</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td className="cell-strong">{c.name}</td>
                  <td>{c.program || '—'}</td>
                  <td className="tabular">{c.semester ?? '—'}</td>
                  <td className="col-actions">
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" icon={<IconEdit size={16} />} onClick={() => openEdit(c)} aria-label="Edit" />
                      <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} onClick={() => setToDelete(c)} aria-label="Delete" />
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
        title={modal?.mode === 'add' ? 'Add class' : 'Edit class'}
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
            <Field label="Class name" required>
              <Input
                value={modal.form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="BSCS Semester 2"
                autoFocus
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Program">
                <Input
                  value={modal.form.program}
                  onChange={(e) => setForm({ program: e.target.value })}
                  placeholder="CS"
                />
              </Field>
              <Field label="Semester">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={modal.form.semester}
                  onChange={(e) => setForm({ semester: e.target.value })}
                  placeholder="2"
                />
              </Field>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title="Delete class"
        message={`Delete "${toDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </>
  )
}
