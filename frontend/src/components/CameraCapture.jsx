import { useEffect, useRef, useState } from 'react'
import Button from './ui/Button'
import { IconCamera, IconAlert } from './icons'

/*
 * Live webcam preview with a capture button. Each capture returns a JPEG
 * data URL via onCapture. Manages the media stream lifecycle itself.
 */
export default function CameraCapture({ onCapture, captureLabel = 'Capture', busy = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setReady(true)
      })
      .catch((e) => {
        const msg =
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access and reload.'
            : e?.name === 'NotFoundError'
              ? 'No camera found on this device.'
              : 'Could not access the camera.'
        setError(msg)
      })

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    onCapture(canvas.toDataURL('image/jpeg', 0.9))
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <IconAlert size={16} />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="camera">
      <div className="camera-frame">
        {!ready && (
          <div className="camera-placeholder">
            <IconCamera size={28} />
            <span>Starting camera…</span>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          style={{ display: ready ? 'block' : 'none' }}
        />
      </div>
      <Button icon={<IconCamera size={16} />} onClick={capture} disabled={!ready || busy} loading={busy}>
        {captureLabel}
      </Button>
    </div>
  )
}
