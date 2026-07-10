import { useEffect, useState } from 'react'
import api from '../api/client'
import TrendChart from './TrendChart'
import Spinner from './ui/Spinner'
import { Select } from './ui/Field'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
]

export default function AttendanceTrendCard({ title = 'Attendance trend' }) {
  const [range, setRange] = useState('week')
  const [data, setData] = useState(null)

  useEffect(() => {
    let active = true
    setData(null)
    api
      .get('/dashboard/attendance-trend', { params: { range } })
      .then((r) => active && setData(r.data))
      .catch(() => active && setData({ buckets: [], totals: { present: 0, late: 0, absent: 0 } }))
    return () => {
      active = false
    }
  }, [range])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <Select
          className="filter-select"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{ height: 32 }}
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="card-pad">
        {!data ? (
          <div style={{ height: 200, display: 'grid', placeItems: 'center' }}>
            <Spinner />
          </div>
        ) : (
          <>
            <TrendChart data={data.buckets} />
            <div className="trend-legend">
              <span className="lg">
                <span className="dot" style={{ background: 'var(--present)' }} />
                Present <b>{data.totals.present}</b>
              </span>
              <span className="lg">
                <span className="dot" style={{ background: 'var(--late)' }} />
                Late <b>{data.totals.late}</b>
              </span>
              <span className="lg">
                <span className="dot" style={{ background: 'var(--absent)' }} />
                Absent <b>{data.totals.absent}</b>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
