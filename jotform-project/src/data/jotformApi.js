const API_KEYS = [
  '5593acd695caab1a3805c3af8532df09',
  '54a934fa20b1ccc3a5bd1d2076f90556',
  'ad39735f1449a6dc28d60e0921352665',
]

export const FORM_SOURCES = [
  { id: 'checkins', label: 'Check-Ins', formId: '261065067494966' },
  { id: 'messages', label: 'Messages', formId: '261065765723966' },
  { id: 'sightings', label: 'Sightings', formId: '261065244786967' },
  { id: 'notes', label: 'Personal Notes', formId: '261065509008958' },
  { id: 'tips', label: 'Anonymous Tips', formId: '261065875889981' },
]

function buildEndpoint(formId, apiKey) {
  const params = new URLSearchParams({ apiKey, limit: '100' })
  return `https://api.jotform.com/form/${formId}/submissions?${params.toString()}`
}

async function fetchSubmissionsForKey(source, apiKey, signal) {
  const response = await fetch(buildEndpoint(source.formId, apiKey), { signal })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid Jotform payload.')
  }

  if (payload.responseCode === 200) {
    return Array.isArray(payload.content) ? payload.content : []
  }

  throw new Error(payload.message || 'Unknown Jotform API error.')
}

async function fetchSourceWithFallback(source, signal) {
  const failures = []

  for (const apiKey of API_KEYS) {
    try {
      const submissions = await fetchSubmissionsForKey(source, apiKey, signal)

      return { source, submissions }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error
      }

      failures.push(error.message)
    }
  }

  throw new Error(failures.filter(Boolean).join(' | ') || 'All API keys failed.')
}

export async function fetchInvestigationSources(signal) {
  const settled = await Promise.allSettled(
    FORM_SOURCES.map((source) => fetchSourceWithFallback(source, signal)),
  )

  return settled.reduce(
    (result, entry, index) => {
      const source = FORM_SOURCES[index]

      if (entry.status === 'fulfilled') {
        result.sources.push(entry.value)
      } else {
        result.errors.push({
          sourceId: source.id,
          sourceLabel: source.label,
          message: entry.reason?.message || 'Unknown data source error.',
        })
      }

      return result
    },
    { errors: [], sources: [] },
  )
}