import { useCallback, useEffect, useState } from 'react'
import api, { apiError, downloadFile } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Select } from '../components/ui/Field'
import DatePicker from '../components/ui/DatePicker'
import { IconReport, IconCheck, IconX, IconPlus } from '../components/icons'
import ManualMarkModal from './ManualMarkModal'

const STATUS_TONE = { present: 'present', late: 'late', absent: 'absent', pending: 'pending', rejected: 'absent' }
const APPROVAL_TONE = { approved: 'active', pending: 'pending', rejected: 'inactive' }

export default function AttendanceRecords() {
  const { user } = useAuth()
  const toast = useToast()
  const isStaff = user.role === 'admin' || user.role === 'teacher'

  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [filters, setFilters] = useState({ date_from: '', date_to: '', status: '', class_id: '' })
  const [manualOpen, setManualOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (isStaff) api.get('/classes').then((r) => setClasses(r.data)).catch(() => {})
  }, [isStaff])

  const params = () => {
    const p = {}
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = v
    })
    return p
  }

  const load = useCallback(() => {
    setRows(null)
    api
      .get('/attendance-records', { params: params() })
      .then((r) => setRows(r.data))
      .catch((e) => {
        toast.error(apiError(e))
        setRows([])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = async () => {
    try {
      await downloadFile('/reports/attendance/export', params(), 'attendance_report.csv')
    } catch (e) {
      toast.error(apiError(e))
    }
  }

  const review = async (id, action) => {
    setBusyId(id)
    try {
      await api.put(`/attendance-records/${id}/${action}`, {})
      toast.success(action === 'approve' ? 'Approved' : 'Rejected')
      load()
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setBusyId(null)
    }
  }

  const setF = (patch) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{user.role === 'student' ? 'My Attendance' : 'Attendance Records'}</h1>
          <p className="page-subtitle">
            {user.role === 'student' ? 'Your attendance history.' : 'View, review and export attendance.'}
          </p>
        </div>
        {isStaff && (
          <div className="row">
            <Button variant="secondary" icon={<IconReport size={16} />} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button icon={<IconPlus size={16} />} onClick={() => setManualOpen(true)}>
              Manual mark
            </Button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <DatePicker
          className="filter-select"
          value={filters.date_from}
          onChange={(v) =>
            setFilters((f) => ({
              ...f,
              date_from: v,
              // if the existing "to" is now before "from", clear it
              date_to: f.date_to && v && f.date_to < v ? '' : f.date_to,
            }))
          }
          placeholder="From date"
          aria-label="From date"
        />
        <DatePicker
          className="filter-select"
          value={filters.date_to}
          onChange={(v) => setF({ date_to: v })}
          placeholder="To date"
          aria-label="To date"
          min={filters.date_from}
          guard={() => (!filters.date_from ? 'Select the "From" date first' : null)}
          onGuard={(msg) => toast.error(msg)}
        />
        <Select className="filter-select" value={filters.status} onChange={(e) => setF({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="absent">Absent</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </Select>
        {isStaff && (
          <Select className="filter-select" value={filters.class_id} onChange={(e) => setF({ class_id: e.target.value })}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {(filters.date_from || filters.date_to || filters.status || filters.class_id) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ date_from: '', date_to: '', status: '', class_id: '' })}>
            Clear
          </Button>
        )}
      </div>

      {rows === null ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : !rows.length ? (
        <div className="card">
          <EmptyState icon={IconReport} title="No records found" message="Try adjusting the filters." />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                {user.role !== 'student' && <th>Student</th>}
                <th>Class · Subject</th>
                <th>Status</th>
                <th>Method</th>
                <th>Approval</th>
                {isStaff && <th className="col-actions">Review</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap tabular">{r.session_date}</td>
                  {user.role !== 'student' && (
                    <td>
                      <div className="cell-strong">{r.student_name}</div>
                      {r.registration_number && <div className="text-xs muted mono">{r.registration_number}</div>}
                    </td>
                  )}
                  <td>
                    <div>{r.class_name}</div>
                    <div className="text-xs muted">{r.subject_name}</div>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</Badge>
                  </td>
                  <td>
                    <Badge tone="neutral" plain>
                      {r.method}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={APPROVAL_TONE[r.approval_status] || 'neutral'}>{r.approval_status}</Badge>
                  </td>
                  {isStaff && (
                    <td className="col-actions">
                      {r.approval_status === 'pending' ? (
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          <Button variant="ghost" size="sm" icon={<IconCheck size={16} />} onClick={() => review(r.id, 'approve')} loading={busyId === r.id} aria-label="Approve" />
                          <Button variant="ghost" size="sm" icon={<IconX size={16} />} onClick={() => review(r.id, 'reject')} loading={busyId === r.id} aria-label="Reject" />
                        </div>
                      ) : (
                        <span className="muted text-xs">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ManualMarkModal open={manualOpen} onClose={() => setManualOpen(false)} onDone={load} />
    </>
  )
}
