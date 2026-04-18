export function FiltersPanel({
  contentFilter,
  contentFilters,
  hasActiveFilters,
  locationFilter,
  locations,
  onReset,
  personFilter,
  people,
  searchInput,
  setContentFilter,
  setLocationFilter,
  setPersonFilter,
  setSearchInput,
}) {
  return (
    <section className="panel panel-section">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Search & Filters</h2>
          <p className="panel-subtitle">Narrow the trail by person, place, or record type.</p>
        </div>
        {hasActiveFilters ? (
          <button className="ghost-button" onClick={onReset} type="button">
            Reset
          </button>
        ) : null}
      </div>

      <div className="filters-grid">
        <label className="field-group">
          <span className="field-label">Search</span>
          <input
            className="search-input"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search names, notes, messages, or locations"
            type="search"
            value={searchInput}
          />
        </label>

        <label className="field-group">
          <span className="field-label">Person</span>
          <select
            className="select-input"
            onChange={(event) => setPersonFilter(event.target.value)}
            value={personFilter}
          >
            <option value="all">All linked people</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
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
            <option value="all">All locations</option>
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <div className="field-group">
          <span className="field-label">Content</span>
          <div className="content-filter-grid">
            {contentFilters.map((filter) => (
              <button
                className={`content-toggle ${contentFilter === filter.value ? 'is-active' : ''}`}
                key={filter.value}
                onClick={() => setContentFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}