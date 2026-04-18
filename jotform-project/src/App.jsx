import { useDeferredValue, useState } from 'react'
import './App.css'
import { CaseInsightPanels } from './components/CaseInsightPanels'
import { DetailPanel } from './components/DetailPanel'
import { FiltersPanel } from './components/FiltersPanel'
import { MapViewPage } from './components/MapViewPage'
import { PageNavigation } from './components/PageNavigation'
import { PeoplePanel } from './components/PeoplePanel'
import { RouteTimelinePanel } from './components/RouteTimelinePanel'
import { StatusPanel } from './components/StatusPanel'
import { TimelinePanel } from './components/TimelinePanel'
import { useInvestigationData } from './hooks/useInvestigationData'
import { usePageRoute } from './hooks/usePageRoute'
import { normalizeText } from './lib/investigation'

const CONTENT_FILTERS = [
  { value: 'all', label: 'All Records' },
  { value: 'checkins', label: 'Check-Ins' },
  { value: 'messages', label: 'Messages' },
  { value: 'sightings', label: 'Sightings' },
  { value: 'notes', label: 'Notes' },
  { value: 'tips', label: 'Tips' },
]

function filterRecords(records, filters) {
  return records.filter((record) => {
    if (filters.person !== 'all') {
      const hasPerson = record.people.some((person) => person.key === filters.person)

      if (!hasPerson) {
        return false
      }
    }

    if (filters.location !== 'all' && record.location !== filters.location) {
      return false
    }

    if (filters.content !== 'all' && record.sourceId !== filters.content) {
      return false
    }

    if (!filters.search) {
      return true
    }

    return record.searchText.includes(filters.search)
  })
}

function buildVisiblePeople(records, people) {
  const personIds = new Set()

  records.forEach((record) => {
    record.people.forEach((person) => {
      personIds.add(person.key)
    })
  })

  return people.filter((person) => personIds.has(person.id))
}

function App() {
  const [refreshToken, setRefreshToken] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [personFilter, setPersonFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [contentFilter, setContentFilter] = useState('all')
  const [selection, setSelection] = useState(null)

  const { currentPage, goToDashboard, goToMapView, goToRouteFlow } = usePageRoute()
  const deferredSearch = useDeferredValue(searchInput)
  const normalizedSearch = normalizeText(deferredSearch)
  const { error, model, sourceErrors, status } = useInvestigationData(refreshToken)

  const filteredRecords = model
    ? filterRecords(model.records, {
        content: contentFilter,
        location: locationFilter,
        person: personFilter,
        search: normalizedSearch,
      })
    : []

  const visiblePeople = model ? buildVisiblePeople(filteredRecords, model.people) : []
  const hasActiveFilters =
    searchInput.trim() ||
    personFilter !== 'all' ||
    locationFilter !== 'all' ||
    contentFilter !== 'all'

  const handleRetry = () => {
    setRefreshToken((current) => current + 1)
  }

  const resetFilters = () => {
    setSearchInput('')
    setPersonFilter('all')
    setLocationFilter('all')
    setContentFilter('all')
  }

  if (status === 'loading' && !model) {
    return (
      <div className="app-shell">
        <PageNavigation
          currentPage={currentPage}
          onGoDashboard={goToDashboard}
          onGoMapView={goToMapView}
          onGoRouteFlow={goToRouteFlow}
        />

        <StatusPanel
          title="Loading Ankara case records"
          message="Fetching cross-form submissions and building linked person clusters."
          variant="loading"
        />
      </div>
    )
  }

  if (status === 'error' && !model) {
    return (
      <div className="app-shell">
        <PageNavigation
          currentPage={currentPage}
          onGoDashboard={goToDashboard}
          onGoMapView={goToMapView}
          onGoRouteFlow={goToRouteFlow}
        />

        <StatusPanel
          actionLabel="Retry"
          message={error}
          onAction={handleRetry}
          title="Investigation data could not be loaded"
          variant="error"
        />
      </div>
    )
  }

  const sourceSummary = model?.sourceSummary ?? { loaded: 0, total: 0 }
  const lastSeenWith = model?.lastSeenWith ?? null
  const mostSuspicious = model?.mostSuspicious ?? null
  const filteredRecordIds = new Set(filteredRecords.map((record) => record.id))
  const visiblePersonIds = new Set(visiblePeople.map((person) => person.id))
  let currentSelection = null

  if (model?.records.length) {
    const isSelectedRecordVisible =
      selection?.type === 'record' && filteredRecordIds.has(selection.id)
    const isSelectedPersonVisible =
      selection?.type === 'person' && visiblePersonIds.has(selection.id)

    if (isSelectedRecordVisible || isSelectedPersonVisible) {
      currentSelection = selection
    } else {
      const fallbackRecord = filteredRecords[filteredRecords.length - 1] ?? null
      const fallbackPerson = visiblePeople[0] ?? null

      if (fallbackRecord) {
        currentSelection = { type: 'record', id: fallbackRecord.id }
      } else if (fallbackPerson) {
        currentSelection = { type: 'person', id: fallbackPerson.id }
      }
    }
  }

  const focusedPersonId = currentSelection?.type === 'person' ? currentSelection.id : null

  const sourceStatusBanner = sourceErrors.length > 0 ? (
    <div className="status-banner warning-banner">
      <div>
        Loaded {sourceSummary.loaded} of {sourceSummary.total} sources. Missing:{' '}
        {sourceErrors.map((issue) => issue.sourceLabel).join(', ')}.
      </div>
      <button className="banner-button" onClick={handleRetry} type="button">
        Retry failed sources
      </button>
    </div>
  ) : null

  const dashboardPage = (
    <>
      <header className="case-header panel">
        <div className="case-copy">
          <p className="eyebrow">Frontend Investigation Dashboard</p>
          <h1>Missing Podo: The Ankara Case</h1>
          <p className="lede">
            Track Podo&apos;s final known route, compare form submissions, and surface
            the people whose records become more suspicious when the sources are
            linked together.
          </p>
        </div>

        <CaseInsightPanels lastSeenWith={lastSeenWith} mostSuspicious={mostSuspicious} />
      </header>

      {status === 'loading' && model ? (
        <div className="status-banner info-banner">Refreshing investigation data…</div>
      ) : null}

      {sourceStatusBanner}

      <div className="workspace-grid">
        <div className="sidebar-stack">
          <FiltersPanel
            contentFilter={contentFilter}
            contentFilters={CONTENT_FILTERS}
            hasActiveFilters={Boolean(hasActiveFilters)}
            locationFilter={locationFilter}
            locations={model?.locations ?? []}
            onReset={resetFilters}
            personFilter={personFilter}
            people={model?.people ?? []}
            searchInput={searchInput}
            setContentFilter={setContentFilter}
            setLocationFilter={setLocationFilter}
            setPersonFilter={setPersonFilter}
            setSearchInput={setSearchInput}
          />

          <PeoplePanel
            people={visiblePeople}
            selectedPersonId={focusedPersonId}
            onSelectPerson={(personId) => setSelection({ type: 'person', id: personId })}
          />
        </div>

        <TimelinePanel
          emptyState={
            hasActiveFilters
              ? 'No records match the current search and filter combination.'
              : 'No linked investigation records are available.'
          }
          focusedPersonId={focusedPersonId}
          records={filteredRecords}
          selectedRecordId={currentSelection?.type === 'record' ? currentSelection.id : null}
          onSelectPerson={(personId) => setSelection({ type: 'person', id: personId })}
          onSelectRecord={(recordId) => setSelection({ type: 'record', id: recordId })}
        />

        <DetailPanel
          fallbackMessage={
            filteredRecords.length === 0
              ? 'Adjust the search or filters to restore a trail view.'
              : 'Select a person or a record to inspect linked evidence.'
          }
          peopleById={model?.peopleById ?? new Map()}
          recordsById={model?.recordsById ?? new Map()}
          selection={currentSelection}
          onSelectPerson={(personId) => setSelection({ type: 'person', id: personId })}
          onSelectRecord={(recordId) => setSelection({ type: 'record', id: recordId })}
        />
      </div>
    </>
  )

  const routeFlowPage = (
    <>
      <section className="panel panel-section route-page-hero">
        <p className="eyebrow">Dedicated Route Page</p>
        <h1>Podo Route Flow</h1>
        <p className="lede route-page-copy">
          Follow Podo&apos;s movement stop by stop, inspect the evidence supporting each
          location, and keep weaker or conflicting clues visible instead of flattening
          them into one story.
        </p>
      </section>

      {status === 'loading' && model ? (
        <div className="status-banner info-banner">Refreshing investigation data…</div>
      ) : null}

      {sourceStatusBanner}

      <RouteTimelinePanel model={model} />
    </>
  )

  const mapViewPage = (
    <MapViewPage
      model={model}
      onRetry={handleRetry}
      sourceErrors={sourceErrors}
      sourceSummary={sourceSummary}
      status={status}
    />
  )

  return (
    <div className="app-shell">
      <PageNavigation
        currentPage={currentPage}
        onGoDashboard={goToDashboard}
        onGoMapView={goToMapView}
        onGoRouteFlow={goToRouteFlow}
      />

      {currentPage === 'map-view'
        ? mapViewPage
        : currentPage === 'route-flow'
          ? routeFlowPage
          : dashboardPage}
    </div>
  )
}

export default App
