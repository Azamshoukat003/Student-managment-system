import { useEffect, useRef, useState } from 'react'
import { createFaceLandmarker, poseMetrics } from '../lib/faceLandmarker'
import Button from './ui/Button'
import Spinner from './ui/Spinner'
import { IconCamera, IconCheck, IconAlert } from './icons'

/*
 * Guided face capture. Registration walks center -> one side -> other side,
 * auto-capturing when each pose is held; marking captures a single centered frame.
 * A "Capture manually" button is always available as a fallback.
 *
 * Side detection is sign-based (first turn / opposite turn), so it never depends
 * on getting the mirrored left/right mapping right.
 */
const REGISTER_STEPS = ['center', 'side1', 'side2']
const MARK_STEPS = ['center']

const HOLD_MS = 500
const YAW_TURN = 0.13 // how far from center counts as "turned"

const RING = 132
const STROKE = 6
const R = RING / 2 - STROKE
const C = 2 * Math.PI * R

export default function GuidedCapture({ mode = 'mark', onComplete, busy = false }) {
  const steps = mode === 'register' ? REGISTER_STEPS : MARK_STEPS

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const landmarkerRef = useRef(null)
  const timerRef = useRef(null)
  const stepRef = useRef(0)
  const holdRef = useRef(0)
  const framesRef = useRef([])
  const firstSideRef = useRef(0)
  const lastTsRef = useRef(0)
  const doneRef = useRef(false)

  const [phase, setPhase] = useState('loading') // loading | ready | error | done
  const [errorMsg, setErrorMsg] = useState('')
  const [detectorOk, setDetectorOk] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [poseOk, setPoseOk] = useState(false)
  const [hint, setHint] = useState('Getting ready…')

  const grab = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  // Advance one step (used by both auto-capture and the manual button).
  const capture = (metrics) => {
    if (doneRef.current) return
    const frame = grab()
    if (frame) framesRef.current.push(frame)

    // remember which way the head turned first, so side2 must be the opposite way
    if (steps[stepRef.current] === 'side1' && metrics) {
      firstSideRef.current = Math.sign(metrics.yaw - 0.5) || 1
    }

    holdRef.current = 0
    const next = stepRef.current + 1
    if (next >= steps.length) {
      finish()
    } else {
      stepRef.current = next
      setStepIndex(next)
      setProgress(next / steps.length)
      setPoseOk(false)
    }
  }

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setProgress(1)
    setPhase('done')
    onComplete?.(framesRef.current.slice())
  }

  // Evaluate the current pose (returns { pass, hint }).
  const evaluate = (m) => {
    const key = steps[stepRef.current]
    if (!m.present) return { pass: false, hint: 'Center your face in the circle' }
    if (!m.bigEnough) return { pass: false, hint: 'Move a little closer' }
    if (key === 'center') {
      if (!m.framed) return { pass: false, hint: 'Center your face in the circle' }
      return { pass: m.centered, hint: m.centered ? 'Hold still…' : 'Look straight ahead' }
    }
    const dev = m.yaw - 0.5
    if (key === 'side1') {
      const pass = Math.abs(dev) > YAW_TURN
      return { pass, hint: pass ? 'Hold…' : 'Slowly turn your head to the side' }
    }
    // side2: must turn the opposite way from side1
    const pass = Math.abs(dev) > YAW_TURN && Math.sign(dev) === -firstSideRef.current
    return { pass, hint: pass ? 'Hold…' : 'Now turn your head the other way' }
  }

  const tick = () => {
    if (doneRef.current) return
    const v = videoRef.current
    const lm = landmarkerRef.current
    if (!lm || !v || v.readyState < 2 || v.videoWidth === 0) return
    let ts = performance.now()
    if (ts <= lastTsRef.current) ts = lastTsRef.current + 1
    lastTsRef.current = ts
    let m
    try {
      const res = lm.detectForVideo(v, ts)
      m = poseMetrics(res.faceLandmarks?.[0])
    } catch {
      return
    }
    const { pass, hint: h } = evaluate(m)
    setPoseOk(pass)
    setHint(h)
    if (pass) {
      holdRef.current = holdRef.current || ts
      const held = ts - holdRef.current
      setProgress((stepRef.current + Math.min(1, held / HOLD_MS)) / steps.length)
      if (held >= HOLD_MS) capture(m)
    } else {
      holdRef.current = 0
      setProgress(stepRef.current / steps.length)
    }
  }

  useEffect(() => {
    // Reset all refs on (re)mount. React StrictMode mounts→unmounts→remounts in
    // dev; the first cleanup sets doneRef=true, so without this the real instance
    // would have detection + capture disabled.
    doneRef.current = false
    stepRef.current = 0
    holdRef.current = 0
    framesRef.current = []
    firstSideRef.current = 0
    lastTsRef.current = 0
    setStepIndex(0)
    setProgress(0)
    setPoseOk(false)

    let cancelled = false
    ;(async () => {
      // 1) camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        const v = videoRef.current
        v.srcObject = stream
        await new Promise((res) => {
          if (v.readyState >= 2) return res()
          v.onloadeddata = () => res()
        })
        await v.play().catch(() => {})
      } catch (e) {
        if (cancelled) return
        setPhase('error')
        setErrorMsg(
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow access and reload.'
            : 'Could not access the camera.',
        )
        return
      }
      // 2) face detector (fallback to manual capture if it fails)
      try {
        landmarkerRef.current = await createFaceLandmarker()
      } catch (e) {
        console.error('FaceLandmarker load failed:', e)
        if (!cancelled) setDetectorOk(false)
      }
      if (cancelled) return
      setPhase('ready')
      setHint(detectorOkHint())
      timerRef.current = setInterval(tick, 120)
    })()

    return () => {
      cancelled = true
      doneRef.current = true
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      try {
        landmarkerRef.current?.close()
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const detectorOkHint = () =>
    landmarkerRef.current ? 'Center your face in the circle' : 'Tap "Capture manually" for each step'

  if (phase === 'error') {
    return (
      <div className="alert alert-error">
        <IconAlert size={16} />
        <span>{errorMsg}</span>
      </div>
    )
  }

  const dash = C * (1 - progress)
  const stepLabels = { center: 'Look ahead', side1: 'Turn to a side', side2: 'Turn the other way' }

  return (
    <div className="guide">
      <div className={`guide-frame${poseOk ? ' pose-ok' : ''}`}>
        <video ref={videoRef} autoPlay playsInline muted className="guide-video" />
        <svg className="guide-ring" viewBox={`0 0 ${RING} ${RING}`} width={RING} height={RING}>
          <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke="var(--present)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={dash}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>
        {phase === 'loading' && (
          <div className="guide-overlay">
            <Spinner />
          </div>
        )}
        {phase === 'done' && (
          <div className="guide-overlay done">
            <IconCheck size={34} />
          </div>
        )}
      </div>

      {phase !== 'done' && (
        <div className="guide-info">
          <div className={`guide-prompt${poseOk ? ' ok' : ''}`}>
            {poseOk ? <IconCheck size={16} /> : null}
            {phase === 'loading' ? 'Getting ready…' : hint}
          </div>

          {mode === 'register' && (
            <div className="guide-steps">
              {steps.map((s, i) => (
                <span
                  key={s}
                  className={`guide-dot${i < stepIndex ? ' done' : i === stepIndex ? ' active' : ''}`}
                  title={stepLabels[s]}
                />
              ))}
            </div>
          )}

          {mode === 'register' && (
            <div className="text-xs muted">
              Step {Math.min(stepIndex + 1, steps.length)} of {steps.length} · {stepLabels[steps[stepIndex]]}
            </div>
          )}

          {!detectorOk && (
            <div className="field-help">Auto-detection unavailable — use manual capture.</div>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={<IconCamera size={15} />}
            onClick={() => capture(null)}
            disabled={phase !== 'ready' || busy}
          >
            Capture manually
          </Button>
        </div>
      )}
    </div>
  )
}
