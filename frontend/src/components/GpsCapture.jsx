import { useState } from 'react'
import { getCurrentPosition } from '../lib/geo'
import Button from './ui/Button'
import { IconPin, IconCheck, IconAlert } from './icons'

/*
 * Captures the browser location and reports {latitude, longitude, accuracy}
 * to the parent via onCapture. Shows accuracy inline.
 */
export default function GpsCapture({ coords, onCapture, disabled }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const capture = async () => {
    setLoading(true)
    setError('')
    try {
      const pos = await getCurrentPosition()
      onCapture(pos)
    } catch (err) {
      setError(err.message)
      onCapture(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 'var(--sp-2)' }}>
      <Button
        type="button"
        variant="secondary"
        icon={<IconPin size={16} />}
        onClick={capture}
        loading={loading}
        disabled={disabled}
      >
        {coords ? 'Update my location' : 'Get my location'}
      </Button>
      {coords && (
        <div className="row text-sm" style={{ color: 'var(--present)' }}>
          <IconCheck size={15} />
          <span className="tabular">
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} (±{Math.round(coords.accuracy)}m)
          </span>
        </div>
      )}
      {error && (
        <div className="row text-sm" style={{ color: 'var(--destructive)' }}>
          <IconAlert size={15} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
