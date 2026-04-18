const COLLATOR = new Intl.Collator('tr', { sensitivity: 'base' })
const MERGE_THRESHOLD = 72
const UNCERTAIN_THRESHOLD = 60
const STRONG_EDGE_THRESHOLD = 66

const GENERIC_ALIAS_KEYS = new Set([
  'anonymous',
  'anonim',
  'event staff',
  'staff',
  'someone',
  'unknown',
])

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

function normalizeAliasKey(value = '') {
  return normalizeText(value)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function levenshteinDistance(left, right) {
  const source = left || ''
  const target = right || ''

  if (source === target) {
    return 0
  }

  if (source.length === 0) {
    return target.length
  }

  if (target.length === 0) {
    return source.length
  }

  const previous = Array.from({ length: target.length + 1 }, (_, index) => index)
  const current = new Array(target.length + 1).fill(0)

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    current[0] = sourceIndex

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const cost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1

      current[targetIndex] = Math.min(
        current[targetIndex - 1] + 1,
        previous[targetIndex] + 1,
        previous[targetIndex - 1] + cost,
      )
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index]
    }
  }

  return previous[target.length]
}

function stringSimilarity(left = '', right = '') {
  if (!left || !right) {
    return 0
  }

  if (left === right) {
    return 1
  }

  const distance = levenshteinDistance(left, right)
  const longest = Math.max(left.length, right.length)

  return longest === 0 ? 1 : 1 - distance / longest
}

function isInitialToken(token = '') {
  return token.length === 1
}

function meaningfulTokens(tokens) {
  return tokens.filter((token) => token.length > 1)
}

function firstToken(profile) {
  return profile.tokens[0] || ''
}

function lastToken(profile) {
  return profile.tokens[profile.tokens.length - 1] || ''
}

function hasFullFirstName(profile) {
  return firstToken(profile).length > 1
}

function hasFullLastName(profile) {
  return profile.tokens.length > 1 && lastToken(profile).length > 1
}

function prefixCompatible(left = '', right = '') {
  if (!left || !right) {
    return false
  }

  const shorter = left.length <= right.length ? left : right
  const longer = shorter === left ? right : left

  return shorter.length >= 3 && longer.startsWith(shorter)
}

function initialCompatible(left = '', right = '') {
  if (!left || !right) {
    return false
  }

  return (isInitialToken(left) && right.startsWith(left)) || (isInitialToken(right) && left.startsWith(right))
}

function tokenCompatible(left = '', right = '', threshold = 0.88) {
  return (
    left === right ||
    prefixCompatible(left, right) ||
    initialCompatible(left, right) ||
    stringSimilarity(left, right) >= threshold
  )
}

function tokenOverlapRatio(leftTokens, rightTokens) {
  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  const overlap = [...leftSet].filter((token) => rightSet.has(token)).length
  const union = new Set([...leftSet, ...rightSet]).size

  return union === 0 ? 0 : overlap / union
}

function intersectionSize(leftValues, rightValues) {
  const leftSet = leftValues instanceof Set ? leftValues : new Set(leftValues)
  const rightSet = rightValues instanceof Set ? rightValues : new Set(rightValues)

  return [...leftSet].filter((value) => rightSet.has(value)).length
}

function sortUnique(values) {
  return unique(values).sort((left, right) => COLLATOR.compare(left, right))
}

function locationKey(value = '') {
  return normalizeText(value)
}

function createAliasProfile(aliasKey) {
  const tokens = aliasKey.split(' ').filter(Boolean)

  return {
    aliasKey,
    coAliasKeys: new Set(),
    locationKeys: new Set(),
    locations: new Set(),
    mentionCount: 0,
    observations: [],
    rawLabels: new Map(),
    recordIds: new Set(),
    roles: new Set(),
    sourceCounts: new Map(),
    sourceIds: new Set(),
    tokens,
  }
}

function buildObservationProfiles(records) {
  const profiles = new Map()

  records.forEach((record) => {
    const aliasKeys = record.participants.map((participant) => normalizeAliasKey(participant.label))

    record.participants.forEach((participant, index) => {
      const rawLabel = String(participant.label || '').trim()
      const aliasKey = aliasKeys[index]

      if (!aliasKey) {
        return
      }

      if (!profiles.has(aliasKey)) {
        profiles.set(aliasKey, createAliasProfile(aliasKey))
      }

      const profile = profiles.get(aliasKey)
      profile.mentionCount += 1
      profile.rawLabels.set(rawLabel, (profile.rawLabels.get(rawLabel) || 0) + 1)
      profile.recordIds.add(record.id)
      profile.locations.add(record.location)
      profile.locationKeys.add(locationKey(record.location))
      profile.sourceIds.add(record.sourceId)
      profile.sourceCounts.set(record.sourceId, (profile.sourceCounts.get(record.sourceId) || 0) + 1)
      profile.roles.add(participant.role)
      profile.observations.push({
        locationKey: locationKey(record.location),
        sortTime: record.sortTime || 0,
      })

      aliasKeys.forEach((otherAliasKey, otherIndex) => {
        if (!otherAliasKey || otherIndex === index || otherAliasKey === aliasKey) {
          return
        }

        profile.coAliasKeys.add(otherAliasKey)
      })
    })
  })

  return [...profiles.values()].sort((left, right) => COLLATOR.compare(left.aliasKey, right.aliasKey))
}

function aliasRichness(rawLabel = '') {
  const normalized = normalizeAliasKey(rawLabel)
  const tokens = normalized.split(' ').filter(Boolean)

  return meaningfulTokens(tokens).length * 24 + normalized.length - tokens.filter(isInitialToken).length * 8
}

function pickPreferredAlias(rawLabels) {
  return [...rawLabels.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      const richnessGap = aliasRichness(right[0]) - aliasRichness(left[0])

      if (richnessGap !== 0) {
        return richnessGap
      }

      return COLLATOR.compare(left[0], right[0])
    })[0]?.[0] || ''
}

function isGenericAlias(profile) {
  return GENERIC_ALIAS_KEYS.has(profile.aliasKey)
}

function oneUsesTrailingInitial(left, right) {
  const leftLast = lastToken(left)
  const rightLast = lastToken(right)

  return (
    firstToken(left) === firstToken(right) &&
    ((left.tokens.length === 1 && right.tokens.length === 2 && isInitialToken(rightLast)) ||
      (right.tokens.length === 1 && left.tokens.length === 2 && isInitialToken(leftLast)))
  )
}

function oneUsesLeadingInitial(left, right) {
  return (
    hasFullLastName(left) &&
    hasFullLastName(right) &&
    lastToken(left) === lastToken(right) &&
    initialCompatible(firstToken(left), firstToken(right))
  )
}

function nearbyObservationSupport(left, right) {
  return left.observations.some((leftObservation) => {
    if (!leftObservation.sortTime) {
      return false
    }

    return right.observations.some(
      (rightObservation) =>
        rightObservation.sortTime &&
        leftObservation.locationKey === rightObservation.locationKey &&
        Math.abs(leftObservation.sortTime - rightObservation.sortTime) <= 60 * 60 * 1000,
    )
  })
}

function buildReasonList(reasons) {
  return sortUnique(reasons).slice(0, 4)
}

function scoreNameProfiles(left, right) {
  if (left.aliasKey === right.aliasKey) {
    return {
      hardConflict: false,
      nameScore: 100,
      reasons: ['Normalized name forms are identical.'],
    }
  }

  if (isGenericAlias(left) || isGenericAlias(right)) {
    return {
      hardConflict: true,
      nameScore: 0,
      reasons: [],
    }
  }

  const reasons = []
  let nameScore = 0
  let hardConflict = false
  const fullSimilarity = stringSimilarity(left.aliasKey, right.aliasKey)
  const firstCompatible = tokenCompatible(firstToken(left), firstToken(right), 0.9)
  const lastCompatible = tokenCompatible(lastToken(left), lastToken(right), 0.92)
  const overlapRatio = tokenOverlapRatio(meaningfulTokens(left.tokens), meaningfulTokens(right.tokens))
  const initialsMatch = left.tokens.map((token) => token[0]).join('') === right.tokens.map((token) => token[0]).join('')

  if (hasFullLastName(left) && hasFullLastName(right) && firstCompatible && lastCompatible) {
    nameScore += 56
    reasons.push('First and last name tokens line up.')
  } else if (oneUsesLeadingInitial(left, right)) {
    nameScore += 54
    reasons.push('Surname and first initial line up.')
  } else if (oneUsesTrailingInitial(left, right)) {
    nameScore += 52
    reasons.push('One record uses a trailing initial for the same first name.')
  } else if (left.tokens.length === 1 && right.tokens.length === 1 && fullSimilarity >= 0.88) {
    nameScore += 50
    reasons.push('Single-name spellings are very similar.')
  } else if (firstCompatible && !hasFullLastName(left) && !hasFullLastName(right)) {
    nameScore += 24
    reasons.push('Single-name forms look similar.')
  } else if (firstCompatible && (left.tokens.length === 1 || right.tokens.length === 1)) {
    nameScore += 22
    reasons.push('One record uses a partial form of the same first name.')
  }

  if (fullSimilarity >= 0.94) {
    nameScore += 24
    reasons.push('Overall spelling is nearly identical.')
  } else if (fullSimilarity >= 0.86) {
    nameScore += 16
    reasons.push('Overall spelling is close.')
  } else if (fullSimilarity >= 0.78) {
    nameScore += 8
    reasons.push('Only a small spelling difference is present.')
  }

  if (overlapRatio >= 0.5) {
    nameScore += 12
    reasons.push('Name tokens overlap strongly.')
  }

  if (initialsMatch && left.tokens.length > 1 && right.tokens.length > 1) {
    nameScore += 8
    reasons.push('Initial patterns match.')
  }

  if (hasFullLastName(left) && hasFullLastName(right) && !lastCompatible) {
    nameScore -= 32
    hardConflict = true
  }

  if (hasFullFirstName(left) && hasFullFirstName(right) && !firstCompatible && lastCompatible) {
    nameScore -= 12
  }

  if (left.tokens.length === 1 && right.tokens.length === 1 && Math.max(left.aliasKey.length, right.aliasKey.length) <= 3 && fullSimilarity < 0.95) {
    nameScore -= 20
  }

  if (overlapRatio === 0 && fullSimilarity < 0.7) {
    nameScore -= 18
  }

  return {
    hardConflict,
    nameScore: clamp(nameScore, 0, 100),
    reasons: buildReasonList(reasons),
  }
}

function scoreContextSignals(left, right) {
  const reasons = []
  let contextScore = 0
  const sharedLocations = intersectionSize(left.locationKeys, right.locationKeys)
  const sharedCoPeople = intersectionSize(left.coAliasKeys, right.coAliasKeys)
  const sharedSources = intersectionSize(left.sourceIds, right.sourceIds)

  if (sharedLocations > 0) {
    contextScore += Math.min(sharedLocations * 6, 12)
    reasons.push('The records share locations.')
  }

  if (sharedCoPeople > 0) {
    contextScore += Math.min(sharedCoPeople * 5, 10)
    reasons.push('The records repeatedly involve the same people.')
  }

  if (nearbyObservationSupport(left, right)) {
    contextScore += 8
    reasons.push('The records appear close in time at the same place.')
  }

  if (sharedSources > 1 && sharedLocations > 0) {
    contextScore += 4
    reasons.push('The overlap appears in more than one source type.')
  }

  return {
    contextScore,
    reasons: buildReasonList(reasons),
  }
}

function scoreAliasPair(left, right) {
  const nameSignals = scoreNameProfiles(left, right)
  const contextSignals = scoreContextSignals(left, right)
  const score = clamp(nameSignals.nameScore + contextSignals.contextScore, 0, 100)
  const mergeDecision =
    score >= MERGE_THRESHOLD && (nameSignals.nameScore >= 54 || contextSignals.contextScore >= 20)
      ? 'merge'
      : score >= UNCERTAIN_THRESHOLD && nameSignals.nameScore >= 36
        ? 'uncertain'
        : 'reject'

  return {
    contextScore: contextSignals.contextScore,
    decision: mergeDecision,
    hardConflict: nameSignals.hardConflict,
    nameScore: nameSignals.nameScore,
    reasons: buildReasonList([...nameSignals.reasons, ...contextSignals.reasons]),
    score,
  }
}

function pairKey(leftIndex, rightIndex) {
  return leftIndex < rightIndex ? `${leftIndex}:${rightIndex}` : `${rightIndex}:${leftIndex}`
}

function createUnionFind(size) {
  const parent = Array.from({ length: size }, (_, index) => index)

  function find(index) {
    if (parent[index] === index) {
      return index
    }

    parent[index] = find(parent[index])
    return parent[index]
  }

  function union(left, right) {
    const leftRoot = find(left)
    const rightRoot = find(right)

    if (leftRoot === rightRoot) {
      return leftRoot
    }

    parent[rightRoot] = leftRoot
    return leftRoot
  }

  return { find, union }
}

function buildPairScores(profiles) {
  const edges = []
  const lookup = new Map()

  for (let leftIndex = 0; leftIndex < profiles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < profiles.length; rightIndex += 1) {
      const score = scoreAliasPair(profiles[leftIndex], profiles[rightIndex])
      const edge = {
        leftIndex,
        rightIndex,
        ...score,
      }

      lookup.set(pairKey(leftIndex, rightIndex), edge)
      edges.push(edge)
    }
  }

  return {
    edges: edges.sort((left, right) => right.score - left.score),
    lookup,
  }
}

function bestCrossScore(clusterMembers, candidateMembers, scoreLookup) {
  return clusterMembers.reduce((bestScore, memberIndex) => {
    const memberBest = candidateMembers.reduce((currentBest, candidateIndex) => {
      const edge = scoreLookup.get(pairKey(memberIndex, candidateIndex))

      return Math.max(currentBest, edge?.score || 0)
    }, 0)

    return Math.min(bestScore, memberBest)
  }, Number.POSITIVE_INFINITY)
}

function canMergeClusters(leftMembers, rightMembers, scoreLookup) {
  const smallerCluster = leftMembers.length <= rightMembers.length ? leftMembers : rightMembers
  const largerCluster = smallerCluster === leftMembers ? rightMembers : leftMembers
  const minimumCrossScore = bestCrossScore(smallerCluster, largerCluster, scoreLookup)

  if (minimumCrossScore < STRONG_EDGE_THRESHOLD) {
    return false
  }

  return !leftMembers.some((leftIndex) =>
    rightMembers.some((rightIndex) => {
      const edge = scoreLookup.get(pairKey(leftIndex, rightIndex))

      return Boolean(edge?.hardConflict && edge.score < UNCERTAIN_THRESHOLD)
    }),
  )
}

function buildClusters(profiles, scoreData) {
  const unionFind = createUnionFind(profiles.length)
  const clusterMembers = new Map(profiles.map((_, index) => [index, [index]]))

  scoreData.edges
    .filter((edge) => edge.decision === 'merge')
    .forEach((edge) => {
      const leftRoot = unionFind.find(edge.leftIndex)
      const rightRoot = unionFind.find(edge.rightIndex)

      if (leftRoot === rightRoot) {
        return
      }

      const leftMembers = clusterMembers.get(leftRoot) || [leftRoot]
      const rightMembers = clusterMembers.get(rightRoot) || [rightRoot]

      if (!canMergeClusters(leftMembers, rightMembers, scoreData.lookup)) {
        return
      }

      const mergedRoot = unionFind.union(leftRoot, rightRoot)
      const mergedMembers = [...leftMembers, ...rightMembers]
      clusterMembers.delete(leftRoot)
      clusterMembers.delete(rightRoot)
      clusterMembers.set(mergedRoot, mergedMembers)
    })

  const byRoot = new Map()

  profiles.forEach((profile, index) => {
    const root = unionFind.find(index)
    const existing = byRoot.get(root) || []
    existing.push({ index, profile })
    byRoot.set(root, existing)
  })

  return [...byRoot.values()]
}

function clusterConfidenceTone(internalEdges) {
  if (internalEdges.length === 0) {
    return 'high'
  }

  const average = internalEdges.reduce((total, edge) => total + edge.score, 0) / internalEdges.length

  if (average >= 88) {
    return 'high'
  }

  if (average >= 78) {
    return 'medium'
  }

  return 'low'
}

function confidenceLabel(tone) {
  if (tone === 'high') {
    return 'High confidence'
  }

  if (tone === 'medium') {
    return 'Medium confidence'
  }

  return 'Low confidence'
}

function buildClusterAliasDetails(cluster, primaryEntry, scoreLookup) {
  return cluster
    .map(({ index, profile }) => {
      const displayAlias = pickPreferredAlias(profile.rawLabels)

      if (index === primaryEntry.index) {
        return {
          alias: displayAlias,
          confidenceLabel: 'Canonical form',
          mentionCount: profile.mentionCount,
          reasons: ['Chosen as the clearest and most frequent recorded form.'],
          score: 100,
          statusTone: 'high',
        }
      }

      const supportingEdges = cluster
        .filter((entry) => entry.index !== index)
        .map((entry) => scoreLookup.get(pairKey(index, entry.index)))
        .filter(Boolean)
        .sort((left, right) => right.score - left.score)
      const bestEdge = supportingEdges[0]
      const tone = bestEdge?.score >= 88 ? 'high' : bestEdge?.score >= 78 ? 'medium' : 'low'

      return {
        alias: displayAlias,
        confidenceLabel: confidenceLabel(tone),
        mentionCount: profile.mentionCount,
        reasons: bestEdge?.reasons || ['Grouped by exact normalized match.'],
        score: bestEdge?.score || 100,
        statusTone: tone,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (right.mentionCount !== left.mentionCount) {
        return right.mentionCount - left.mentionCount
      }

      return COLLATOR.compare(left.alias, right.alias)
    })
}

function buildUncertainMatches(cluster, clusters, scoreLookup) {
  const clusterIndexes = new Set(cluster.map((entry) => entry.index))
  const uncertainMatches = []

  clusters.forEach((candidateCluster) => {
    const candidateIndexes = new Set(candidateCluster.map((entry) => entry.index))

    if ([...candidateIndexes].some((index) => clusterIndexes.has(index))) {
      return
    }

    const bestEdge = cluster
      .flatMap((leftEntry) =>
        candidateCluster.map((rightEntry) => scoreLookup.get(pairKey(leftEntry.index, rightEntry.index))),
      )
      .filter(Boolean)
      .filter((edge) => edge.decision === 'uncertain')
      .sort((left, right) => right.score - left.score)[0]

    if (!bestEdge) {
      return
    }

    const candidateDisplay = pickPreferredAlias(candidateCluster[0].profile.rawLabels)

    uncertainMatches.push({
      alias: candidateDisplay,
      confidenceLabel: confidenceLabel('low'),
      reasons: bestEdge.reasons,
      score: bestEdge.score,
      statusTone: 'low',
    })
  })

  return uncertainMatches.sort((left, right) => right.score - left.score).slice(0, 3)
}

function buildPersonId(displayName, usedIds) {
  const baseId = normalizeAliasKey(displayName) || `person ${usedIds.size + 1}`

  if (!usedIds.has(baseId)) {
    usedIds.add(baseId)
    return baseId
  }

  let counter = 2

  while (usedIds.has(`${baseId} ${counter}`)) {
    counter += 1
  }

  const resolvedId = `${baseId} ${counter}`
  usedIds.add(resolvedId)
  return resolvedId
}

function buildMatchSummary(displayName, aliases, matchReasons, uncertainMatches) {
  if (aliases.length <= 1) {
    return `Only one recorded name form is attached to ${displayName} so far.`
  }

  const leadingReasons = matchReasons.slice(0, 2).map((reason) => reason.toLowerCase())
  const uncertaintyNote =
    uncertainMatches.length > 0
      ? ` ${uncertainMatches.length} close variant${uncertainMatches.length === 1 ? ' remains' : 's remain'} separate because the score stayed below the merge threshold.`
      : ''

  return `Merged ${aliases.length} recorded variants because ${leadingReasons.join(' and ')}.${uncertaintyNote}`
}

function aggregateReasons(edges) {
  return sortUnique(edges.flatMap((edge) => edge.reasons)).slice(0, 4)
}

function buildPeopleFromClusters(clusters, profiles, scoreLookup) {
  const usedIds = new Set()

  return clusters.map((cluster) => {
    const aliasCounts = new Map()
    const locations = new Set()
    const recordIds = new Set()
    const sourceBreakdown = new Map()
    const internalEdges = []

    cluster.forEach(({ profile }) => {
      profile.rawLabels.forEach((count, alias) => {
        aliasCounts.set(alias, (aliasCounts.get(alias) || 0) + count)
      })
      profile.locations.forEach((location) => locations.add(location))
      profile.recordIds.forEach((recordId) => recordIds.add(recordId))
      profile.sourceCounts.forEach((count, sourceId) => {
        sourceBreakdown.set(sourceId, (sourceBreakdown.get(sourceId) || 0) + count)
      })
    })

    cluster.forEach((leftEntry, leftIndex) => {
      for (let rightIndex = leftIndex + 1; rightIndex < cluster.length; rightIndex += 1) {
        const edge = scoreLookup.get(pairKey(leftEntry.index, cluster[rightIndex].index))

        if (edge?.decision === 'merge') {
          internalEdges.push(edge)
        }
      }
    })

    const primaryAlias = pickPreferredAlias(aliasCounts)
    const primaryEntry =
      cluster.find(({ profile }) => pickPreferredAlias(profile.rawLabels) === primaryAlias) || cluster[0]
    const aliases = [...aliasCounts.keys()].sort((left, right) => COLLATOR.compare(left, right))
    const matchReasons = aggregateReasons(internalEdges)
    const uncertainMatches = buildUncertainMatches(cluster, clusters, scoreLookup)
    const matchConfidence = clusterConfidenceTone(internalEdges)
    const aliasDetails = buildClusterAliasDetails(cluster, primaryEntry, scoreLookup)

    return {
      aliasDetails,
      aliases,
      displayName: primaryAlias || primaryEntry.profile.aliasKey,
      id: buildPersonId(primaryAlias || primaryEntry.profile.aliasKey, usedIds),
      locations: [...locations].sort((left, right) => COLLATOR.compare(left, right)),
      matchConfidence,
      matchConfidenceLabel: confidenceLabel(matchConfidence),
      matchReasons:
        matchReasons.length > 0
          ? matchReasons
          : ['No fuzzy merge was needed because only one spelling was observed.'],
      matchSummary: buildMatchSummary(
        primaryAlias || primaryEntry.profile.aliasKey,
        aliases,
        matchReasons,
        uncertainMatches,
      ),
      recordIds: [...recordIds],
      sourceBreakdown: [...sourceBreakdown.entries()].map(([sourceId, count]) => ({ count, sourceId })),
      uncertainMatches,
    }
  })
}

function buildProfileToPersonMap(clusters, people) {
  const mapping = new Map()

  clusters.forEach((cluster, index) => {
    const person = people[index]

    cluster.forEach(({ profile }) => {
      mapping.set(profile.aliasKey, person)
    })
  })

  return mapping
}

function buildAliasDetailLookup(person) {
  return new Map(person.aliasDetails.map((detail) => [normalizeAliasKey(detail.alias), detail]))
}

function sortSourceBreakdown(entries, sourceOrder) {
  return [...entries].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }

    return (sourceOrder[left.sourceId] || 0) - (sourceOrder[right.sourceId] || 0)
  })
}

export function resolvePeopleFromRecords(records, sourceOrder = {}) {
  const profiles = buildObservationProfiles(records)
  const scoreData = buildPairScores(profiles)
  const clusters = buildClusters(profiles, scoreData)
  const people = buildPeopleFromClusters(clusters, profiles, scoreData.lookup).map((person) => ({
    ...person,
    sourceBreakdown: sortSourceBreakdown(person.sourceBreakdown, sourceOrder),
  }))
  const profileToPerson = buildProfileToPersonMap(clusters, people)
  const personById = new Map(people.map((person) => [person.id, person]))

  const resolvedRecords = records.map((record) => {
    const participants = record.participants
      .map((participant) => {
        const rawLabel = String(participant.label || '').trim()
        const aliasKey = normalizeAliasKey(rawLabel)
        const resolvedPerson = profileToPerson.get(aliasKey)

        if (!resolvedPerson) {
          return null
        }

        const aliasDetail = buildAliasDetailLookup(resolvedPerson).get(aliasKey)

        return {
          ...participant,
          aliasKey,
          key: resolvedPerson.id,
          rawLabel,
          resolutionConfidence: aliasDetail?.statusTone || resolvedPerson.matchConfidence,
          resolutionReasons: aliasDetail?.reasons || resolvedPerson.matchReasons,
        }
      })
      .filter(Boolean)
    const personKeys = unique(participants.map((participant) => participant.key))

    return {
      ...record,
      participants,
      personKeys,
    }
  })

  return {
    people: people.map((person) => ({
      ...person,
      recordIds: [...person.recordIds].sort(),
    })),
    peopleById: personById,
    records: resolvedRecords,
  }
}