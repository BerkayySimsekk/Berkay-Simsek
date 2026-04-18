import { useSyncExternalStore } from 'react'

function getMatch(query) {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia(query).matches
}

export function useMediaQuery(query) {
  const subscribe = (callback) => {
    if (typeof window === 'undefined') {
      return () => {}
    }

    const mediaQuery = window.matchMedia(query)
    mediaQuery.addEventListener('change', callback)

    return () => {
      mediaQuery.removeEventListener('change', callback)
    }
  }

  return useSyncExternalStore(subscribe, () => getMatch(query), () => false)
}