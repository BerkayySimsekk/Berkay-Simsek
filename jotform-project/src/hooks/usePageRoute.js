import { useEffect, useState } from 'react'

const DASHBOARD_PATH = '/'
const ROUTE_FLOW_PATH = '/route-flow'

function normalizePath(pathname) {
  const stripped = pathname.replace(/\/+$/, '')

  return stripped || '/'
}

function resolvePage(pathname) {
  return normalizePath(pathname) === ROUTE_FLOW_PATH ? 'route-flow' : 'dashboard'
}

export function usePageRoute() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname))

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePath(window.location.pathname))
      window.scrollTo({ top: 0 })
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const navigateTo = (nextPath) => {
    const normalizedPath = normalizePath(nextPath)

    if (normalizedPath === pathname) {
      return
    }

    window.history.pushState({}, '', normalizedPath)
    setPathname(normalizedPath)
    window.scrollTo({ top: 0 })
  }

  return {
    currentPage: resolvePage(pathname),
    dashboardPath: DASHBOARD_PATH,
    goToDashboard: () => navigateTo(DASHBOARD_PATH),
    goToRouteFlow: () => navigateTo(ROUTE_FLOW_PATH),
    routeFlowPath: ROUTE_FLOW_PATH,
  }
}