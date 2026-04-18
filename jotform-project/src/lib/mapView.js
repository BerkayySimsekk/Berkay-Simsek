import { normalizeText } from './investigation'

const COLLATOR = new Intl.Collator('tr', { sensitivity: 'base' })
const GROUP_DISTANCE_METERS = 32

const SOURCE_CONFIG = {
  checkins: { eventTypeLabel: 'Check-in', markerType: 'checkins', reliability: 'high' },
  messages: { eventTypeLabel: 'Message', markerType: 'messages', reliability: 'medium' },
  notes: { eventTypeLabel: 'Note', markerType: 'notes', reliability: 'medium' },
  sightings: { eventTypeLabel: 'Sighting', markerType: 'sightings', reliability: 'high' },
  tips: { eventTypeLabel: 'Anonymous tip', markerType: 'tips', reliability: 'low' },
}

const CONFIDENCE_LABELS = {
  high: 'High confidence',
  low: 'Low confidence',
  medium: 'Medium confidence',
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function isValidCoordinates(coordinates) {
  return Boolean(
    coordinates &&
      Number.isFinite(coordinates.lat) &&
      Number.isFinite(coordinates.lng) &&
      coordinates.lat >= -90 &&
      coordinates.lat <= 90 &&
      coordinates.lng >= -180 &&
      coordinates.lng <= 180,
  )
}

function confidenceForRecord(record) {
  if (record.sourceId === 'tips') {
    const value = normalizeText(record.confidence)

    if (value === 'high' || value === 'medium' || value === 'low') {
      return value
    }

    return 'low'
  }

  return SOURCE_CONFIG[record.sourceId]?.reliability || 'medium'
}

function associatedPeople(record) {
  return record.people.filter((person) => person.key && person.key !== 'unknown')
}

function primaryPerson(record) {
  const people = associatedPeople(record)

  return people.find((person) => person.key !== 'podo') || people[0] || null
}

function secondaryPeople(record) {
  const people = associatedPeople(record)
  const primary = primaryPerson(record)

  return people.filter((person) => person.key !== primary?.key)
}

function createMapEvent(record) {
  if (!isValidCoordinates(record.coordinates)) {
    return null
  }

  const source = SOURCE_CONFIG[record.sourceId] || {
    eventTypeLabel: 'Record',
    markerType: 'notes',
    reliability: 'medium',
  }
  const primary = primaryPerson(record)
  const secondary = secondaryPeople(record)
  const confidenceLevel = confidenceForRecord(record)

  return {
    associatedPersonLabel: primary?.label || 'Unknown person',
    confidenceLabel: CONFIDENCE_LABELS[confidenceLevel],
    confidenceLevel,
    id: record.id,
    lat: record.coordinates.lat,
    lng: record.coordinates.lng,
    location: record.location,
    locationKey: normalizeText(record.location),
    markerType: source.markerType,
    people: associatedPeople(record),
    secondaryPeople: secondary,
    sourceId: record.sourceId,
    sourceLabel: record.sourceLabel,
    summary: record.content || record.title,
    timeSort: record.sortTime || Number.POSITIVE_INFINITY,
    timestampLabel: record.timestampLabel,
    title: record.title,
    typeLabel: source.eventTypeLabel,
  }
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function distanceMeters(left, right) {
  const earthRadius = 6371000
  const deltaLat = toRadians(right.lat - left.lat)
  const deltaLng = toRadians(right.lng - left.lng)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(left.lat)) *
      Math.cos(toRadians(right.lat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadius * c
}

function createGroup(event) {
  return {
    events: [event],
    id: `marker-group:${event.id}`,
    lat: event.lat,
    lng: event.lng,
    location: event.location,
    locationKey: event.locationKey,
  }
}

function addToGroup(group, event) {
  group.events.push(event)
  const count = group.events.length

  group.lat = (group.lat * (count - 1) + event.lat) / count
  group.lng = (group.lng * (count - 1) + event.lng) / count
}

function findGroup(groups, event) {
  let closestGroup = null
  let closestDistance = Number.POSITIVE_INFINITY

  groups.forEach((group) => {
    const distance = distanceMeters(group, event)
    const sameLocation = group.locationKey && group.locationKey === event.locationKey

    if ((sameLocation || distance <= GROUP_DISTANCE_METERS) && distance < closestDistance) {
      closestGroup = group
      closestDistance = distance
    }
  })

  return closestGroup
}

function markerTypeForGroup(events) {
  const markerTypes = unique(events.map((event) => event.markerType))

  return markerTypes.length === 1 ? markerTypes[0] : 'mixed'
}

function confidenceForGroup(events) {
  const scores = { high: 3, low: 1, medium: 2 }
  const average =
    events.reduce((total, event) => total + scores[event.confidenceLevel], 0) / events.length

  if (average >= 2.5) {
    return 'high'
  }

  if (average >= 1.5) {
    return 'medium'
  }

  return 'low'
}

function markerLabelForGroup(events) {
  if (events.length > 1) {
    return String(events.length)
  }

  return events[0].associatedPersonLabel.charAt(0).toUpperCase()
}

function buildMarkerGroup(group) {
  const events = [...group.events].sort((left, right) => left.timeSort - right.timeSort)
  const sourceIds = unique(events.map((event) => event.sourceId)).sort((left, right) =>
    COLLATOR.compare(left, right),
  )

  return {
    confidenceLevel: confidenceForGroup(events),
    eventCount: events.length,
    events,
    id: group.id,
    label: markerLabelForGroup(events),
    lat: group.lat,
    lng: group.lng,
    location: group.location,
    markerType: markerTypeForGroup(events),
    sourceIds,
  }
}

export function buildMapViewModel(records) {
  const invalidRecordCount = records.filter((record) => !isValidCoordinates(record.coordinates)).length
  const mapEvents = records.map(createMapEvent).filter(Boolean).sort((left, right) => left.timeSort - right.timeSort)
  const groups = []

  mapEvents.forEach((event) => {
    const group = findGroup(groups, event)

    if (group) {
      addToGroup(group, event)
      return
    }

    groups.push(createGroup(event))
  })

  const markerGroups = groups
    .map(buildMarkerGroup)
    .sort((left, right) => left.events[0].timeSort - right.events[0].timeSort)

  return {
    invalidRecordCount,
    locationCount: unique(mapEvents.map((event) => event.location)).length,
    mappedRecordCount: mapEvents.length,
    markerGroups,
    sourceTypes: unique(mapEvents.map((event) => event.sourceId)).sort((left, right) =>
      COLLATOR.compare(left, right),
    ),
  }
}