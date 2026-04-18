function formatPersonSummary(person) {
  if (person.id === 'podo') {
    return person.aliases.length > 1
      ? `Missing subject · ${person.aliases.length} variants linked`
      : 'Missing subject'
  }

  const aliasSummary =
    person.aliases.length > 1 ? ` · ${person.aliases.length} variants merged` : ''

  if (person.withPodoCount > 0) {
    return `${person.withPodoCount} direct links with Podo${aliasSummary}`
  }

  return `${person.recordIds.length} linked records${aliasSummary}`
}

export function PeoplePanel({ people, selectedPersonId, onSelectPerson }) {
  return (
    <section className="panel panel-section">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Linked People</h2>
          <p className="panel-subtitle">Resolved with fuzzy name matching and corroborated records.</p>
        </div>
        <span className="panel-subtitle">{people.length} visible</span>
      </div>

      <div className="people-list">
        {people.map((person) => (
          <button
            className={`person-card ${selectedPersonId === person.id ? 'is-selected' : ''}`}
            key={person.id}
            onClick={() => onSelectPerson(person.id)}
            type="button"
          >
            <div className="person-card-head">
              <div>
                <h3 className="person-card-name">{person.displayName}</h3>
                <p className="person-card-meta">{formatPersonSummary(person)}</p>
              </div>
              <span className={`score-pill ${person.statusTone}`}>{person.classification}</span>
            </div>

            <p className="card-copy">{person.matchSummary}</p>

            <div className="alias-row">
              <span className={`status-pill ${person.matchConfidence}`}>{person.matchConfidenceLabel}</span>
              {person.aliases.slice(0, 3).map((alias) => (
                <span className="detail-pill" key={alias}>
                  {alias}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}