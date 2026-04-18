import { normalizeText } from './investigation'

const PODO_KEY = 'podo'
const GROUP_WINDOW_MS = 12 * 60 * 1000
const ATTACH_WINDOW_MS = 20 * 60 * 1000
const CONFLICT_WINDOW_MS = 4 * 60 * 1000
const COLLATOR = new Intl.Collator('tr', { sensitivity: 'base' })
const DAY_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
})
const CLOCK_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
})

const SOURCE_ORDER = {
  checkins: 0,
  sightings: 1,
  messages: 2,
  notes: 3,
  tips: 4,
}

const SOURCE_LABELS = {
  checkins: 'Check-ins',
  messages: 'Messages',
  notes: 'Personal notes',
  sightings: 'Sightings',
  tips: 'Anonymous tips',
}

const SOURCE_EVENT_TYPES = {
  checkins: 'Check-in',
  messages: 'Message clue',
  notes: 'Witness note',
  sightings: 'Sighting',
  tips: 'Anonymous clue',
}

const SOURCE_RELIABILITY = {
  checkins: { label: 'high', score: 3 },
  messages: { label: 'medium', score: 2 },
  notes: { label: 'medium', score: 2 },
  sightings: { label: 'high', score: 3 },
  tips: { label: 'low', score: 1 },
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function personKey(value = '') {
  const normalized = normalizeText(value)

  if (!normalized) {
    return ''
  }

  const parts = normalized.split(' ')

  if (parts.length === 1) {
    return parts[0]
  }

  const significantTail = parts.slice(1).find((part) => part.length > 1)

  return significantTail ? `${parts[0]} ${significantTail}` : parts[0]
}

function isPodoName(value) {
  return personKey(value) === PODO_KEY
}

function mentionsPodo(value) {
  return normalizeText(value).includes('podo')
}

function hasPresenceHint(value) {
  return /podo ile|podoyu|podo yu|podo yu|beraber|birlikte|gordum|gordu|goruldu|yurud|yaninda|yan yana|yalniz kalan|gorunuyordu|kaleye cikan|birlikteydi|gorduler/.test(
    normalizeText(value),
  )
}

function hasRemoteHint(value) {
  return /mesaj atti|yazdi|soyledi|dedi|haber ver/.test(normalizeText(value))
}

function reliabilityTone(label) {
  return label === 'high' ? 'high' : label === 'medium' ? 'medium' : 'low'
}

function sortRouteEvidence(left, right) {
  if (left.timeSort !== right.timeSort) {
    return left.timeSort - right.timeSort
  }

  return (SOURCE_ORDER[left.sourceId] || 0) - (SOURCE_ORDER[right.sourceId] || 0)
}

function buildEvidence(record, options) {
  const reliability = SOURCE_RELIABILITY[record.sourceId] || SOURCE_RELIABILITY.notes

  return {
    canStartEvent: options.canStartEvent,
    content: record.content,
    directness: options.directness,
    hasKnownTime: Boolean(record.timestamp),
    id: `route-evidence:${record.id}`,
    location: record.location,
    locationKey: normalizeText(record.location),
    locationTrusted: options.locationTrusted,
    people: record.people.map((person) => ({ ...person })),
    peopleKeys: record.people.map((person) => person.key),
    record,
    recordId: record.id,
    reliabilityLabel: reliability.label,
    reliabilityScore: reliability.score,
    routeRole: options.routeRole,
    routeRoleLabel: options.routeRole === 'primary' ? 'Route anchor' : 'Supporting clue',
    sourceId: record.sourceId,
    sourceLabel: record.sourceLabel,
    sourceTypeLabel: SOURCE_LABELS[record.sourceId] || record.sourceLabel,
    sourceType: SOURCE_EVENT_TYPES[record.sourceId] || 'Route clue',
    sourceTone: reliabilityTone(reliability.label),
    timeLabel: record.timeLabel,
    timeSort: record.timestamp ? record.sortTime : Number.POSITIVE_INFINITY,
    timestampLabel: record.timestampLabel,
  }
}

function classifyRecordForRoute(record) {
  const values = record.values || {}
  const contentMentionsPodo = mentionsPodo(record.content)
  const presenceHint = hasPresenceHint(record.content)
  const remoteHint = hasRemoteHint(record.content)

  switch (record.sourceId) {
    case 'checkins':
      if (isPodoName(values.personName)) {
        return buildEvidence(record, {
          canStartEvent: true,
          directness: 'direct',
          locationTrusted: true,
          routeRole: 'primary',
        })
      }

      if (contentMentionsPodo && presenceHint) {
        return buildEvidence(record, {
          canStartEvent: true,
          directness: 'contextual',
          locationTrusted: true,
          routeRole: 'primary',
        })
      }

      if (contentMentionsPodo) {
        return buildEvidence(record, {
          canStartEvent: false,
          directness: 'contextual',
          locationTrusted: false,
          routeRole: 'supporting',
        })
      }

      return null

    case 'sightings':
      if (record.personKeys.includes(PODO_KEY) || contentMentionsPodo) {
        return buildEvidence(record, {
          canStartEvent: true,
          directness: 'direct',
          locationTrusted: true,
          routeRole: 'primary',
        })
      }

      return null

    case 'messages':
      if (isPodoName(values.senderName)) {
        return buildEvidence(record, {
          canStartEvent: true,
          directness: 'direct',
          locationTrusted: true,
          routeRole: 'primary',
        })
      }

      if (contentMentionsPodo && presenceHint) {
        return buildEvidence(record, {
          canStartEvent: true,
          directness: 'contextual',
          locationTrusted: true,
          routeRole: 'primary',
        })
      }

      if (record.personKeys.includes(PODO_KEY) || contentMentionsPodo) {
        return buildEvidence(record, {
          canStartEvent: false,
          directness: 'contextual',
          locationTrusted: false,
          routeRole: 'supporting',
        })
      }

      return null

    case 'notes':
      if (isPodoName(values.authorName)) {
        return buildEvidence(record, {
          canStartEvent: true,
          directness: 'direct',
          locationTrusted: true,
          routeRole: 'primary',
        })
      }

      if (contentMentionsPodo && presenceHint && !remoteHint) {
        return buildEvidence(record, {
          canStartEvent: true,
          directness: 'contextual',
          locationTrusted: true,
          routeRole: 'primary',
        })
      }

      if (record.personKeys.includes(PODO_KEY) || contentMentionsPodo) {
        return buildEvidence(record, {
          canStartEvent: false,
          directness: 'contextual',
          locationTrusted: false,
          routeRole: 'supporting',
        })
      }

      return null

    case 'tips':
      if (contentMentionsPodo && presenceHint) {
        return buildEvidence(record, {
          canStartEvent: true,
          directness: 'contextual',
          locationTrusted: true,
          routeRole: 'supporting',
        })
      }

      if (contentMentionsPodo) {
        return buildEvidence(record, {
          canStartEvent: false,
          directness: 'contextual',
          locationTrusted: false,
          routeRole: 'supporting',
        })
      }

      return null

    default:
      return null
  }
}

function createGroup(evidence) {
  return {
    endTime: evidence.hasKnownTime ? evidence.record.sortTime : null,
    evidences: [evidence],
    id: `route-event:${evidence.recordId}`,
    location: evidence.location,
    locationKey: evidence.locationKey,
    startTime: evidence.hasKnownTime ? evidence.record.sortTime : null,
  }
}

function addEvidenceToGroup(group, evidence) {
  group.evidences.push(evidence)

  if (evidence.hasKnownTime) {
    const evidenceTime = evidence.record.sortTime

    group.startTime = group.startTime === null ? evidenceTime : Math.min(group.startTime, evidenceTime)
    group.endTime = group.endTime === null ? evidenceTime : Math.max(group.endTime, evidenceTime)
  }
}

function groupCanMerge(group, evidence) {
  if (group.locationKey !== evidence.locationKey) {
    return false
  }

  if (!evidence.hasKnownTime || group.endTime === null) {
    return true
  }

  return evidence.record.sortTime - group.endTime <= GROUP_WINDOW_MS
}

function buildStarterGroups(evidences) {
  return evidences
    .filter((evidence) => evidence.canStartEvent)
    .sort(sortRouteEvidence)
    .reduce((groups, evidence) => {
      const previousGroup = groups[groups.length - 1]

      if (previousGroup && groupCanMerge(previousGroup, evidence)) {
        addEvidenceToGroup(previousGroup, evidence)
        return groups
      }

      groups.push(createGroup(evidence))
      return groups
    }, [])
}

function groupCompanionKeys(group) {
  return new Set(
    group.evidences.flatMap((evidence) =>
      evidence.peopleKeys.filter((key) => key && key !== PODO_KEY && key !== 'unknown'),
    ),
  )
}

function sharedCompanionCount(evidence, group) {
  const evidenceKeys = evidence.peopleKeys.filter(
    (key) => key && key !== PODO_KEY && key !== 'unknown',
  )
  const companions = groupCompanionKeys(group)

  return evidenceKeys.filter((key) => companions.has(key)).length
}

function groupTimeDistance(group, evidence) {
  if (!evidence.hasKnownTime || group.startTime === null || group.endTime === null) {
    return Number.POSITIVE_INFINITY
  }

  const evidenceTime = evidence.record.sortTime

  if (evidenceTime < group.startTime) {
    return group.startTime - evidenceTime
  }

  if (evidenceTime > group.endTime) {
    return evidenceTime - group.endTime
  }

  return 0
}

function findBestGroup(groups, evidence) {
  let bestGroup = null
  let bestScore = Number.NEGATIVE_INFINITY

  groups.forEach((group) => {
    const timeDistance = groupTimeDistance(group, evidence)

    if (evidence.locationTrusted && evidence.locationKey === group.locationKey) {
      if (timeDistance <= ATTACH_WINDOW_MS || !Number.isFinite(timeDistance)) {
        const score = 100 - (Number.isFinite(timeDistance) ? timeDistance / 60000 : 0)

        if (score > bestScore) {
          bestGroup = group
          bestScore = score
        }
      }
    }

    const companions = sharedCompanionCount(evidence, group)

    if (companions > 0 && (timeDistance <= ATTACH_WINDOW_MS || !Number.isFinite(timeDistance))) {
      const score = 60 + companions * 10 - (Number.isFinite(timeDistance) ? timeDistance / 60000 : 0)

      if (score > bestScore) {
        bestGroup = group
        bestScore = score
      }
    }
  })

  return bestScore > 0 ? bestGroup : null
}

function attachSupportingEvidence(groups, evidences) {
  evidences
    .filter((evidence) => !evidence.canStartEvent)
    .sort(sortRouteEvidence)
    .forEach((evidence) => {
      const targetGroup = findBestGroup(groups, evidence)

      if (targetGroup) {
        addEvidenceToGroup(targetGroup, evidence)
      }
    })
}

function formatRange(startTime, endTime) {
  if (startTime === null) {
    return {
      timeLabel: 'Time uncertain',
      timestampLabel: 'Timestamp incomplete',
    }
  }

  if (endTime !== null && endTime - startTime >= 2 * 60 * 1000) {
    const startDate = new Date(startTime)
    const endDate = new Date(endTime)

    return {
      timeLabel: `${CLOCK_FORMATTER.format(startDate)} - ${CLOCK_FORMATTER.format(endDate)}`,
      timestampLabel: `${DAY_TIME_FORMATTER.format(startDate)} - ${CLOCK_FORMATTER.format(endDate)}`,
    }
  }

  const date = new Date(startTime)

  return {
    timeLabel: CLOCK_FORMATTER.format(date),
    timestampLabel: DAY_TIME_FORMATTER.format(date),
  }
}

function uniquePeople(evidences) {
  const peopleByKey = new Map()

  evidences.forEach((evidence) => {
    evidence.people.forEach((person) => {
      if (!person?.key || peopleByKey.has(person.key)) {
        return
      }

      peopleByKey.set(person.key, person)
    })
  })

  return [...peopleByKey.values()].sort((left, right) => {
    if (left.key === PODO_KEY) {
      return -1
    }

    if (right.key === PODO_KEY) {
      return 1
    }

    return COLLATOR.compare(left.label, right.label)
  })
}

function buildEventTypeLabel(evidences) {
  const sourceIds = unique(
    evidences
      .filter((evidence) => evidence.routeRole === 'primary')
      .map((evidence) => evidence.sourceId),
  )

  if (sourceIds.includes('checkins') && sourceIds.length === 1) {
    return 'Initial check-in'
  }

  if (sourceIds.includes('sightings') && sourceIds.length === 1) {
    return 'Sighting cluster'
  }

  if (sourceIds.length > 1) {
    return 'Corroborated stop'
  }

  if (sourceIds.includes('messages')) {
    return 'Message breadcrumb'
  }

  if (sourceIds.includes('notes')) {
    return 'Witness note'
  }

  if (sourceIds.includes('tips')) {
    return 'Anonymous clue'
  }

  return 'Route event'
}

function buildEventSummary(location, people, evidenceCount) {
  const companions = people.filter((person) => person.key !== PODO_KEY && person.key !== 'unknown')

  if (companions.length === 0) {
    return `Podo is placed at ${location} with ${evidenceCount} supporting record${
      evidenceCount === 1 ? '' : 's'
    }.`
  }

  if (companions.length === 1) {
    return `Podo appears at ${location} with ${companions[0].label}.`
  }

  return `Podo appears at ${location} with ${companions[0].label} and ${companions.length - 1} other linked people.`
}

function buildConfidence(evidences, hasKnownTime) {
  const primaryEvidences = evidences.filter((evidence) => evidence.routeRole === 'primary')
  const directPrimary = primaryEvidences.some((evidence) => evidence.directness === 'direct')
  const strongPrimary = primaryEvidences.some((evidence) => evidence.reliabilityScore >= 3)
  const sourceCount = unique(evidences.map((evidence) => evidence.sourceId)).length
  let score = 0

  if (strongPrimary) {
    score += 2
  } else if (primaryEvidences.length > 0) {
    score += 1
  }

  if (directPrimary) {
    score += 1
  }

  if (sourceCount >= 2) {
    score += 1
  }

  if (evidences.some((evidence) => evidence.sourceId === 'tips')) {
    score -= 1
  }

  if (!hasKnownTime) {
    score -= 1
  }

  const level = score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low'
  const reasons = []

  if (strongPrimary) {
    reasons.push('Anchored by a direct sighting or check-in.')
  } else if (directPrimary) {
    reasons.push('Anchored by a direct message or first-hand note.')
  } else {
    reasons.push('Built mainly from contextual evidence rather than direct confirmation.')
  }

  if (sourceCount >= 2) {
    reasons.push(`Corroborated by ${sourceCount} different source types.`)
  }

  if (evidences.some((evidence) => evidence.sourceId === 'tips')) {
    reasons.push('Anonymous tips are included as weaker support, not definitive proof.')
  }

  if (!hasKnownTime) {
    reasons.push('Timestamp information is incomplete for this stop.')
  }

  return {
    confidenceLabel: level === 'high' ? 'High reliability' : level === 'medium' ? 'Medium reliability' : 'Low reliability',
    confidenceLevel: level,
    reliabilityReasons: reasons,
  }
}

function buildSupportingRecords(evidences) {
  return evidences
    .sort((left, right) => sortRouteEvidence(left, right))
    .map((evidence) => ({
      content: evidence.content,
      directnessLabel: evidence.directness === 'direct' ? 'Direct placement' : 'Context clue',
      id: evidence.recordId,
      location: evidence.location,
      people: evidence.people,
      reliabilityLabel:
        evidence.sourceId === 'tips'
          ? evidence.record.confidence
            ? `Tip confidence: ${evidence.record.confidence}`
            : 'Tip confidence: unknown'
          : evidence.reliabilityLabel === 'high'
            ? 'Strong source'
            : evidence.reliabilityLabel === 'medium'
              ? 'Moderate source'
              : 'Weak source',
      reliabilityTone: evidence.sourceTone,
      routeRoleLabel: evidence.routeRoleLabel,
      sourceId: evidence.sourceId,
      sourceLabel: evidence.sourceLabel,
      timestampLabel: evidence.timestampLabel,
      title: evidence.title || evidence.record.title,
    }))
}

function buildGroupEvent(group) {
  const people = uniquePeople(group.evidences)
  const sources = unique(group.evidences.map((evidence) => evidence.sourceId))
    .sort((left, right) => (SOURCE_ORDER[left] || 0) - (SOURCE_ORDER[right] || 0))
    .map((sourceId) => ({
      id: sourceId,
      label: SOURCE_LABELS[sourceId] || sourceId,
    }))
  const timeInfo = formatRange(group.startTime, group.endTime)
  const confidence = buildConfidence(group.evidences, group.startTime !== null)

  return {
    confidenceLabel: confidence.confidenceLabel,
    confidenceLevel: confidence.confidenceLevel,
    evidenceCount: group.evidences.length,
    eventTypeLabel: buildEventTypeLabel(group.evidences),
    hasKnownTime: group.startTime !== null,
    id: group.id,
    location: group.location,
    locationKey: group.locationKey,
    people,
    reliabilityReasons: confidence.reliabilityReasons,
    sourceIds: sources.map((source) => source.id),
    sources,
    supportingRecords: buildSupportingRecords(group.evidences),
    summary: buildEventSummary(group.location, people, group.evidences.length),
    timeLabel: timeInfo.timeLabel,
    timeSort: group.startTime ?? Number.POSITIVE_INFINITY,
    timestampLabel: timeInfo.timestampLabel,
    uncertaintyFlags: [],
  }
}

function addConflictFlags(events) {
  events.forEach((event) => {
    event.uncertaintyFlags = [...event.uncertaintyFlags]
  })

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]

    if (!event.hasKnownTime) {
      continue
    }

    for (let nextIndex = index + 1; nextIndex < events.length; nextIndex += 1) {
      const nextEvent = events[nextIndex]

      if (!nextEvent.hasKnownTime) {
        continue
      }

      const timeGap = nextEvent.timeSort - event.timeSort

      if (timeGap > CONFLICT_WINDOW_MS) {
        break
      }

      if (event.locationKey !== nextEvent.locationKey) {
        const flag = 'Nearby evidence points to different locations within minutes.'

        event.uncertaintyFlags.push(flag)
        nextEvent.uncertaintyFlags.push(flag)
      }
    }

    if (event.confidenceLevel === 'low') {
      event.uncertaintyFlags.push('This stop is based on weaker or indirect evidence.')
    }

    if (!event.hasKnownTime) {
      event.uncertaintyFlags.push('Timestamp is incomplete or missing.')
    }
  }

  events.forEach((event) => {
    event.uncertaintyFlags = unique(event.uncertaintyFlags)
  })
}

function buildFilterOptions(events) {
  const people = []
  const seenPeople = new Set()

  events.forEach((event) => {
    event.people.forEach((person) => {
      if (!person?.key || person.key === 'unknown' || seenPeople.has(person.key)) {
        return
      }

      seenPeople.add(person.key)
      people.push(person)
    })
  })

  people.sort((left, right) => {
    if (left.key === PODO_KEY) {
      return -1
    }

    if (right.key === PODO_KEY) {
      return 1
    }

    return COLLATOR.compare(left.label, right.label)
  })

  return {
    confidenceLevels: [
      { label: 'All reliability levels', value: 'all' },
      { label: 'High reliability', value: 'high' },
      { label: 'Medium reliability', value: 'medium' },
      { label: 'Low reliability', value: 'low' },
    ],
    locations: unique(events.map((event) => event.location)).sort((left, right) =>
      COLLATOR.compare(left, right),
    ),
    people,
    sources: unique(events.flatMap((event) => event.sources.map((source) => source.id))).map(
      (sourceId) => ({
        label: SOURCE_LABELS[sourceId] || sourceId,
        value: sourceId,
      }),
    ),
  }
}

function buildSummary(events) {
  const knownEvents = events.filter((event) => event.hasKnownTime)

  return {
    evidenceCount: events.reduce((total, event) => total + event.evidenceCount, 0),
    firstSeen: knownEvents[0]?.timestampLabel || 'Unknown',
    lastSeen: knownEvents[knownEvents.length - 1]?.timestampLabel || 'Unknown',
    stopCount: events.length,
  }
}

export function filterRouteEvents(events, filters) {
  return events.filter((event) => {
    if (filters.person !== 'all' && !event.people.some((person) => person.key === filters.person)) {
      return false
    }

    if (filters.location !== 'all' && event.location !== filters.location) {
      return false
    }

    if (filters.source !== 'all' && !event.sourceIds.includes(filters.source)) {
      return false
    }

    if (filters.confidence !== 'all' && event.confidenceLevel !== filters.confidence) {
      return false
    }

    return true
  })
}

export function buildPodoRouteTimeline(records) {
  const evidences = records.map(classifyRecordForRoute).filter(Boolean)
  const groups = buildStarterGroups(evidences)

  attachSupportingEvidence(groups, evidences)

  const events = groups
    .map((group) => buildGroupEvent(group))
    .sort((left, right) => left.timeSort - right.timeSort)

  addConflictFlags(events)

  return {
    events,
    filterOptions: buildFilterOptions(events),
    summary: buildSummary(events),
  }
}