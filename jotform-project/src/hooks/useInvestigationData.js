import { useEffect, useState } from 'react'
import { fetchInvestigationSources } from '../data/jotformApi'
import { buildInvestigationModel } from '../lib/investigation'

export function useInvestigationData(refreshToken) {
  const [state, setState] = useState({
    completedToken: -1,
    error: null,
    model: null,
    sourceErrors: [],
  })

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    fetchInvestigationSources(controller.signal)
      .then(({ errors, sources }) => {
        if (!isActive) {
          return
        }

        const model = buildInvestigationModel(sources, errors)

        if (!model.records.length && errors.length > 0) {
          setState({
            completedToken: refreshToken,
            error: 'Every source request failed. Retry after the API quota window resets.',
            model: null,
            sourceErrors: errors,
          })
          return
        }

        setState({
          completedToken: refreshToken,
          error: null,
          model,
          sourceErrors: errors,
        })
      })
      .catch((error) => {
        if (!isActive || error.name === 'AbortError') {
          return
        }

        setState({
          completedToken: refreshToken,
          error: error.message || 'Unable to fetch the investigation records.',
          model: null,
          sourceErrors: [],
        })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [refreshToken])

  const status =
    state.completedToken !== refreshToken
      ? 'loading'
      : state.error && !state.model
        ? 'error'
        : 'success'

  return {
    error: state.error,
    model: state.model,
    sourceErrors: state.sourceErrors,
    status,
  }
}