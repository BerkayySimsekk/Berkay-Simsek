import { buildSummaryInsights, scorePeople } from './caseInsights.js'
import { resolvePeopleFromRecords } from './personMatching.js'

const PODO_KEY = 'podo'
const COLLATOR = new Intl.Collator('tr', { sensitivity: 'base' })

const SOURCE_PRIORITY = {
  checkins: 0,
  messages: 1,
  notes: 2,
  sightings: 3,
  tips: 4,
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}


function stripDiacritics(value = '') {
  return String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function normalizeText(value = '') {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function answerLookup(answers) {
  return Object.values(answers || {}).reduce((lookup, answer) => {
    if (answer?.name) {
      lookup[answer.name] = answer.answer ?? ''
    }

    return lookup
  }, {})
}

function parseTimestamp(rawValue) {
  const match = String(rawValue || '').match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/)

  if (!match) {
    return null
  }

  const [, day, month, year, hour, minute] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )

  return Number.isNaN(date.getTime()) ? null : date
}

function parseCoordinates(rawValue) {
  const parts = String(rawValue || '')
    .split(',')
    .map((value) => Number(value.trim()))

  if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value))) {
    return null
  }

  return { lat: parts[0], lng: parts[1] }
}

function formatDateTime(date) {
  if (!date) {
    return 'Time unknown'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date)
}

function formatClock(date) {
  if (!date) {
    return 'No time'
  }

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function splitPeopleList(value) {
  return String(value || '')
    .split(/[,;/]/)
    .map((person) => person.trim())
    .filter(Boolean)
}

function createParticipants(sourceId, values) {
  switch (sourceId) {
    case 'checkins':
      return [{ label: values.personName, role: 'subject' }]
    case 'messages':
      return [
        { label: values.senderName, role: 'sender' },
        { label: values.recipientName, role: 'recipient' },
      ]
    case 'sightings':
      return [
        { label: values.personName, role: 'subject' },
        { label: values.seenWith, role: 'seen with' },
      ]
    case 'notes':
      return [
        { label: values.authorName, role: 'author' },
        ...splitPeopleList(values.mentionedPeople).map((person) => ({
          label: person,
          role: 'mentioned',
        })),
      ]
    case 'tips':
      return [{ label: values.suspectName, role: 'suspect' }]
    default:
      return []
  }
}

function buildTitle(sourceId, values) {
  switch (sourceId) {
    case 'checkins':
      return `${values.personName || 'Unknown person'} checked in`
    case 'messages':
      return `${values.senderName || 'Unknown sender'} to ${values.recipientName || 'Unknown recipient'}`
    case 'sightings':
      return `${values.personName || 'Unknown person'} seen with ${values.seenWith || 'unknown companion'}`
    case 'notes':
      return `Note by ${values.authorName || 'Unknown author'}`
    case 'tips':
      return `Anonymous tip about ${values.suspectName || 'unknown suspect'}`
    default:
      return 'Investigation record'
  }
}

function buildContent(sourceId, values) {
  switch (sourceId) {
    case 'messages':
      return values.text || ''
    case 'tips':
      return values.tip || ''
    default:
      return values.note || ''
  }
}

function buildFlags(sourceId, values) {
  if (sourceId === 'messages' && values.urgency) {
    return [{ label: `Urgency: ${values.urgency}`, tone: values.urgency.toLowerCase() }]
  }

  if (sourceId === 'tips' && values.confidence) {
    return [{ label: `Confidence: ${values.confidence}`, tone: values.confidence.toLowerCase() }]
  }

  return []
}

function buildSearchText(record) {
  return normalizeText(
    [
      record.sourceLabel,
      record.title,
      record.rawTitle,
      record.location,
      record.content,
      ...record.people.map((person) => person.label),
      ...record.participants.map((participant) => participant.rawLabel || participant.label),
      ...record.participants.map((participant) => participant.role),
    ].join(' '),
  )
}

function participantLabel(record, role) {
  return record.participants.find((participant) => participant.role === role)?.label || null
}

function buildResolvedTitle(record) {
  switch (record.sourceId) {
    case 'checkins':
      return `${participantLabel(record, 'subject') || 'Unknown person'} checked in`
    case 'messages':
      return `${participantLabel(record, 'sender') || 'Unknown sender'} to ${participantLabel(record, 'recipient') || 'Unknown recipient'}`
    case 'sightings':
      return `${participantLabel(record, 'subject') || 'Unknown person'} seen with ${participantLabel(record, 'seen with') || 'unknown companion'}`
    case 'notes':
      return `Note by ${participantLabel(record, 'author') || 'Unknown author'}`
    case 'tips':
      return `Anonymous tip about ${participantLabel(record, 'suspect') || 'unknown suspect'}`
    default:
      return record.rawTitle || record.title
  }
}

function normalizeSubmission(source, submission) {
  const values = answerLookup(submission.answers)
  const timestamp = parseTimestamp(values.timestamp)
  const participants = createParticipants(source.id, values).filter((participant) => participant.label)
  const rawTitle = buildTitle(source.id, values)

  return {
    id: `${source.id}:${submission.id}`,
    confidence: values.confidence || null,
    content: buildContent(source.id, values),
    coordinates: parseCoordinates(values.coordinates),
    flags: buildFlags(source.id, values),
    location: values.location || 'Unknown location',
    participants,
    rawTitle,
    sourceId: source.id,
    sourceLabel: source.label,
    sortTime: timestamp?.getTime() || 0,
    timestamp,
    timestampLabel: formatDateTime(timestamp),
    timeLabel: formatClock(timestamp),
    title: rawTitle,
    values,
  }
}

function buildConnectedRecordIds(record, recordsById, peopleIndex, locationIndex) {
  const relatedIds = new Set()

  record.personKeys.forEach((key) => {
    const matches = peopleIndex.get(key) || []
    matches.forEach((recordId) => {
      if (recordId !== record.id) {
        relatedIds.add(recordId)
      }
    })
  })

  const locationMatches = locationIndex.get(normalizeText(record.location)) || []

  locationMatches.forEach((recordId) => {
    if (recordId === record.id) {
      return
    }

    const otherRecord = recordsById.get(recordId)

    if (!otherRecord) {
      return
    }

    const closeInTime =
      !record.sortTime || !otherRecord.sortTime
        ? true
        : Math.abs(record.sortTime - otherRecord.sortTime) <= 45 * 60 * 1000

    if (closeInTime) {
      relatedIds.add(recordId)
    }
  })

  return [...relatedIds].sort((left, right) => {
    const leftRecord = recordsById.get(left)
    const rightRecord = recordsById.get(right)

    return (leftRecord?.sortTime || 0) - (rightRecord?.sortTime || 0)
  })
}

export function buildInvestigationModel(loadedSources, sourceErrors) {
  const baseRecords = loadedSources
    .flatMap(({ source, submissions }) => submissions.map((submission) => normalizeSubmission(source, submission)))
    .sort((left, right) => left.sortTime - right.sortTime)

  const { people: basePeople, records: resolvedBaseRecords } = resolvePeopleFromRecords(
    baseRecords,
    SOURCE_PRIORITY,
  )
  const basePeopleById = new Map(basePeople.map((person) => [person.id, person]))

  const recordsForScoring = resolvedBaseRecords.map((record) => {
    const peopleForRecord = unique(record.personKeys)
      .map((key) => {
        const person = basePeopleById.get(key)

        if (!person) {
          return null
        }

        return { key, label: person.displayName }
      })
      .filter(Boolean)

    const resolvedRecord = {
      ...record,
      participants: record.participants.map((participant) => ({
        ...participant,
        label: basePeopleById.get(participant.key)?.displayName || participant.rawLabel || participant.label,
      })),
      people: peopleForRecord,
    }

    return {
      ...resolvedRecord,
      title: buildResolvedTitle(resolvedRecord),
    }
  })

  const people = scorePeople(basePeople, recordsForScoring)
  const peopleById = new Map(people.map((person) => [person.id, person]))

  const records = recordsForScoring.map((record) => ({
    ...(() => {
      const resolvedRecord = {
        ...record,
        participants: record.participants.map((participant) => ({
          ...participant,
          label: peopleById.get(participant.key)?.displayName || participant.rawLabel || participant.label,
        })),
        people: unique(record.personKeys)
          .map((key) => {
            const person = peopleById.get(key)

            if (!person) {
              return null
            }

            return { key, label: person.displayName }
          })
          .filter(Boolean),
      }

      return {
        ...resolvedRecord,
        title: buildResolvedTitle(resolvedRecord),
      }
    })(),
  }))

  const recordsById = new Map(records.map((record) => [record.id, record]))
  const peopleIndex = new Map()
  const locationIndex = new Map()

  records.forEach((record) => {
    record.personKeys.forEach((key) => {
      const list = peopleIndex.get(key) || []
      list.push(record.id)
      peopleIndex.set(key, list)
    })

    const locationKey = normalizeText(record.location)
    const list = locationIndex.get(locationKey) || []
    list.push(record.id)
    locationIndex.set(locationKey, list)
  })

  const searchableRecords = records.map((record) => ({
    ...record,
    relatedRecordIds: buildConnectedRecordIds(record, recordsById, peopleIndex, locationIndex),
    searchText: buildSearchText(record),
  }))
  const finalRecordsById = new Map(searchableRecords.map((record) => [record.id, record]))

  const lastKnownRecord = [...searchableRecords]
    .reverse()
    .find((record) => record.personKeys.includes(PODO_KEY)) || searchableRecords[searchableRecords.length - 1] || null

  const { lastSeenWith, mostSuspicious, topSuspect } = buildSummaryInsights(searchableRecords, people)

  return {
    lastSeenWith,
    lastKnownRecord,
    locations: unique(searchableRecords.map((record) => record.location)).sort((left, right) => COLLATOR.compare(left, right)),
    mostSuspicious,
    people,
    peopleById,
    records: searchableRecords,
    recordsById: finalRecordsById,
    sourceSummary: {
      loaded: loadedSources.length,
      total: loadedSources.length + sourceErrors.length,
    },
    topSuspect,
  }
}