function sourcePillClass(record) {
  return `source-pill ${record.sourceId}`
}

export function TimelinePanel({
  emptyState,
  focusedPersonId,
  records,
  selectedRecordId,
  onSelectPerson,
  onSelectRecord,
}) {
  return (
    <section className="panel panel-section timeline-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Podo Trail Timeline</h2>
          <p className="panel-subtitle">
            Chronological evidence from every form source, linked by people and location.
          </p>
        </div>
        <span className="panel-subtitle">{records.length} records</span>
      </div>

      {records.length === 0 ? (
        <div className="empty-state empty-layout">
          <span className="status-pill medium">Empty result</span>
          <h3 className="empty-title">No linked evidence in view</h3>
          <p className="empty-copy">{emptyState}</p>
        </div>
      ) : (
        <div className="timeline-list">
          {records.map((record) => (
            <button
              className={`timeline-card ${selectedRecordId === record.id ? 'is-selected' : ''}`}
              key={record.id}
              onClick={() => onSelectRecord(record.id)}
              type="button"
            >
              <div className="timeline-card-head">
                <div className="timeline-header-copy">
                  <span className="timeline-time">{record.timeLabel}</span>
                  <h3 className="timeline-title">{record.title}</h3>
                  <p className="timeline-copy">
                    <span className="timeline-location">{record.location}</span>
                    {' · '}
                    {record.timestampLabel}
                  </p>
                </div>
                <span className={sourcePillClass(record)}>{record.sourceLabel}</span>
              </div>

              <p className="card-copy">{record.content || 'No descriptive content attached to this record.'}</p>

              <div className="people-row">
                {record.people.map((person) => (
                  <button
                    className={`person-chip ${focusedPersonId === person.key ? 'is-active' : ''} ${
                      record.personKeys.includes('podo') && person.key !== 'podo' ? 'is-highlighted' : ''
                    }`}
                    key={`${record.id}-${person.key}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelectPerson(person.key)
                    }}
                    type="button"
                  >
                    {person.label}
                  </button>
                ))}
              </div>

              <div className="timeline-meta">
                {record.flags.map((flag) => (
                  <span className={`flag-pill ${flag.tone}`} key={flag.label}>
                    {flag.label}
                  </span>
                ))}
                <span className="detail-pill">{record.relatedRecordIds.length} connected records</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}