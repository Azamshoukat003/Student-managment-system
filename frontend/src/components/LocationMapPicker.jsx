import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { IconLocate } from './icons'
import { sessionPinIcon as pinIcon, userLocIcon as userIcon } from './mapIcons'
import { getCurrentPosition } from '../lib/geo'

// Default view: The Islamia University of Bahawalpur (approx).
export const DEFAULT_CENTER = { lat: 29.3872, lng: 71.7625 }

function ClickCapture({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Controller({ lat, lng, recenterSignal, userPos, onAdopt, interactedRef }) {
  const map = useMap()
  const adoptedRef = useRef(false)

  // Fix sizing when mounted inside a modal.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 60)
    return () => clearTimeout(t)
  }, [map])

  // Fly to the pin when explicitly requested (parent "Use my location").
  useEffect(() => {
    if (recenterSignal && Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal])

  // When we learn the user's location, fly to it; adopt it as the pin the first
  // time (unless the teacher has already placed the pin manually).
  useEffect(() => {
    if (!userPos) return
    map.flyTo([userPos.lat, userPos.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
    if (!adoptedRef.current && !interactedRef.current) {
      adoptedRef.current = true
      onAdopt?.({ lat: userPos.lat, lng: userPos.lng })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos])

  return null
}

function LocateButton({ onClick }) {
  return (
    <div className="leaflet-bottom leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <button type="button" className="map-locate-btn" title="Show my location" onClick={onClick}>
          <IconLocate size={16} />
        </button>
      </div>
    </div>
  )
}

/*
 * Interactive location picker on OpenStreetMap (Leaflet). Click the map or drag
 * the pin to set the session point; a circle shows the allowed radius. A separate
 * blue dot shows the user's current location. onChange gets { lat, lng }.
 */
export default function LocationMapPicker({ lat, lng, radius = 100, onChange, recenterSignal }) {
  const valid = Number.isFinite(lat) && Number.isFinite(lng)
  const center = valid ? [lat, lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]

  const [userPos, setUserPos] = useState(null)
  const interactedRef = useRef(false)
  const mapRef = useRef(null)
  const aliveRef = useRef(true)

  const emitUserChange = (la, ln) => {
    interactedRef.current = true
    onChange?.({ lat: la, lng: ln })
  }

  const locate = () => {
    getCurrentPosition()
      .then((p) => {
        if (aliveRef.current) setUserPos({ lat: p.latitude, lng: p.longitude, accuracy: p.accuracy })
      })
      .catch(() => {})
  }

  // Get the current location once on mount; tear the map down fully on unmount
  // so no orphan/floating Leaflet map is left after the modal closes.
  useEffect(() => {
    aliveRef.current = true
    locate()
    return () => {
      aliveRef.current = false
      try {
        mapRef.current?.remove()
      } catch {
        /* already removed by react-leaflet */
      }
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="map-box">
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={16}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ClickCapture onPick={emitUserChange} />
        <Controller
          lat={lat}
          lng={lng}
          recenterSignal={recenterSignal}
          userPos={userPos}
          onAdopt={onChange}
          interactedRef={interactedRef}
        />
        <LocateButton onClick={locate} />

        {/* current-location dot */}
        {userPos && (
          <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} interactive={false} />
        )}

        {/* session pin + allowed radius */}
        {valid && (
          <>
            <Circle
              center={center}
              radius={radius}
              pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12, weight: 1.5 }}
            />
            <Marker
              position={center}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend(e) {
                  const p = e.target.getLatLng()
                  emitUserChange(p.lat, p.lng)
                },
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  )
}
