import { useDeferredValue, useEffect, useState } from 'react'
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
import { useMediaQuery } from './hooks/useMediaQuery'
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
  const [mobileTab, setMobileTab] = useState('timeline')
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)

  const { currentPage, goToDashboard, goToMapView, goToRouteFlow } = usePageRoute()
  const isCompactLayout = useMediaQuery('(max-width: 980px)')
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
  const hasActiveFiltersApplied = Boolean(hasActiveFilters)
  const filterSheetOpen = isCompactLayout && isFilterSheetOpen
  const detailDrawerOpen = isCompactLayout && isDetailDrawerOpen

  useEffect(() => {
    if (!isCompactLayout || typeof document === 'undefined') {
      return undefined
    }

    const originalOverflow = document.body.style.overflow

    if (filterSheetOpen || detailDrawerOpen) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [detailDrawerOpen, filterSheetOpen, isCompactLayout])

  const handleRetry = () => {
    setRefreshToken((current) => current + 1)
  }

  const resetFilters = () => {
    setSearchInput('')
    setPersonFilter('all')
    setLocationFilter('all')
    setContentFilter('all')
  }

  const handleSelectPerson = (personId) => {
    setSelection({ type: 'person', id: personId })

    if (isCompactLayout) {
      setIsDetailDrawerOpen(true)
    }
  }

  const handleSelectRecord = (recordId) => {
    setSelection({ type: 'record', id: recordId })

    if (isCompactLayout) {
      setIsDetailDrawerOpen(true)
    }
  }

  const showTimelinePanel = () => {
    setMobileTab('timeline')
    setIsDetailDrawerOpen(false)
  }

  const showPeoplePanel = () => {
    setMobileTab('people')
    setIsDetailDrawerOpen(false)
  }

  const toggleFilterSheet = () => {
    setIsFilterSheetOpen((current) => !current)
  }

  const closeFilterSheet = () => {
    setIsFilterSheetOpen(false)
  }

  const toggleDetailDrawer = () => {
    setIsDetailDrawerOpen((current) => !current)
  }

  const closeDetailDrawer = () => {
    setIsDetailDrawerOpen(false)
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

  const detailPanel = (
    <DetailPanel
      fallbackMessage={
        filteredRecords.length === 0
          ? 'Adjust the search or filters to restore a trail view.'
          : 'Select a person or a record to inspect linked evidence.'
      }
      peopleById={model?.peopleById ?? new Map()}
      recordsById={model?.recordsById ?? new Map()}
      selection={currentSelection}
      onSelectPerson={handleSelectPerson}
      onSelectRecord={handleSelectRecord}
    />
  )

  const compactWorkspace = (
    <>
      <div className="compact-workspace-toolbar panel">
        <button
          className={`ghost-button compact-filter-button ${filterSheetOpen ? 'is-active' : ''}`}
          onClick={toggleFilterSheet}
          type="button"
        >
          {hasActiveFiltersApplied ? 'Filters on' : 'Filters'}
        </button>

        <div aria-label="Dashboard sections" className="compact-tab-group" role="tablist">
          <button
            aria-selected={mobileTab === 'timeline' && !detailDrawerOpen}
            className={`page-tab ${mobileTab === 'timeline' && !detailDrawerOpen ? 'is-active' : ''}`}
            onClick={showTimelinePanel}
            role="tab"
            type="button"
          >
            Timeline
          </button>

          <button
            aria-selected={mobileTab === 'people' && !detailDrawerOpen}
            className={`page-tab ${mobileTab === 'people' && !detailDrawerOpen ? 'is-active' : ''}`}
            onClick={showPeoplePanel}
            role="tab"
            type="button"
          >
            People
          </button>

          <button
            aria-selected={detailDrawerOpen}
            className={`page-tab ${detailDrawerOpen ? 'is-active' : ''}`}
            onClick={toggleDetailDrawer}
            role="tab"
            type="button"
          >
            Detail
          </button>
        </div>
      </div>

      <div className="compact-workspace-stack">
        {mobileTab === 'people' ? (
          <PeoplePanel
            people={visiblePeople}
            selectedPersonId={focusedPersonId}
            onSelectPerson={handleSelectPerson}
          />
        ) : (
          <TimelinePanel
            emptyState={
              hasActiveFiltersApplied
                ? 'No records match the current search and filter combination.'
                : 'No linked investigation records are available.'
            }
            focusedPersonId={focusedPersonId}
            records={filteredRecords}
            selectedRecordId={currentSelection?.type === 'record' ? currentSelection.id : null}
            onSelectPerson={handleSelectPerson}
            onSelectRecord={handleSelectRecord}
          />
        )}
      </div>

      {filterSheetOpen ? (
        <div className="overlay-backdrop" onClick={closeFilterSheet}>
          <div
            aria-modal="true"
            className="overlay-sheet-frame"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <FiltersPanel
              className="filter-sheet-panel"
              contentFilter={contentFilter}
              contentFilters={CONTENT_FILTERS}
              hasActiveFilters={hasActiveFiltersApplied}
              headerAction={
                <button className="ghost-button" onClick={closeFilterSheet} type="button">
                  Close
                </button>
              }
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
          </div>
        </div>
      ) : null}

      {detailDrawerOpen ? (
        <div className="overlay-backdrop overlay-backdrop--drawer" onClick={closeDetailDrawer}>
          <div
            aria-modal="true"
            className="detail-drawer-shell"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <DetailPanel
              className="detail-panel--drawer"
              fallbackMessage={
                filteredRecords.length === 0
                  ? 'Adjust the search or filters to restore a trail view.'
                  : 'Select a person or a record to inspect linked evidence.'
              }
              headerAction={
                <button className="ghost-button" onClick={closeDetailDrawer} type="button">
                  Close
                </button>
              }
              peopleById={model?.peopleById ?? new Map()}
              recordsById={model?.recordsById ?? new Map()}
              selection={currentSelection}
              onSelectPerson={handleSelectPerson}
              onSelectRecord={handleSelectRecord}
            />
          </div>
        </div>
      ) : null}
    </>
  )

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

      {isCompactLayout ? (
        compactWorkspace
      ) : (
        <div className="workspace-grid">
          <div className="sidebar-stack">
            <FiltersPanel
              contentFilter={contentFilter}
              contentFilters={CONTENT_FILTERS}
              hasActiveFilters={hasActiveFiltersApplied}
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
              onSelectPerson={handleSelectPerson}
            />
          </div>

          <TimelinePanel
            emptyState={
              hasActiveFiltersApplied
                ? 'No records match the current search and filter combination.'
                : 'No linked investigation records are available.'
            }
            focusedPersonId={focusedPersonId}
            records={filteredRecords}
            selectedRecordId={currentSelection?.type === 'record' ? currentSelection.id : null}
            onSelectPerson={handleSelectPerson}
            onSelectRecord={handleSelectRecord}
          />

          {detailPanel}
        </div>
      )}
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
