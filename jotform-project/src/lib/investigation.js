const PODO_KEY = 'podo'
const COLLATOR = new Intl.Collator('tr', { sensitivity: 'base' })

const SUSPICION_PATTERNS = [
  {
    label: 'A record references secrecy around a final stop.',
    pattern: /kimse bilmesin|son durak|asil surpriz/,
  },
  {
    label: 'A witness says Podo looked uneasy.',
    pattern: /tedirgin/,
  },
  {
    label: 'A tip reports a suspicious follow-up phone call.',
    pattern: /hallettim/,
  },
  {
    label: 'One source says the two were alone together for a while.',
    pattern: /yalniz kalan|yalniz|uzun sure yalniz/,
  },
]

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

function normalizePersonKey(name) {
  const normalized = normalizeText(name)

  if (!normalized) {
    return ''
  }

  const parts = normalized.split(' ')

  if (parts.length === 1) {
    return parts[0]
  }

  const significantTail = parts.slice(1).filter((part) => part.length > 1)

  return significantTail.length > 0 ? `${parts[0]} ${significantTail[0]}` : parts[0]
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
      record.location,
      record.content,
      ...record.people.map((person) => person.label),
      ...record.participants.map((participant) => participant.role),
    ].join(' '),
  )
}

function normalizeSubmission(source, submission) {
  const values = answerLookup(submission.answers)
  const timestamp = parseTimestamp(values.timestamp)
  const participants = createParticipants(source.id, values).filter((participant) => participant.label)

  return {
    id: `${source.id}:${submission.id}`,
    confidence: values.confidence || null,
    content: buildContent(source.id, values),
    coordinates: parseCoordinates(values.coordinates),
    flags: buildFlags(source.id, values),
    location: values.location || 'Unknown location',
    participants,
    sourceId: source.id,
    sourceLabel: source.label,
    sortTime: timestamp?.getTime() || 0,
    timestamp,
    timestampLabel: formatDateTime(timestamp),
    timeLabel: formatClock(timestamp),
    title: buildTitle(source.id, values),
    values,
  }
}

function createPersonBucket(id) {
  return {
    aliasCounts: new Map(),
    id,
    keywordSignals: new Set(),
    lastWithPodoTime: 0,
    locations: new Set(),
    recordIds: new Set(),
    sourceBreakdown: new Map(),
    tipScore: 0,
    withPodoCount: 0,
  }
}

function pickDisplayName(aliasCounts) {
  return [...aliasCounts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      return COLLATOR.compare(left[0], right[0])
    })[0]?.[0]
}

function buildSuspicionResult(person, relatedRecords, latestPodoTime) {
  if (person.id === PODO_KEY) {
    return {
      classification: 'Missing subject',
      suspicionReasons: ['Podo is the missing subject, not a suspect.'],
      suspicionScore: 0,
      statusTone: 'low',
    }
  }

  let score = person.tipScore
  const reasons = []

  if (person.tipScore >= 6) {
    reasons.push('Anonymous tips point to this person with medium or high confidence.')
  }

  if (person.withPodoCount > 0) {
    score += Math.min(person.withPodoCount * 2, 6)
    reasons.push(`Linked to ${person.withPodoCount} record(s) that directly involve Podo.`)
  }

  if (person.lastWithPodoTime && latestPodoTime - person.lastWithPodoTime <= 25 * 60 * 1000) {
    score += 5
    reasons.push('Appears very late in the confirmed chain before Podo disappears.')
  }

  if (person.locations.size >= 2 && person.withPodoCount >= 2) {
    score += 2
    reasons.push(`Trail follows this person across ${person.locations.size} locations.`)
  }

  if (person.keywordSignals.size > 0) {
    score += person.keywordSignals.size * 2
    reasons.push(...person.keywordSignals)
  }

  if (relatedRecords.some((record) => record.sourceId === 'messages' && record.values.urgency === 'high')) {
    score += 1
  }

  if (reasons.length === 0) {
    reasons.push('No strong suspicious signal yet; this person is mostly contextual.')
  }

  let classification = 'Context'
  let statusTone = 'low'

  if (score >= 12) {
    classification = 'High interest'
    statusTone = 'high'
  } else if (score >= 7) {
    classification = 'Watch closely'
    statusTone = 'medium'
  }

  return {
    classification,
    suspicionReasons: reasons.slice(0, 3),
    suspicionScore: score,
    statusTone,
  }
}

function enrichPeople(records) {
  const buckets = new Map()

  records.forEach((record) => {
    const seenKeys = new Set()
    const normalizedContent = normalizeText(record.content)

    record.participants.forEach((participant) => {
      const key = normalizePersonKey(participant.label)

      if (!key) {
        return
      }

      participant.key = key

      if (!buckets.has(key)) {
        buckets.set(key, createPersonBucket(key))
      }

      const bucket = buckets.get(key)
      bucket.aliasCounts.set(
        participant.label,
        (bucket.aliasCounts.get(participant.label) || 0) + 1,
      )

      if (!seenKeys.has(key)) {
        bucket.recordIds.add(record.id)
        bucket.locations.add(record.location)
        bucket.sourceBreakdown.set(
          record.sourceId,
          (bucket.sourceBreakdown.get(record.sourceId) || 0) + 1,
        )
        seenKeys.add(key)
      }
    })

    record.personKeys = [...seenKeys]
    const includesPodo = record.personKeys.includes(PODO_KEY)

    record.personKeys.forEach((key) => {
      const bucket = buckets.get(key)

      if (!bucket) {
        return
      }

      if (record.sourceId === 'tips' && key === normalizePersonKey(record.values.suspectName)) {
        const confidence = normalizeText(record.confidence)

        if (confidence === 'high') {
          bucket.tipScore += 6
        } else if (confidence === 'medium') {
          bucket.tipScore += 4
        } else if (confidence === 'low') {
          bucket.tipScore += 2
        }
      }

      if (includesPodo && key !== PODO_KEY) {
        bucket.withPodoCount += 1
        bucket.lastWithPodoTime = Math.max(bucket.lastWithPodoTime, record.sortTime)
      }

      SUSPICION_PATTERNS.forEach((signal) => {
        if (signal.pattern.test(normalizedContent)) {
          bucket.keywordSignals.add(signal.label)
        }
      })
    })
  })

  const latestPodoTime = Math.max(
    ...records
      .filter((record) => record.personKeys.includes(PODO_KEY))
      .map((record) => record.sortTime),
    0,
  )

  return [...buckets.values()]
    .map((bucket) => {
      const displayName = pickDisplayName(bucket.aliasCounts) || bucket.id
      const aliases = [...bucket.aliasCounts.keys()].sort((left, right) => COLLATOR.compare(left, right))
      const relatedRecords = records.filter((record) => record.personKeys.includes(bucket.id))
      const suspicion = buildSuspicionResult(
        {
          ...bucket,
          displayName,
        },
        relatedRecords,
        latestPodoTime,
      )

      return {
        aliases,
        displayName,
        id: bucket.id,
        locations: [...bucket.locations].sort((left, right) => COLLATOR.compare(left, right)),
        recordIds: [...bucket.recordIds],
        sourceBreakdown: [...bucket.sourceBreakdown.entries()]
          .sort((left, right) => {
            if (right[1] !== left[1]) {
              return right[1] - left[1]
            }

            return SOURCE_PRIORITY[left[0]] - SOURCE_PRIORITY[right[0]]
          })
          .map(([sourceId, count]) => ({ count, sourceId })),
        withPodoCount: bucket.withPodoCount,
        ...suspicion,
      }
    })
    .sort((left, right) => {
      if (right.suspicionScore !== left.suspicionScore) {
        return right.suspicionScore - left.suspicionScore
      }

      if (right.recordIds.length !== left.recordIds.length) {
        return right.recordIds.length - left.recordIds.length
      }

      return COLLATOR.compare(left.displayName, right.displayName)
    })
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

  const people = enrichPeople(baseRecords)
  const peopleById = new Map(people.map((person) => [person.id, person]))

  const records = baseRecords.map((record) => {
    const peopleForRecord = unique(record.personKeys)
      .map((key) => {
        const person = peopleById.get(key)

        if (!person) {
          return null
        }

        return { key, label: person.displayName }
      })
      .filter(Boolean)

    return {
      ...record,
      participants: record.participants.map((participant) => ({
        ...participant,
        label: peopleById.get(participant.key)?.displayName || participant.label,
      })),
      people: peopleForRecord,
    }
  })

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

  const topSuspect = people.find((person) => person.id !== PODO_KEY) || null

  return {
    lastKnownRecord,
    locations: unique(searchableRecords.map((record) => record.location)).sort((left, right) => COLLATOR.compare(left, right)),
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