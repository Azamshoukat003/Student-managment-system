import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const LOCAL_WASM = '/mediapipe/wasm'
const LOCAL_MODEL = '/models/face_landmarker.task'
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

async function build(wasmBase, modelPath) {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase)
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
  })
}

/* Try self-hosted assets first; fall back to CDN so auto-capture still works. */
export async function createFaceLandmarker() {
  try {
    return await build(LOCAL_WASM, LOCAL_MODEL)
  } catch (e) {
    console.warn('Local FaceLandmarker assets failed, trying CDN…', e)
    return build(CDN_WASM, CDN_MODEL)
  }
}

/*
 * Derive simple head-pose metrics from FaceMesh landmarks (normalized 0..1).
 * yaw ~0.5 = facing camera; away from 0.5 = head turned to a side.
 */
export function poseMetrics(landmarks) {
  if (!landmarks || !landmarks.length) return { present: false }
  const nose = landmarks[1]
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]
  const chin = landmarks[152]
  const forehead = landmarks[10]
  if (!nose || !leftCheek || !rightCheek) return { present: false }

  const faceWidth = Math.abs(leftCheek.x - rightCheek.x)
  const yaw = faceWidth > 0 ? (nose.x - rightCheek.x) / (leftCheek.x - rightCheek.x) : 0.5

  const cx = (leftCheek.x + rightCheek.x) / 2
  const cy = chin && forehead ? (chin.y + forehead.y) / 2 : nose.y
  const bigEnough = faceWidth > 0.14
  const framed = cx > 0.28 && cx < 0.72 && cy > 0.2 && cy < 0.85
  const centered = Math.abs(yaw - 0.5) < 0.12

  return { present: true, yaw, faceWidth, bigEnough, framed, centered }
}
