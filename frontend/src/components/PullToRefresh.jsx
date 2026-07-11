import { useEffect, useRef, useState } from 'react'

/*
 * Pull-down-to-refresh for touch devices (works in the standalone PWA where the
 * browser's native pull-to-refresh is unavailable). Pull from the top of the
 * page past the threshold and release to reload.
 */
const THRESHOLD = 70
const MAX = 110

export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startRef = useRef(null)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!isTouch) return

    const onStart = (e) => {
      startRef.current = window.scrollY <= 0 && !refreshingRef.current ? e.touches[0].clientY : null
    }
    const onMove = (e) => {
      if (startRef.current == null || refreshingRef.current) return
      const dy = e.touches[0].clientY - startRef.current
      if (dy > 0 && window.scrollY <= 0) {
        const damped = Math.min(dy * 0.5, MAX)
        pullRef.current = damped
        setPull(damped)
      } else {
        pullRef.current = 0
        setPull(0)
      }
    }
    const onEnd = () => {
      if (startRef.current == null) return
      startRef.current = null
      if (pullRef.current >= THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        window.setTimeout(() => window.location.reload(), 300)
      } else {
        pullRef.current = 0
        setPull(0)
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [])

  const visible = pull > 0 || refreshing
  const y = refreshing ? 64 : Math.max(0, pull) - 40
  const ready = pull >= THRESHOLD

  return (
    <div className={`ptr${visible ? ' visible' : ''}`} style={{ transform: `translate(-50%, ${y}px)` }}>
      {refreshing ? (
        <span className="ptr-spin" />
      ) : (
        <svg
          className="ptr-arrow"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: `rotate(${ready ? 180 : 0}deg)` }}
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      )}
    </div>
  )
}
