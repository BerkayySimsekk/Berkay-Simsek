const PODO_KEY = 'podo'
const COLLATOR = new Intl.Collator('tr', { sensitivity: 'base' })

const SOURCE_SUSPICION_WEIGHTS = {
  checkins: 2,
  messages: 2,
  notes: 2,
  sightings: 4,
  tips: 1,
}

const TIP_CONFIDENCE_WEIGHTS = {
  high: 6,
  low: 2,
  medium: 4,
}

const LAST_SEEN_SOURCE_PRIORITY = {
  notes: 1,
  sightings: 0,
}

const LATE_STAGE_WINDOW_MS = 25 * 60 * 1000
const CORROBORATION_WINDOW_MS = 18 * 60 * 1000
const CONFLICT_WINDOW_MS = 10 * 60 * 1000

const SECRECY_PATTERNS = [
  /kimse bilmesin/,
  /son durak/,
  /son nokta/,
  /asil surpriz/,
  /gizemli/,
]

const LURE_PATTERNS = [
  /kalabaliktan biraz uzaklasalim/,
  /bir yere gececegini/,
  /bir yere gecelim/,
  /son nokta/,
  /son durak/,
  /surpriz gosterecegim/,
]

const DOWNPLAY_PATTERNS = [/yanlis anlasildi/, /sadece/, /abartildi/, /sorun yok/, /degilim/]

const TOGETHER_PATTERNS = [
  /birlikte/,
  /beraber/,
  /yaninda/,
  /ile/,
  /yuruduk/,
  /gordum/,
  /goruldu/,
  /kaleye cikan/,
]

function stripDiacritics(value = '') {
  return String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function normalizeText(value = '') {
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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function hasKnownTime(record) {
  return Number.isFinite(record.sortTime) && record.sortTime > 0
}

function contentText(record) {
  return normalizeText(
    [record.title, record.content, record.values?.note, record.values?.text].filter(Boolean).join(' '),
  )
}

function sortByRecentEvidence(left, right) {
  if (right.sortTime !== left.sortTime) {
    return right.sortTime - left.sortTime
  }

  return (LAST_SEEN_SOURCE_PRIORITY[left.sourceId] || 0) - (LAST_SEEN_SOURCE_PRIORITY[right.sourceId] || 0)
}

function isSecrecyRecord(record) {
  const normalized = contentText(record)

  return SECRECY_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isLureMessage(record) {
  if (record.sourceId !== 'messages') {
    return false
  }

  const normalized = contentText(record)

  return LURE_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isDownplayRecord(record) {
  const normalized = contentText(record)

  return DOWNPLAY_PATTERNS.some((pattern) => pattern.test(normalized))
}

function activeParticipantKeys(record) {
  switch (record.sourceId) {
    case 'checkins':
      return [normalizePersonKey(record.values?.personName)]
    case 'messages':
      return [
        normalizePersonKey(record.values?.senderName),
        normalizePersonKey(record.values?.recipientName),
      ]
    case 'sightings':
      return [
        normalizePersonKey(record.values?.personName),
        normalizePersonKey(record.values?.seenWith),
      ]
    case 'notes':
      return [normalizePersonKey(record.values?.authorName)]
    case 'tips':
      return [normalizePersonKey(record.values?.suspectName)]
    default:
      return []
  }
}

function relevantRecordsForPerson(records, personId) {
  return records.filter((record) => record.personKeys.includes(personId))
}

function directlyInvolvesPerson(record, personId) {
  return activeParticipantKeys(record).includes(personId)
}

function locationKey(value = '') {
  return normalizeText(value)
}

function sourceWeight(record) {
  return SOURCE_SUSPICION_WEIGHTS[record.sourceId] || 1
}

function findLatestConfirmedPodoTime(records) {
  return records.reduce((latest, record) => {
    if (!record.personKeys.includes(PODO_KEY)) {
      return latest
    }

    if (!hasKnownTime(record)) {
      return latest
    }

    if (record.sourceId !== 'sightings' && record.sourceId !== 'checkins') {
      return latest
    }

    return Math.max(latest, record.sortTime)
  }, 0)
}

function buildSignal(points, reason) {
  return { points, reason }
}

function classifySuspicion(score) {
  if (score >= 14) {
    return { classification: 'High interest', statusTone: 'high' }
  }

  if (score >= 8) {
    return { classification: 'Watch closely', statusTone: 'medium' }
  }

  return { classification: 'Context', statusTone: 'low' }
}

function findContradictionCount(relatedRecords) {
  const downplayRecords = relatedRecords.filter(isDownplayRecord)
  const concerningRecords = relatedRecords.filter(
    (record) => record.sourceId === 'tips' || isSecrecyRecord(record),
  )

  return downplayRecords.length > 0 && concerningRecords.length > 0
    ? Math.min(downplayRecords.length, concerningRecords.length)
    : 0
}

function buildSuspicionForPerson(person, records, latestConfirmedPodoTime) {
  const relatedRecords = relevantRecordsForPerson(records, person.id)
  const withPodoRecords = relatedRecords.filter((record) =>
    record.personKeys.includes(PODO_KEY),
  )
  const tipRecords = relatedRecords.filter(
    (record) =>
      record.sourceId === 'tips' && normalizePersonKey(record.values?.suspectName) === person.id,
  )
  const secrecyRecords = relatedRecords.filter(isSecrecyRecord)
  const lureMessages = relatedRecords.filter(
    (record) => directlyInvolvesPerson(record, person.id) && isLureMessage(record),
  )
  const lateStageRecords = withPodoRecords.filter(
    (record) =>
      latestConfirmedPodoTime > 0 &&
      hasKnownTime(record) &&
      latestConfirmedPodoTime - record.sortTime <= LATE_STAGE_WINDOW_MS,
  )
  const contradictionCount = findContradictionCount(relatedRecords)
  const podoLocationCount = unique(withPodoRecords.map((record) => record.location)).length
  const proximityScore = Math.min(
    withPodoRecords.reduce((total, record) => total + sourceWeight(record), 0),
    12,
  )
  const tipScore = tipRecords.reduce((total, record) => {
    const confidence = normalizeText(record.confidence)

    return total + (TIP_CONFIDENCE_WEIGHTS[confidence] || TIP_CONFIDENCE_WEIGHTS.low)
  }, 0)
  const signals = []
  let score = 0

  if (tipScore > 0) {
    score += tipScore
    signals.push(
      buildSignal(
        tipScore,
        `Flagged in ${tipRecords.length} anonymous tip${tipRecords.length === 1 ? '' : 's'} with weighted confidence.`,
      ),
    )
  }

  if (proximityScore > 0) {
    score += proximityScore
    signals.push(
      buildSignal(
        proximityScore,
        `Appears with Podo in ${withPodoRecords.length} linked record${withPodoRecords.length === 1 ? '' : 's'}.`,
      ),
    )
  }

  if (lateStageRecords.length > 0) {
    const points = lateStageRecords.some((record) => record.sourceId === 'sightings') ? 5 : 3

    score += points
    signals.push(
      buildSignal(
        points,
        'Shows up in the final, most recent stage before Podo disappears.',
      ),
    )
  }

  if (secrecyRecords.length > 0) {
    const points = Math.min(secrecyRecords.length * 2, 6)

    score += points
    signals.push(
      buildSignal(points, 'Linked records contain secrecy or final-stop language.'),
    )
  }

  if (lureMessages.length > 0) {
    const points = Math.min(lureMessages.length * 2, 4)

    score += points
    signals.push(
      buildSignal(points, 'Message trail suggests attempts to move Podo away from the crowd.'),
    )
  }

  if (contradictionCount > 0) {
    const points = Math.min(contradictionCount * 2, 4)

    score += points
    signals.push(
      buildSignal(points, 'Their records contain downplaying or inconsistent context.'),
    )
  }

  if (podoLocationCount >= 2 && withPodoRecords.length >= 2) {
    score += 2
    signals.push(
      buildSignal(2, `Trail follows this person and Podo across ${podoLocationCount} locations.`),
    )
  }

  if (signals.length === 0) {
    signals.push(buildSignal(0, 'No strong suspicious pattern stands out yet.'))
  }

  const rankedSignals = [...signals].sort((left, right) => right.points - left.points)
  const { classification, statusTone } = classifySuspicion(score)

  return {
    classification,
    statusTone,
    suspicionMetrics: {
      contradictionCount,
      lateStageCount: lateStageRecords.length,
      lureMessageCount: lureMessages.length,
      secrecyCount: secrecyRecords.length,
      tipCount: tipRecords.length,
      withPodoCount: withPodoRecords.length,
    },
    suspicionReasons: rankedSignals.slice(0, 3).map((signal) => signal.reason),
    suspicionScore: score,
    withPodoCount: withPodoRecords.length,
  }
}

export function scorePeople(people, records) {
  const latestConfirmedPodoTime = findLatestConfirmedPodoTime(records)

  return people
    .map((person) => {
      if (person.id === PODO_KEY) {
        return {
          ...person,
          classification: 'Missing subject',
          statusTone: 'low',
          suspicionMetrics: {
            contradictionCount: 0,
            lateStageCount: 0,
            lureMessageCount: 0,
            secrecyCount: 0,
            tipCount: 0,
            withPodoCount: 0,
          },
          suspicionReasons: ['Podo is the missing subject, not a suspect.'],
          suspicionScore: 0,
          withPodoCount: 0,
        }
      }

      return {
        ...person,
        ...buildSuspicionForPerson(person, records, latestConfirmedPodoTime),
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

function personNameTokens(person) {
  return unique(
    [person.displayName, ...(person.aliases || [])]
      .flatMap((value) => normalizeText(value).split(' '))
      .filter((token) => token.length > 1),
  )
}

function recordMentionsPerson(record, person) {
  const normalized = contentText(record)
  const tokens = personNameTokens(person)

  return tokens.some((token) => normalized.includes(token))
}

function noteCompanionKeys(record, peopleById) {
  const normalized = contentText(record)
  const authorKey = normalizePersonKey(record.values?.authorName)
  const otherPeople = record.personKeys.filter((key) => key !== PODO_KEY)
  const companions = new Set()

  if (authorKey && authorKey !== PODO_KEY && TOGETHER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    companions.add(authorKey)
  }

  otherPeople.forEach((key) => {
    const person = peopleById.get(key)

    if (!person || key === authorKey || !recordMentionsPerson(record, person)) {
      return
    }

    if (TOGETHER_PATTERNS.some((pattern) => pattern.test(normalized))) {
      companions.add(key)
    }
  })

  return [...companions]
}

function extractCompanionKeys(record, peopleById) {
  if (!record.personKeys.includes(PODO_KEY)) {
    return []
  }

  if (record.sourceId === 'sightings') {
    return record.personKeys.filter((key) => key !== PODO_KEY)
  }

  if (record.sourceId === 'notes') {
    return noteCompanionKeys(record, peopleById)
  }

  return []
}

function buildLastSeenCandidate(record, personId, peopleById) {
  const person = peopleById.get(personId)

  if (!person || !hasKnownTime(record)) {
    return null
  }

  return {
    confirmed: record.sourceId === 'sightings',
    location: record.location,
    personId,
    personName: person.displayName,
    recordId: record.id,
    sortTime: record.sortTime,
    sourceId: record.sourceId,
    sourceLabel: record.sourceLabel,
    statusTone: record.sourceId === 'sightings' ? 'high' : 'medium',
    timestampLabel: record.timestampLabel,
  }
}

function findCorroboratingRecords(candidate, records, peopleById) {
  const person = peopleById.get(candidate.personId)

  return records
    .filter((record) => {
      if (record.id === candidate.recordId || !hasKnownTime(record)) {
        return false
      }

      if (!record.personKeys.includes(PODO_KEY)) {
        return false
      }

      if (Math.abs(record.sortTime - candidate.sortTime) > CORROBORATION_WINDOW_MS) {
        return false
      }

      const sameLocation = locationKey(record.location) === locationKey(candidate.location)
      const sameCompanion = record.personKeys.includes(candidate.personId)

      return sameLocation && (sameCompanion || recordMentionsPerson(record, person))
    })
    .sort(sortByRecentEvidence)
}

function findConflictingCandidates(candidate, candidates) {
  return candidates.filter(
    (entry) =>
      entry.recordId !== candidate.recordId &&
      entry.personId !== candidate.personId &&
      Math.abs(entry.sortTime - candidate.sortTime) <= CONFLICT_WINDOW_MS,
  )
}

function buildLastSeenWithInsight(records, peopleById) {
  const candidates = records
    .flatMap((record) =>
      extractCompanionKeys(record, peopleById).map((personId) =>
        buildLastSeenCandidate(record, personId, peopleById),
      ),
    )
    .filter(Boolean)
    .sort(sortByRecentEvidence)

  const confirmedCandidates = candidates.filter((candidate) => candidate.confirmed)
  const chosen = confirmedCandidates[0] || candidates[0] || null

  if (!chosen) {
    return null
  }

  const corroboratingRecords = findCorroboratingRecords(chosen, records, peopleById)
  const conflicts = findConflictingCandidates(chosen, confirmedCandidates)
  const statusTone =
    chosen.confirmed && conflicts.length === 0
      ? 'high'
      : chosen.confirmed
        ? 'medium'
        : 'low'
  const explanationParts = [
    chosen.confirmed
      ? `Latest confirmed sighting puts Podo with ${chosen.personName} at ${chosen.location} on ${chosen.timestampLabel}.`
      : `Best available evidence places Podo with ${chosen.personName} at ${chosen.location} on ${chosen.timestampLabel}.`,
  ]

  if (corroboratingRecords.length > 0) {
    explanationParts.push(
      `${corroboratingRecords.length} nearby corroborating record${corroboratingRecords.length === 1 ? '' : 's'} support the same pairing.`,
    )
  }

  if (conflicts.length > 0) {
    explanationParts.push(
      'Another late sighting names someone else nearby, so treat this as the strongest lead rather than absolute certainty.',
    )
  }

  return {
    explanation: explanationParts.join(' '),
    location: chosen.location,
    personId: chosen.personId,
    personName: chosen.personName,
    recordId: chosen.recordId,
    sourceLabel: chosen.sourceLabel,
    statusTone,
    supportingRecordIds: corroboratingRecords.map((record) => record.id),
    supportCount: corroboratingRecords.length,
    timestampLabel: chosen.timestampLabel,
  }
}

export function buildSummaryInsights(records, people) {
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const topSuspect = people.find((person) => person.id !== PODO_KEY) || null
  const lastSeenWith = buildLastSeenWithInsight(records, peopleById)

  return {
    lastSeenWith,
    mostSuspicious: topSuspect
      ? {
          explanation: topSuspect.suspicionReasons.join(' '),
          personId: topSuspect.id,
          personName: topSuspect.displayName,
          score: topSuspect.suspicionScore,
          statusTone: topSuspect.statusTone,
          summaryLabel: topSuspect.classification,
          tipCount: topSuspect.suspicionMetrics.tipCount,
          withPodoCount: topSuspect.withPodoCount,
        }
      : null,
    topSuspect,
  }
}