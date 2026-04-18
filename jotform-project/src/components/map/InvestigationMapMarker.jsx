import { divIcon } from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { MapMarkerPopup } from './MapMarkerPopup'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function createMarkerIcon(group) {
  return divIcon({
    className: '',
    html: `
      <div class="map-pin map-pin--${group.markerType} map-pin--${group.confidenceLevel}">
        <span class="map-pin__label">${escapeHtml(group.label)}</span>
      </div>
    `,
    iconAnchor: [18, 42],
    iconSize: [36, 42],
    popupAnchor: [0, -34],
  })
}

export function InvestigationMapMarker({ group }) {
  return (
    <Marker icon={createMarkerIcon(group)} position={[group.lat, group.lng]} title={group.location}>
      <Popup maxWidth={360} minWidth={280}>
        <MapMarkerPopup group={group} />
      </Popup>
    </Marker>
  )
}