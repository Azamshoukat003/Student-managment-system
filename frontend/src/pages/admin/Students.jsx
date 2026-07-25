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
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconUsers,
  IconReport,
} from '../../components/icons'

const PAGE_SIZE = 10

const emptyForm = {
  full_name: '',
  email: '',
  password: '',
  registration_number: '',
  father_name: '',
  program: '',
  semester: '',
  section: '',
  class_id: '',
  phone: '',
  address: '',
  is_active: true,
}

/* SRS UC-07: export the (filtered) student records as a CSV report. */
function exportCsv(rows, classMap) {
  const headers = [
    'Roll No', 'Name', 'Father Name', 'Program', 'Semester',
    'Section', 'Class', 'Email', 'Phone', 'Address', 'Status',
  ]
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [headers.map(esc).join(',')]
  for (const s of rows) {
    lines.push(
      [
        s.registration_number, s.full_name, s.father_name, s.program, s.semester,
        s.section, classMap[s.class_id] || '', s.email, s.phone, s.address,
        s.is_active ? 'Active' : 'Inactive',
      ].map(esc).join(','),
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Students() {
  const { data: users, loading, reload } = useFetch('/users')
  const { data: classes } = useFetch('/classes')
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // {mode, id?, form}
  const [detail, setDetail] = useState(null)
  const [toDeactivate, setToDeactivate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  const classMap = useMemo(
    () => Object.fromEntries((classes || []).map((c) => [c.id, c.name])),
    [classes],
  )

  const students = useMemo(() => (users || []).filter((u) => u.role === 'student'), [users])

  const programs = useMemo(
    () => [...new Set(students.map((s) => s.program).filter(Boolean))].sort(),
    [students],
  )

  /* SRS UC-06: search & filter student records. */
  const filtered = useMemo(() => {
    let list = students
    if (programFilter) list = list.filter((s) => s.program === programFilter)
    if (classFilter) list = list.filter((s) => String(s.class_id) === classFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.registration_number || '').toLowerCase().includes(q) ||
          (s.father_name || '').toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q),
      )
    }
    return list
  }, [students, programFilter, classFilter, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const openAdd = () => setModal({ mode: 'add', form: { ...emptyForm } })
  const openEdit = (s) =>
    setModal({
      mode: 'edit',
      id: s.id,
      form: {
        full_name: s.full_name,
        email: s.email,
        registration_number: s.registration_number || '',
        father_name: s.father_name || '',
        program: s.program || '',
        semester: s.semester || '',
        section: s.section || '',
        class_id: s.class_id || '',
        phone: s.phone || '',
        address: s.address || '',
        is_active: s.is_active,
      },
    })
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }))

  /* SRS UC-02 / UC-04: add or update a student record. */
  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const f = modal.form
      const body = {
        full_name: f.full_name,
        email: f.email,
        father_name: f.father_name || null,
        program: f.program || null,
        semester: f.semester ? Number(f.semester) : null,
        section: f.section || null,
        class_id: f.class_id ? Number(f.class_id) : null,
        phone: f.phone || null,
        address: f.address || null,
        is_active: f.is_active,
      }
      if (modal.mode === 'add') {
        await api.post('/users', {
          ...body,
          role: 'student',
          password: f.password,
          registration_number: f.registration_number,
        })
        toast.success('Student added')
      } else {
        await api.put(`/users/${modal.id}`, body)
        toast.success('Student updated')
      }
      setModal(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  /* SRS UC-05: delete (soft-deactivate) a student record. */
  const doDeactivate = async () => {
    setBusy(true)
    try {
      await api.delete(`/users/${toDeactivate.id}`)
      toast.success('Student deactivated')
      setToDeactivate(null)
      reload()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">Manage student records — add, update, search and report.</p>
        </div>
        <div className="row">
          <Button
            variant="secondary"
            icon={<IconReport size={16} />}
            onClick={() => exportCsv(filtered, classMap)}
            disabled={!filtered.length}
          >
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={!filtered.length}>
            Print
          </Button>
          <Button icon={<IconPlus size={16} />} onClick={openAdd}>
            Add student
          </Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search grow">
          <IconSearch size={16} />
          <Input
            placeholder="Search by name, roll no, father name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          className="filter-select"
          value={programFilter}
          onChange={(e) => {
            setProgramFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select
          className="filter-select"
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All classes</option>
          {(classes || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
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
            title={students.length ? 'No matching students' : 'No students yet'}
            message={
              students.length
                ? 'Try a different search or filter.'
                : 'Add your first student record.'
            }
          />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th>Father Name</th>
                  <th>Program</th>
                  <th>Sem</th>
                  <th>Section</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((s) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(s)}>
                    <td className="mono">{s.registration_number || '—'}</td>
                    <td className="cell-strong">{s.full_name}</td>
                    <td>{s.father_name || '—'}</td>
                    <td>{s.program || '—'}</td>
                    <td>{s.semester || '—'}</td>
                    <td>{s.section || '—'}</td>
                    <td>{classMap[s.class_id] || '—'}</td>
                    <td>
                      <Badge tone={s.is_active ? 'active' : 'inactive'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<IconEdit size={16} />}
                          onClick={() => openEdit(s)}
                          aria-label="Edit"
                        />
                        {s.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<IconTrash size={16} />}
                            onClick={() => setToDeactivate(s)}
                            aria-label="Deactivate"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <span className="muted text-sm">
                Page {currentPage} of {pageCount} · {filtered.length} students
              </span>
              <div className="row">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Student detail (SRS §3.5.1: student detail page) */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.full_name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                const s = detail
                setDetail(null)
                openEdit(s)
              }}
            >
              Edit
            </Button>
          </>
        }
      >
        {detail && (
          <div className="form-grid">
            {[
              ['Roll No', detail.registration_number],
              ['Father Name', detail.father_name],
              ['Program', detail.program],
              ['Semester', detail.semester],
              ['Section', detail.section],
              ['Class', classMap[detail.class_id]],
              ['Email', detail.email],
              ['Phone', detail.phone],
              ['Address', detail.address],
              ['Status', detail.is_active ? 'Active' : 'Inactive'],
              ['Face registered', detail.face_registered ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-xs muted">{label}</div>
                <div>{value || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Add / edit modal (SRS UC-02 / UC-04) */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        size="lg"
        title={modal?.mode === 'add' ? 'Add student' : `Edit ${modal?.form.full_name}`}
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
            <div className="form-grid">
              <Field label="Full name" required>
                <Input
                  value={modal.form.full_name}
                  onChange={(e) => setForm({ full_name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Roll number" required>
                <Input
                  value={modal.form.registration_number}
                  onChange={(e) => setForm({ registration_number: e.target.value })}
                  placeholder="2021-CS-02"
                  disabled={modal.mode === 'edit'}
                  required
                />
              </Field>
              <Field label="Father name">
                <Input
                  value={modal.form.father_name}
                  onChange={(e) => setForm({ father_name: e.target.value })}
                />
              </Field>
              <Field label="Program">
                <Input
                  value={modal.form.program}
                  onChange={(e) => setForm({ program: e.target.value })}
                  placeholder="BSCS"
                />
              </Field>
              <Field label="Semester">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={modal.form.semester}
                  onChange={(e) => setForm({ semester: e.target.value })}
                />
              </Field>
              <Field label="Section">
                <Input
                  value={modal.form.section}
                  onChange={(e) => setForm({ section: e.target.value })}
                  placeholder="A"
                />
              </Field>
              <Field label="Class">
                <Select
                  value={modal.form.class_id}
                  onChange={(e) => setForm({ class_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {(classes || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Phone">
                <Input
                  type="tel"
                  value={modal.form.phone}
                  onChange={(e) => setForm({ phone: e.target.value })}
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={modal.form.email}
                  onChange={(e) => setForm({ email: e.target.value })}
                  required
                />
              </Field>
              {modal.mode === 'add' && (
                <Field label="Password" required help="The student can change this later.">
                  <Input
                    type="text"
                    value={modal.form.password}
                    onChange={(e) => setForm({ password: e.target.value })}
                    required
                  />
                </Field>
              )}
              <Field label="Address" className="full">
                <Input
                  value={modal.form.address}
                  onChange={(e) => setForm({ address: e.target.value })}
                />
              </Field>
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

      <ConfirmDialog
        open={!!toDeactivate}
        onClose={() => setToDeactivate(null)}
        onConfirm={doDeactivate}
        title="Deactivate student"
        message={`Deactivate ${toDeactivate?.full_name}? They will not be able to log in, and their face data won't be recognized.`}
        confirmLabel="Deactivate"
        danger
        loading={busy}
      />
    </>
  )
}
