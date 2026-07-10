import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { sessionPinIcon, userLocIcon } from './mapIcons'

function FitBounds({ sessionLat, sessionLng, radius, userLat, userLng }) {
  const map = useMap()
  useEffect(() => {
    if (!Number.isFinite(sessionLat) || !Number.isFinite(sessionLng)) return
    // toBounds() computes a box of the given size WITHOUT needing the circle
    // to be attached to a map (unlike L.circle().getBounds()).
    let bounds = L.latLng(sessionLat, sessionLng).toBounds(Math.max(radius, 20) * 2)
    if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
      bounds = bounds.extend([userLat, userLng])
    }
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18 })
    const t = setTimeout(() => map.invalidateSize(), 60)
    return () => clearTimeout(t)
  }, [map, sessionLat, sessionLng, radius, userLat, userLng])
  return null
}

/*
 * Read-only map for students: shows the session's allowed area (pin + radius
 * circle) and, once captured, the student's current location.
 */
export default function LocationMapView({ sessionLat, sessionLng, radius = 100, userLat, userLng }) {
  const valid = Number.isFinite(sessionLat) && Number.isFinite(sessionLng)
  const mapRef = useRef(null)

  // Tear the map down fully on unmount so no orphan Leaflet map is left behind.
  useEffect(() => {
    return () => {
      try {
        mapRef.current?.remove()
      } catch {
        /* already removed */
      }
      mapRef.current = null
    }
  }, [])

  if (!valid) return null

  return (
    <div className="map-box map-box-sm">
      <MapContainer ref={mapRef} center={[sessionLat, sessionLng]} zoom={16} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds
          sessionLat={sessionLat}
          sessionLng={sessionLng}
          radius={radius}
          userLat={userLat}
          userLng={userLng}
        />
        <Circle
          center={[sessionLat, sessionLng]}
          radius={radius}
          pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12, weight: 1.5 }}
        />
        <Marker position={[sessionLat, sessionLng]} icon={sessionPinIcon} interactive={false} />
        {Number.isFinite(userLat) && Number.isFinite(userLng) && (
          <Marker position={[userLat, userLng]} icon={userLocIcon} interactive={false} />
        )}
      </MapContainer>
    </div>
  )
}
