import { useState } from 'react'
import { buildPodoRouteTimeline, filterRouteEvents } from '../lib/routeTimeline'

function RouteEventDetails({ event }) {
  return (
    <div className="detail-layout">
      <div className="detail-header-row">
        <div>
          <h3 className="detail-title">{event.location}</h3>
          <p className="detail-copy">
            {event.timeLabel} · {event.eventTypeLabel}
          </p>
        </div>
        <span className={`score-pill ${event.confidenceLevel}`}>{event.confidenceLabel}</span>
      </div>

      <p className="detail-body">{event.summary}</p>

      <section className="detail-section">
        <h3 className="detail-section-title">Why this stop appears in the route</h3>
        <ol className="reason-list">
          {event.reliabilityReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ol>
      </section>

      {event.uncertaintyFlags.length > 0 ? (
        <section className="detail-section">
          <h3 className="detail-section-title">Uncertainty notes</h3>
          <ul className="route-uncertainty-list">
            {event.uncertaintyFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="detail-section">
        <h3 className="detail-section-title">People involved</h3>
        <div className="alias-row">
          {event.people.map((person) => (
            <span className="detail-pill" key={`${event.id}-${person.key}`}>
              {person.label}
            </span>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">Supporting sources</h3>
        <div className="alias-row">
          {event.sources.map((source) => (
            <span className={`source-pill ${source.id}`} key={`${event.id}-${source.id}`}>
              {source.label}
            </span>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">Evidence behind this stop</h3>
        <div className="route-evidence-list">
          {event.supportingRecords.map((record) => (
            <article className="route-evidence-item" key={record.id}>
              <div className="route-evidence-head">
                <div>
                  <div className="detail-list-title">{record.title}</div>
                  <div className="detail-list-meta">
                    {record.timestampLabel} · {record.location}
                  </div>
                </div>
                <span className={`source-pill ${record.sourceId}`}>{record.sourceLabel}</span>
              </div>

              <p className="card-copy">
                {record.content || 'This record contributes structure more than narrative detail.'}
              </p>

              <div className="route-evidence-meta-row">
                <span className="detail-pill">{record.routeRoleLabel}</span>
                <span className={`status-pill ${record.reliabilityTone}`}>{record.reliabilityLabel}</span>
                <span className="detail-pill">{record.directnessLabel}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export function RouteTimelinePanel({ model }) {
  const [personFilter, setPersonFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [confidenceFilter, setConfidenceFilter] = useState('all')
  const [selectedEventId, setSelectedEventId] = useState(null)

  const timeline = model
    ? buildPodoRouteTimeline(model.records)
    : {
        events: [],
        filterOptions: {
          confidenceLevels: [],
          locations: [],
          people: [],
          sources: [],
        },
        summary: {
          evidenceCount: 0,
          firstSeen: 'Unknown',
          lastSeen: 'Unknown',
          stopCount: 0,
        },
      }

  const filteredEvents = filterRouteEvents(timeline.events, {
    confidence: confidenceFilter,
    location: locationFilter,
    person: personFilter,
    source: sourceFilter,
  })
  const filteredIds = new Set(filteredEvents.map((event) => event.id))
  const hasActiveFilters =
    personFilter !== 'all' ||
    locationFilter !== 'all' ||
    sourceFilter !== 'all' ||
    confidenceFilter !== 'all'
  const activeEvent =
    filteredIds.has(selectedEventId) && filteredEvents.some((event) => event.id === selectedEventId)
      ? filteredEvents.find((event) => event.id === selectedEventId)
      : filteredEvents[0] || null

  const resetFilters = () => {
    setPersonFilter('all')
    setLocationFilter('all')
    setSourceFilter('all')
    setConfidenceFilter('all')
  }

  return (
    <section className="panel panel-section route-flow-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Interactive Route Timeline</h2>
          <p className="panel-subtitle">
            A dedicated time-based reconstruction of Podo&apos;s route, grouped into
            corroborated stops with uncertainty kept visible.
          </p>
        </div>
        <span className="panel-subtitle">{timeline.summary.stopCount} route stops</span>
      </div>

      <div className="route-summary-grid">
        <article className="summary-card">
          <span className="summary-label">First route clue</span>
          <strong>{timeline.summary.firstSeen}</strong>
          <span className="summary-meta">Earliest event that places or describes Podo.</span>
        </article>

        <article className="summary-card accent-card">
          <span className="summary-label">Last route clue</span>
          <strong>{timeline.summary.lastSeen}</strong>
          <span className="summary-meta">Latest route stop before the trail becomes uncertain.</span>
        </article>

        <article className="summary-card">
          <span className="summary-label">Evidence used</span>
          <strong>{timeline.summary.evidenceCount}</strong>
          <span className="summary-meta">Records folded into the grouped route timeline.</span>
        </article>
      </div>

      <div className="route-filter-grid">
        <label className="field-group">
          <span className="field-label">Person</span>
          <select
            className="select-input"
            onChange={(event) => setPersonFilter(event.target.value)}
            value={personFilter}
          >
            <option value="all">All people in the route</option>
            {timeline.filterOptions.people.map((person) => (
              <option key={person.key} value={person.key}>
                {person.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span className="field-label">Location</span>
          <select
            className="select-input"
            onChange={(event) => setLocationFilter(event.target.value)}
            value={locationFilter}
          >
            <option value="all">All route locations</option>
            {timeline.filterOptions.locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span className="field-label">Source</span>
          <select
            className="select-input"
            onChange={(event) => setSourceFilter(event.target.value)}
            value={sourceFilter}
          >
            <option value="all">All source types</option>
            {timeline.filterOptions.sources.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span className="field-label">Reliability</span>
          <select
            className="select-input"
            onChange={(event) => setConfidenceFilter(event.target.value)}
            value={confidenceFilter}
          >
            {timeline.filterOptions.confidenceLevels.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {hasActiveFilters ? (
          <button className="ghost-button route-reset-button" onClick={resetFilters} type="button">
            Reset route filters
          </button>
        ) : null}
      </div>

      {timeline.events.length < 2 ? (
        <div className="empty-state empty-layout">
          <span className="status-pill medium">Insufficient route data</span>
          <h3 className="empty-title">Too few events to reconstruct a route</h3>
          <p className="empty-copy">
            The current dataset does not contain enough movement evidence to build a
            meaningful route flow for Podo.
          </p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="empty-state empty-layout">
          <span className="status-pill medium">No matching route stops</span>
          <h3 className="empty-title">The current route filters hide every stop</h3>
          <p className="empty-copy">
            Try widening the person, location, source, or reliability filters to restore
            the full route story.
          </p>
        </div>
      ) : (
        <div className="route-flow-layout">
          <div className="route-flow-list">
            {filteredEvents.map((event, index) => (
              <button
                className={`route-stop-card ${activeEvent?.id === event.id ? 'is-selected' : ''}`}
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                type="button"
              >
                <span className="route-step-index">{index + 1}</span>

                <div className="route-stop-copy">
                  <div className="route-stop-head">
                    <div>
                      <p className="route-stop-time">{event.timeLabel}</p>
                      <h3 className="route-stop-location">{event.location}</h3>
                      <p className="route-stop-type">{event.eventTypeLabel}</p>
                    </div>

                    <div className="route-badge-row">
                      <span className={`score-pill ${event.confidenceLevel}`}>
                        {event.confidenceLabel}
                      </span>
                      {event.uncertaintyFlags.length > 0 ? (
                        <span className="status-pill medium">Uncertain</span>
                      ) : null}
                    </div>
                  </div>

                  <p className="card-copy">{event.summary}</p>

                  <div className="route-chip-row">
                    {event.people.map((person) => (
                      <span className="detail-pill" key={`${event.id}-${person.key}`}>
                        {person.label}
                      </span>
                    ))}
                  </div>

                  <div className="timeline-meta">
                    {event.sources.map((source) => (
                      <span className={`source-pill ${source.id}`} key={`${event.id}-${source.id}`}>
                        {source.label}
                      </span>
                    ))}
                    <span className="detail-pill">{event.evidenceCount} supporting records</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <aside className="route-detail-surface">
            {activeEvent ? <RouteEventDetails event={activeEvent} /> : null}
          </aside>
        </div>
      )}
    </section>
  )
}