/* Promise wrapper around the browser Geolocation API, hardened for mobile.
 *
 * Mobile browsers (esp. iOS Safari) can hang on high-accuracy GPS indoors and
 * sometimes never fire a callback. So we: try high-accuracy first, fall back to
 * low-accuracy on failure, and guard the whole thing with a hard timeout so the
 * UI never spins forever. */
function mapError(err) {
  const messages = {
    1: 'Location permission denied. Allow location for this site (in the address-bar icon or your browser/OS settings) and try again.',
    2: 'Your location is currently unavailable. Move to an open area (near a window / outside) and try again.',
    3: 'Getting your location timed out. Try again.',
  }
  return new Error(messages[err?.code] || 'Could not get your location. Please try again.')
}

function readPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      reject,
      options,
    )
  })
}

export function getCurrentPosition() {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('Geolocation is not supported by this browser'))
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const done = (fn, arg) => {
      if (settled) return
      settled = true
      clearTimeout(safety)
      fn(arg)
    }

    // Absolute safety net in case no callback ever fires (seen on iOS Safari).
    const safety = setTimeout(
      () => done(reject, new Error('Getting your location took too long. Move to an open area and try again.')),
      22000,
    )

    // 1) high accuracy (GPS), allow a slightly stale fix to speed things up
    readPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
      .then((p) => done(resolve, p))
      .catch(() => {
        // 2) fall back to low accuracy (wifi/cell) — much faster, rarely hangs
        readPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
          .then((p) => done(resolve, p))
          .catch((err) => done(reject, mapError(err)))
      })
  })
}
