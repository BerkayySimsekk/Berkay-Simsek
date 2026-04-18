import { useState } from 'react'
import { buildMapViewModel } from '../lib/mapView'
import { InvestigationMap } from './map/InvestigationMap'

const MAP_SOURCE_LABELS = {
  checkins: 'Check-ins',
  messages: 'Messages',
  notes: 'Notes',
  sightings: 'Sightings',
  tips: 'Tips',
}

export function MapViewPage({ model, onRetry, sourceErrors, sourceSummary, status }) {
  const [hasMapError, setHasMapError] = useState(false)
  const [isMapReady, setIsMapReady] = useState(false)

  const mapModel = model
    ? buildMapViewModel(model.records)
    : {
        invalidRecordCount: 0,
        locationCount: 0,
        mappedRecordCount: 0,
        markerGroups: [],
        sourceTypes: [],
      }

  return (
    <>
      <section className="panel panel-section map-page-hero">
        <p className="eyebrow">Bonus Map View</p>
        <h1>Investigation Map</h1>
        <p className="lede map-page-copy">
          Explore the case geographically through grouped markers for check-ins,
          sightings, messages, notes, and tips that include usable coordinates.
        </p>
      </section>

      {status === 'loading' && model ? (
        <div className="status-banner info-banner">Refreshing map records…</div>
      ) : null}

      {sourceErrors.length > 0 ? (
        <div className="status-banner warning-banner">
          <div>
            Loaded {sourceSummary.loaded} of {sourceSummary.total} sources. Missing:{' '}
            {sourceErrors.map((issue) => issue.sourceLabel).join(', ')}.
          </div>
          <button className="banner-button" onClick={onRetry} type="button">
            Retry failed sources
          </button>
        </div>
      ) : null}

      {hasMapError ? (
        <div className="status-banner error-banner">
          <div>
            The base map tiles could not be fully loaded. Marker data is still available,
            but the background map may be incomplete.
          </div>
        </div>
      ) : null}

      <div className="map-summary-grid">
        <article className="summary-card">
          <span className="summary-label">Mapped records</span>
          <strong>{mapModel.mappedRecordCount}</strong>
          <span className="summary-meta">Location-bearing records rendered as markers.</span>
        </article>

        <article className="summary-card accent-card">
          <span className="summary-label">Marker groups</span>
          <strong>{mapModel.markerGroups.length}</strong>
          <span className="summary-meta">Nearby events grouped to avoid overlapping pins.</span>
        </article>

        <article className="summary-card">
          <span className="summary-label">Distinct locations</span>
          <strong>{mapModel.locationCount}</strong>
          <span className="summary-meta">Unique places represented by the visible records.</span>
        </article>

        <article className="summary-card">
          <span className="summary-label">Excluded records</span>
          <strong>{mapModel.invalidRecordCount}</strong>
          <span className="summary-meta">Records skipped because coordinates were missing or invalid.</span>
        </article>
      </div>

      <section className="panel panel-section map-legend-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Marker Legend</h2>
            <p className="panel-subtitle">
              Marker color shows event type. The ring style reflects overall confidence.
            </p>
          </div>
        </div>

        <div className="map-legend-grid">
          {mapModel.sourceTypes.map((sourceId) => (
            <div className="map-legend-item" key={sourceId}>
              <span className={`map-legend-dot map-legend-dot--${sourceId}`}></span>
              <span>{MAP_SOURCE_LABELS[sourceId] || sourceId}</span>
            </div>
          ))}

          <div className="map-legend-item">
            <span className="map-legend-ring map-legend-ring--high"></span>
            <span>High confidence</span>
          </div>

          <div className="map-legend-item">
            <span className="map-legend-ring map-legend-ring--medium"></span>
            <span>Medium confidence</span>
          </div>

          <div className="map-legend-item">
            <span className="map-legend-ring map-legend-ring--low"></span>
            <span>Low confidence</span>
          </div>
        </div>
      </section>

      {mapModel.markerGroups.length === 0 ? (
        <div className="panel panel-section empty-state empty-layout">
          <span className="status-pill medium">No coordinate data</span>
          <h3 className="empty-title">No valid map markers could be created</h3>
          <p className="empty-copy">
            None of the currently loaded records contain usable coordinates, so the map
            cannot display pins yet.
          </p>
        </div>
      ) : (
        <section className="panel panel-section map-view-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Interactive Marker Map</h2>
              <p className="panel-subtitle">
                Click a marker to inspect the events grouped at that spot.
              </p>
            </div>
          </div>

          <div className="map-frame">
            {!isMapReady ? (
              <div className="map-loading-overlay">
                <span className="status-pill medium">Loading map</span>
                <p className="status-copy">Preparing the map surface and placing the markers.</p>
              </div>
            ) : null}

            <InvestigationMap
              markerGroups={mapModel.markerGroups}
              onMapReady={() => setIsMapReady(true)}
              onTileError={() => setHasMapError(true)}
            />
          </div>
        </section>
      )}
    </>
  )
}