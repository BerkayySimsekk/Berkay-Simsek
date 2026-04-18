export function MapMarkerPopup({ group }) {
  return (
    <div className="map-popup-content">
      <div className="map-popup-header">
        <div>
          <h3 className="map-popup-title">{group.location}</h3>
          <p className="map-popup-subtitle">
            {group.eventCount} event{group.eventCount === 1 ? '' : 's'} at this location
          </p>
        </div>
        <span className={`status-pill ${group.confidenceLevel}`}>
          {group.confidenceLevel === 'high'
            ? 'Mostly strong evidence'
            : group.confidenceLevel === 'medium'
              ? 'Mixed evidence'
              : 'Mostly weak evidence'}
        </span>
      </div>

      <div className="map-popup-list">
        {group.events.map((event) => (
          <article className="map-popup-item" key={event.id}>
            <div className="map-popup-item-head">
              <div>
                <div className="map-popup-person">{event.associatedPersonLabel}</div>
                <div className="map-popup-meta">
                  {event.timestampLabel} · {event.typeLabel}
                </div>
              </div>

              <span className={`source-pill ${event.sourceId}`}>{event.sourceLabel}</span>
            </div>

            <p className="map-popup-copy">{event.summary}</p>

            <div className="map-popup-tags">
              <span className={`status-pill ${event.confidenceLevel}`}>{event.confidenceLabel}</span>
              {event.secondaryPeople.length > 0 ? (
                <span className="detail-pill">
                  With {event.secondaryPeople.map((person) => person.label).join(', ')}
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}