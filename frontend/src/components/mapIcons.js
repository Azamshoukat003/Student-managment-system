import L from 'leaflet'

// Session-location pin (blue teardrop; tip points at the radius center).
export const sessionPinIcon = L.divIcon({
  className: 'map-pin',
  html:
    '<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M15 1C7.8 1 2 6.8 2 14c0 9 13 23 13 23s13-14 13-23C28 6.8 22.2 1 15 1z" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>' +
    '<circle cx="15" cy="14" r="5" fill="#ffffff"/></svg>',
  iconSize: [30, 38],
  iconAnchor: [15, 37],
})

// "You are here" current-location dot.
export const userLocIcon = L.divIcon({
  className: 'user-loc',
  html: '<span class="user-loc-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})
