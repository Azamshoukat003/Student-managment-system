import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX } from '../icons'

/* Parse 'YYYY-MM-DD' to a local Date (no timezone shift). */
function parse(str) {
  if (!str) return undefined
  const [y, m, d] = str.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}
/* Local Date -> 'YYYY-MM-DD'. */
function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function format(date) {
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

/*
 * Date picker matching the app UI: an input-styled trigger that opens a
 * react-day-picker calendar in a portal popover. onChange receives the
 * 'YYYY-MM-DD' string (or '' when cleared).
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  disabled = false,
  clearable = true,
  min, // 'YYYY-MM-DD' — days before this are disabled
  guard, // () => string | null : if it returns a reason, opening is blocked
  onGuard, // (reason) => void : called when a blocked open is attempted
  'aria-label': ariaLabel,
}) {
  const selected = parse(value)
  const minDate = parse(min)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const popRef = useRef(null)

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const h = popRef.current?.offsetHeight ?? 0
    const w = popRef.current?.offsetWidth ?? 300
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
    if (open) place()
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

  const pick = (date) => {
    if (!date) return
    onChange?.(toISO(date))
    setOpen(false)
    triggerRef.current?.focus()
  }

  const clear = (e) => {
    e.stopPropagation()
    onChange?.('')
  }

  const toggle = () => {
    if (disabled) return
    if (open) {
      setOpen(false)
      return
    }
    if (guard) {
      const reason = guard()
      if (reason) {
        onGuard?.(reason)
        return
      }
    }
    setOpen(true)
  }

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
        onClick={toggle}
      >
        <IconCalendar size={16} className="datepicker-ic" />
        <span className={`datepicker-value${selected ? '' : ' placeholder'}`}>
          {selected ? format(selected) : placeholder}
        </span>
        {clearable && selected && !disabled && (
          <span className="datepicker-clear" onMouseDown={clear} role="button" aria-label="Clear date">
            <IconX size={14} />
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="datepicker-pop"
            style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top, bottom: pos?.bottom }}
          >
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected || minDate}
              disabled={minDate ? { before: minDate } : undefined}
              onSelect={pick}
              showOutsideDays
              components={{
                Chevron: ({ orientation }) =>
                  orientation === 'left' ? <IconChevronLeft size={16} /> : <IconChevronRight size={16} />,
              }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
