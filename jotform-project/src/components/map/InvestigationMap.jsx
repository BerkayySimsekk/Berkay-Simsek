import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { InvestigationMapMarker } from './InvestigationMapMarker'

function FitMapToMarkers({ markerGroups }) {
  const map = useMap()

  useEffect(() => {
    if (markerGroups.length === 0) {
      return
    }

    if (markerGroups.length === 1) {
      map.setView([markerGroups[0].lat, markerGroups[0].lng], 14, {
        animate: true,
      })
      return
    }

    map.fitBounds(
      markerGroups.map((group) => [group.lat, group.lng]),
      {
        animate: true,
        maxZoom: 15,
        padding: [48, 48],
      },
    )
  }, [map, markerGroups])

  return null
}

export function InvestigationMap({ markerGroups, onMapReady, onTileError }) {
  return (
    <div className="investigation-map-shell">
      <MapContainer
        center={[39.92077, 32.85411]}
        className="investigation-map"
        scrollWheelZoom={true}
        whenReady={() => onMapReady?.()}
        zoom={13}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          eventHandlers={{
            tileerror: () => onTileError?.(),
          }}
          maxZoom={19}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitMapToMarkers markerGroups={markerGroups} />

        {markerGroups.map((group) => (
          <InvestigationMapMarker group={group} key={group.id} />
        ))}
      </MapContainer>
    </div>
  )
}