function formatPersonSummary(person) {
  if (person.id === 'podo') {
    return 'Missing subject'
  }

  if (person.withPodoCount > 0) {
    return `${person.withPodoCount} direct links with Podo`
  }

  return `${person.recordIds.length} linked records`
}

export function PeoplePanel({ people, selectedPersonId, onSelectPerson }) {
  return (
    <section className="panel panel-section">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Linked People</h2>
          <p className="panel-subtitle">Grouped by name aliases and corroborated records.</p>
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

            <p className="card-copy">{person.suspicionReasons[0]}</p>

            <div className="alias-row">
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