import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconClock } from '../icons'

/* "HH:MM" (24h) <-> { h: 1-12, m: 0-59, ap: 'AM'|'PM' } */
function parse(v) {
  if (!v) return null
  const [H, M] = v.split(':').map(Number)
  if (Number.isNaN(H) || Number.isNaN(M)) return null
  return { h: ((H + 11) % 12) + 1, m: M, ap: H < 12 ? 'AM' : 'PM' }
}
function toValue({ h, m, ap }) {
  let H = h % 12
  if (ap === 'PM') H += 12
  return `${String(H).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function format(v) {
  const d = parse(v)
  return d ? `${d.h}:${String(d.m).padStart(2, '0')} ${d.ap}` : null
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

/*
 * Custom time picker with hour / minute / AM-PM columns (any minute, like a
 * native picker) in a themed portal popover. Value is "HH:MM" (24h).
 */
export default function TimePicker({
  value,
  onChange,
  placeholder = 'Select time',
  className = '',
  disabled = false,
  'aria-label': ariaLabel,
}) {
  const draft = parse(value)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const popRef = useRef(null)
  const hourColRef = useRef(null)
  const minColRef = useRef(null)

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const h = popRef.current?.offsetHeight ?? 0
    const w = popRef.current?.offsetWidth ?? 220
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = h > 0 && spaceBelow < h + 8 && r.top > spaceBelow
    let left = r.left
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8)
    setPos({
      left,
      top: openUp ? undefined : r.bottom + 6,
      bottom: openUp ? window.innerHeight - r.top + 6 : undefined,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    // center the selected hour/minute in their columns
    hourColRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'center' })
    minColRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'center' })
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onScroll = () => place()
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, place])

  const update = (part, v) => {
    const base = draft || { h: 12, m: 0, ap: 'AM' }
    onChange?.(toValue({ ...base, [part]: v }))
  }

  const label = format(value)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`input datepicker-trigger ${className}`}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <IconClock size={16} className="datepicker-ic" />
        <span className={`datepicker-value${label ? '' : ' placeholder'}`}>{label || placeholder}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="timepicker-pop"
            style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top, bottom: pos?.bottom }}
          >
            <div className="tp-cols">
              <div className="tp-col" ref={hourColRef} role="listbox" aria-label="Hour">
                <div className="tp-col-head">Hr</div>
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`tp-item${draft?.h === h ? ' sel' : ''}`}
                    onClick={() => update('h', h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <div className="tp-col" ref={minColRef} role="listbox" aria-label="Minute">
                <div className="tp-col-head">Min</div>
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`tp-item${draft?.m === m ? ' sel' : ''}`}
                    onClick={() => update('m', m)}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
              <div className="tp-col tp-col-ap" role="listbox" aria-label="AM/PM">
                <div className="tp-col-head">&nbsp;</div>
                {['AM', 'PM'].map((ap) => (
                  <button
                    key={ap}
                    type="button"
                    className={`tp-item${draft?.ap === ap ? ' sel' : ''}`}
                    onClick={() => update('ap', ap)}
                  >
                    {ap}
                  </button>
                ))}
              </div>
            </div>
            <div className="tp-foot">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
