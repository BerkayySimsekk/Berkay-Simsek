const SOURCE_LABELS = {
  checkins: 'Check-ins',
  messages: 'Messages',
  notes: 'Personal notes',
  sightings: 'Sightings',
  tips: 'Anonymous tips',
}

function renderPersonDetail(person, recordsById, onSelectRecord) {
  const relatedRecords = person.recordIds
    .map((recordId) => recordsById.get(recordId))
    .filter(Boolean)
    .sort((left, right) => left.sortTime - right.sortTime)

  return (
    <div className="detail-layout">
      <div className="detail-header-row">
        <div>
          <h2 className="detail-title">{person.displayName}</h2>
          <p className="detail-copy">
            {person.recordIds.length} linked records across {person.locations.length} locations.
          </p>
        </div>
        <span className={`score-pill ${person.statusTone}`}>{person.classification}</span>
      </div>

      <div className="detail-pill-row">
        <span className="detail-pill">Suspicion score {person.suspicionScore}</span>
        <span className="detail-pill">{person.withPodoCount} records with Podo</span>
      </div>

      <section className="detail-section">
        <h3 className="detail-section-title">Why this person matters</h3>
        <ol className="reason-list">
          {person.suspicionReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ol>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">Aliases and locations</h3>
        <div className="alias-row">
          {person.aliases.map((alias) => (
            <span className="detail-pill" key={alias}>
              {alias}
            </span>
          ))}
        </div>
        <div className="alias-row">
          {person.locations.map((location) => (
            <span className="detail-pill" key={location}>
              {location}
            </span>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">Source breakdown</h3>
        <ul className="source-breakdown">
          {person.sourceBreakdown.map((entry) => (
            <li key={entry.sourceId}>
              <span className="source-breakdown-title">{SOURCE_LABELS[entry.sourceId] || entry.sourceId}</span>
              <span className="source-breakdown-meta">{entry.count} linked records</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">Connected timeline records</h3>
        <div className="detail-list">
          {relatedRecords.map((record) => (
            <div className="detail-list-item" key={record.id}>
              <button onClick={() => onSelectRecord(record.id)} type="button">
                <div className="detail-list-title">{record.title}</div>
                <div className="detail-list-meta">
                  {record.timestampLabel} · {record.location}
                </div>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function renderRecordDetail(record, recordsById, onSelectPerson, onSelectRecord) {
  const relatedRecords = record.relatedRecordIds
    .map((recordId) => recordsById.get(recordId))
    .filter(Boolean)

  return (
    <div className="detail-layout">
      <div className="detail-header-row">
        <div>
          <h2 className="detail-title">{record.title}</h2>
          <p className="detail-copy">{record.sourceLabel} · {record.timestampLabel}</p>
        </div>
        <span className={`source-pill ${record.sourceId}`}>{record.sourceLabel}</span>
      </div>

      <div className="detail-pill-row">
        <span className="detail-pill">{record.location}</span>
        {record.coordinates ? (
          <span className="detail-pill">
            {record.coordinates.lat.toFixed(5)}, {record.coordinates.lng.toFixed(5)}
          </span>
        ) : null}
      </div>

      <section className="detail-section">
        <h3 className="detail-section-title">Attached content</h3>
        <p className="detail-body">
          {record.content || 'This record only provides a structural breadcrumb without extra text.'}
        </p>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">People in this record</h3>
        <div className="detail-people">
          {record.participants.map((participant) => (
            <div className="detail-link-row" key={`${participant.role}-${participant.label}`}>
              <button
                className="detail-link"
                onClick={() => onSelectPerson(participant.key)}
                type="button"
              >
                {participant.label}
              </button>
              <span className="detail-pill">{participant.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">Evidence metadata</h3>
        <dl className="meta-list">
          <div className="meta-row">
            <dt>Source</dt>
            <dd>{record.sourceLabel}</dd>
          </div>
          <div className="meta-row">
            <dt>Linked records</dt>
            <dd>{record.relatedRecordIds.length}</dd>
          </div>
          <div className="meta-row">
            <dt>Podo involved</dt>
            <dd>{record.personKeys.includes('podo') ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title">Connected records</h3>
        <div className="detail-list">
          {relatedRecords.length === 0 ? (
            <p className="detail-copy">No corroborating records are linked to this item yet.</p>
          ) : (
            relatedRecords.map((relatedRecord) => (
              <div className="detail-list-item" key={relatedRecord.id}>
                <button onClick={() => onSelectRecord(relatedRecord.id)} type="button">
                  <div className="detail-list-title">{relatedRecord.title}</div>
                  <div className="detail-list-meta">
                    {relatedRecord.timestampLabel} · {relatedRecord.location}
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export function DetailPanel({
  fallbackMessage,
  peopleById,
  recordsById,
  selection,
  onSelectPerson,
  onSelectRecord,
}) {
  const selectedPerson = selection?.type === 'person' ? peopleById.get(selection.id) : null
  const selectedRecord = selection?.type === 'record' ? recordsById.get(selection.id) : null

  return (
    <section className="panel panel-section detail-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Detail View</h2>
          <p className="panel-subtitle">Inspect the selected person or record with full context.</p>
        </div>
      </div>

      {selectedPerson ? renderPersonDetail(selectedPerson, recordsById, onSelectRecord) : null}
      {selectedRecord ? renderRecordDetail(selectedRecord, recordsById, onSelectPerson, onSelectRecord) : null}

      {!selectedPerson && !selectedRecord ? (
        <div className="empty-layout">
          <span className="status-pill medium">Nothing selected</span>
          <h3 className="empty-title">No detail target</h3>
          <p className="empty-copy">{fallbackMessage}</p>
        </div>
      ) : null}
    </section>
  )
}