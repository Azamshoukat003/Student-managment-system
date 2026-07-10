/* Promise wrapper around the browser Geolocation API. */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const messages = {
          1: 'Location permission denied. Please allow location access and try again.',
          2: 'Your location is currently unavailable. Try again in a moment.',
          3: 'Getting your location timed out. Try again.',
        }
        reject(new Error(messages[err.code] || 'Could not get your location'))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options },
    )
  })
}
