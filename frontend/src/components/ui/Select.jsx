import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { IconChevronDown, IconCheck } from '../icons'

/*
 * Custom dropdown that is a drop-in replacement for a native <select>:
 * accepts <option> children (or an `options` array), a `value`, and an
 * `onChange` that receives { target: { value } } — existing handlers keep working.
 *
 * The menu renders in a portal (never clipped inside modals), supports full
 * keyboard navigation, scrolls to the selected item, and animates from the trigger.
 */
export default function Select({
  value,
  onChange,
  children,
  options: optionsProp,
  icon,
  placeholder,
  disabled = false,
  invalid = false,
  className = '',
  style,
  required, // accepted for API parity; validation handled by callers
  ...rest
}) {
  const options = useMemo(() => {
    if (optionsProp) {
      return optionsProp.map((o) => ({ value: o.value ?? '', label: o.label, disabled: !!o.disabled }))
    }
    const out = []
    Children.toArray(children).forEach((c) => {
      if (isValidElement(c) && c.type === 'option') {
        out.push({ value: c.props.value ?? '', label: c.props.children, disabled: !!c.props.disabled })
      }
    })
    return out
  }, [optionsProp, children])

  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const val = value ?? ''
  const selectedIndex = options.findIndex((o) => String(o.value) === String(val))
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null
  const display = selected ? selected.label : placeholder ?? options[0]?.label ?? ''

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const menuH = menuRef.current?.offsetHeight ?? 0
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = menuH > 0 && spaceBelow < menuH + 8 && r.top > spaceBelow
    let width = r.width
    const menuW = menuRef.current?.offsetWidth ?? 0
    if (menuW > width) width = menuW
    let left = r.left
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
    setPos({
      left,
      width: Math.max(r.width, 0),
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    // scroll the highlighted/selected option into view
    const idx = highlight >= 0 ? highlight : selectedIndex
    if (idx >= 0) {
      menuRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onScroll = () => place()
    const onDocDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('mousedown', onDocDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('mousedown', onDocDown)
    }
  }, [open, place])

  const openMenu = () => {
    if (disabled) return
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const choose = (opt) => {
    if (!opt || opt.disabled) return
    onChange?.({ target: { value: String(opt.value) } })
    setOpen(false)
    triggerRef.current?.focus()
  }

  const move = (dir) => {
    if (!options.length) return
    let i = highlight
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length
      if (!options[i].disabled) break
    }
    setHighlight(i)
    menuRef.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  const onKey = (e) => {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (highlight >= 0) choose(options[highlight])
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`select cselect-trigger${invalid ? ' invalid' : ''} ${className}`}
        style={style}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKey}
        {...rest}
      >
        {icon && <span className="cselect-ic">{icon}</span>}
        <span className={`cselect-value${selected ? '' : ' placeholder'}`}>{display}</span>
        <IconChevronDown size={16} className={`cselect-chevron${open ? ' open' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="cselect-menu"
            role="listbox"
            style={{
              position: 'fixed',
              left: pos?.left ?? -9999,
              top: pos?.top,
              bottom: pos?.bottom,
              minWidth: pos?.width,
            }}
          >
            {options.map((o, i) => {
              const isSel = String(o.value) === String(val)
              return (
                <div
                  key={i}
                  data-i={i}
                  role="option"
                  aria-selected={isSel}
                  className={`cselect-option${i === highlight ? ' hl' : ''}${o.disabled ? ' disabled' : ''}${isSel ? ' selected' : ''}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(o)
                  }}
                >
                  <span className="cselect-option-label">{o.label}</span>
                  {isSel && <IconCheck size={15} />}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
