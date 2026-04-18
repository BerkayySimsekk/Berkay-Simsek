export function PageNavigation({ currentPage, onGoDashboard, onGoRouteFlow }) {
  return (
    <nav className="page-navigation panel">
      <div className="page-navigation-copy">
        <p className="eyebrow">Case Views</p>
        <h2 className="page-navigation-title">Switch between the full dashboard and the dedicated route page.</h2>
      </div>

      <div className="page-navigation-actions">
        <button
          className={`page-tab ${currentPage === 'dashboard' ? 'is-active' : ''}`}
          onClick={onGoDashboard}
          type="button"
        >
          Investigation Dashboard
        </button>

        <button
          className={`page-tab ${currentPage === 'route-flow' ? 'is-active' : ''}`}
          onClick={onGoRouteFlow}
          type="button"
        >
          Podo Route Flow
        </button>
      </div>
    </nav>
  )
}