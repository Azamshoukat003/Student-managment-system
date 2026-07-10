import { useMemo, useState } from 'react'
import api, { apiError } from '../../api/client'
import { useFetch } from '../../lib/useFetch'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Badge from '../../components/ui/Badge'
import { Field, Input, Select } from '../../components/ui/Field'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { IconPlus, IconEdit, IconTrash, IconKey, IconSearch, IconUsers } from '../../components/icons'

const emptyStudent = {
  role: 'student',
  full_name: '',
  email: '',
  password: '',
  registration_number: '',
  class_id: '',
  semester: '',
  department: '',
  phone: '',
  is_active: true,
}

export default function Users() {
  const { data: users, loading, reload } = useFetch('/users')
  const { data: classes } = useFetch('/classes')
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modal, setModal] = useState(null) // {mode, id?, form}
  const [saving, setSaving] = useState(false)
  const [resetFor, setResetFor] = useState(null)
  const [newPw, setNewPw] = useState('')
  const [toDeactivate, setToDeactivate] = useState(null)
  const [busy, setBusy] = useState(false)

  const classMap = useMemo(
    () => Object.fromEntries((classes || []).map((c) => [c.id, c.name])),
    [classes],
  )

  const filtered = useMemo(() => {
    let list = users || []
    if (roleFilter) list = list.filter((u) => u.role === roleFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.registration_number || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [users, roleFilter, search])

  const openAdd = () => setModal({ mode: 'add', form: { ...emptyStudent } })
  const openEdit = (u) =>
    setModal({
      mode: 'edit',
      id: u.id,
      form: {
        role: u.role,
        full_name: u.full_name,
        email: u.email,
        registration_number: u.registration_number || '',
        class_id: u.class_id || '',
        semester: u.semester || '',
        department: u.department || '',
        phone: u.phone || '',
        is_active: u.is_active,
      },
    })
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const f = modal.form
      if (modal.mode === 'add') {
        const body = {
          role: f.role,
          full_name: f.full_name,
          email: f.email,
          password: f.password,
          phone: f.phone || null,
          is_active: f.is_active,
        }
        if (f.role === 'student') {
          body.registration_number = f.registration_number
          body.class_id = f.class_id ? Number(f.class_id) : null
          body.semester = f.semester ? Number(f.semester) : null
        } else {
          body.department = f.department || null
        }
        await api.post('/users', body)
        toast.success('User created')
      } else {
        const body = {
          full_name: f.full_name,
          email: f.email,
          phone: f.phone || null,
          is_active: f.is_active,
        }
        if (f.role === 'student') {
          body.class_id = f.class_id ? Number(f.class_id) : null
          body.semester = f.semester ? Number(f.semester) : null
        } else {
          body.department = f.department || null
        }
        await api.put(`/users/${modal.id}`, body)
        toast.success('User updated')
      }
      setModal(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const doReset = async () => {
    if (newPw.length < 6) return toast.error('Password must be at least 6 characters')
    setBusy(true)
    try {
      await api.post(`/users/${resetFor.id}/reset-password`, { new_password: newPw })
      toast.success(`Temporary password set for ${resetFor.full_name}`)
      setResetFor(null)
      setNewPw('')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  const doDeactivate = async () => {
    setBusy(true)
    try {
      await api.delete(`/users/${toDeactivate.id}`)
      toast.success('User deactivated')
      setToDeactivate(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  const isStudent = modal?.form.role === 'student'

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage students and teachers.</p>
        </div>
        <Button icon={<IconPlus size={16} />} onClick={openAdd}>
          Add user
        </Button>
      </div>

      <div className="toolbar">
        <div className="search grow">
          <IconSearch size={16} />
          <Input
            placeholder="Search by name, email or reg. no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
        </Select>
      </div>

      {loading ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : !filtered.length ? (
        <div className="card">
          <EmptyState
            icon={IconUsers}
            title={users?.length ? 'No matching users' : 'No users yet'}
            message={users?.length ? 'Try a different search or filter.' : 'Add your first student or teacher.'}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / Reg. no</th>
                <th>Role</th>
                <th>Class / Dept</th>
                <th>Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="cell-strong">{u.full_name}</td>
                  <td>
                    <div>{u.email}</div>
                    {u.registration_number && (
                      <div className="text-xs muted mono">{u.registration_number}</div>
                    )}
                  </td>
                  <td>
                    <Badge tone="role" plain>
                      {u.role}
                    </Badge>
                  </td>
                  <td>{u.role === 'student' ? classMap[u.class_id] || '—' : u.department || '—'}</td>
                  <td>
                    <Badge tone={u.is_active ? 'active' : 'inactive'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="col-actions">
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      {u.role !== 'admin' && (
                        <>
                          <Button variant="ghost" size="sm" icon={<IconEdit size={16} />} onClick={() => openEdit(u)} aria-label="Edit" />
                          <Button variant="ghost" size="sm" icon={<IconKey size={16} />} onClick={() => setResetFor(u)} aria-label="Reset password" />
                          {u.is_active && (
                            <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} onClick={() => setToDeactivate(u)} aria-label="Deactivate" />
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / edit modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        size="lg"
        title={modal?.mode === 'add' ? 'Add user' : `Edit ${modal?.form.full_name}`}
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
            {modal.mode === 'add' && (
              <Field label="Role" required>
                <Select value={modal.form.role} onChange={(e) => setForm({ role: e.target.value })}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </Select>
              </Field>
            )}
            <div className="form-grid">
              <Field label="Full name" required className="full">
                <Input value={modal.form.full_name} onChange={(e) => setForm({ full_name: e.target.value })} required />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={modal.form.email} onChange={(e) => setForm({ email: e.target.value })} required />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={modal.form.phone} onChange={(e) => setForm({ phone: e.target.value })} />
              </Field>

              {modal.mode === 'add' && (
                <Field label="Password" required className="full" help="The user can change this later from their profile.">
                  <Input type="text" value={modal.form.password} onChange={(e) => setForm({ password: e.target.value })} required />
                </Field>
              )}

              {isStudent ? (
                <>
                  <Field label="Registration number" required>
                    <Input
                      value={modal.form.registration_number}
                      onChange={(e) => setForm({ registration_number: e.target.value })}
                      placeholder="2021-CS-02"
                      disabled={modal.mode === 'edit'}
                      required
                    />
                  </Field>
                  <Field label="Semester">
                    <Input type="number" min="1" max="12" value={modal.form.semester} onChange={(e) => setForm({ semester: e.target.value })} />
                  </Field>
                  <Field label="Class" className="full">
                    <Select value={modal.form.class_id} onChange={(e) => setForm({ class_id: e.target.value })}>
                      <option value="">Unassigned</option>
                      {(classes || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              ) : (
                <Field label="Department" className="full">
                  <Input value={modal.form.department} onChange={(e) => setForm({ department: e.target.value })} placeholder="Computer Science" />
                </Field>
              )}

              {modal.mode === 'edit' && (
                <Field label="Status" className="full">
                  <Select
                    value={modal.form.is_active ? '1' : '0'}
                    onChange={(e) => setForm({ is_active: e.target.value === '1' })}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </Select>
                </Field>
              )}
            </div>
          </form>
        )}
      </Modal>

      {/* Reset password modal */}
      <Modal
        open={!!resetFor}
        onClose={() => {
          setResetFor(null)
          setNewPw('')
        }}
        title="Reset password"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResetFor(null)
                setNewPw('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={doReset} loading={busy}>
              Set password
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="muted text-sm">
            Set a temporary password for <strong>{resetFor?.full_name}</strong>. They can change it
            after logging in.
          </p>
          <Field label="Temporary password" required>
            <Input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDeactivate}
        onClose={() => setToDeactivate(null)}
        onConfirm={doDeactivate}
        title="Deactivate user"
        message={`Deactivate ${toDeactivate?.full_name}? They will not be able to log in, and their face data won't be recognized.`}
        confirmLabel="Deactivate"
        danger
        loading={busy}
      />
    </>
  )
}
