function InsightMetaPills({ items }) {
  const visibleItems = items.filter(Boolean)

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <div className="summary-pill-row">
      {visibleItems.map((item) => (
        <span className="detail-pill" key={item}>
          {item}
        </span>
      ))}
    </div>
  )
}

export function CaseInsightPanels({ lastSeenWith, mostSuspicious }) {
  return (
    <div className="summary-grid">
      <article className="summary-card">
        <div className="summary-card-header">
          <div className="summary-card-copy">
            <span className="summary-label">Last seen with</span>
            <strong>{lastSeenWith?.personName ?? 'No confirmed companion yet'}</strong>
          </div>
          <span className={`status-pill ${lastSeenWith?.statusTone ?? 'low'}`}>
            {lastSeenWith ? 'Evidence-backed' : 'Awaiting data'}
          </span>
        </div>

        <span className="summary-meta">
          {lastSeenWith
            ? `${lastSeenWith.timestampLabel} · ${lastSeenWith.location}`
            : 'No reliable sighting or corroborated note identifies a final companion.'}
        </span>

        <p className="summary-explanation">
          {lastSeenWith?.explanation ||
            'As stronger sighting data arrives, this panel will point to the latest supported companion.'}
        </p>

        <InsightMetaPills
          items={
            lastSeenWith
              ? [
                  lastSeenWith.sourceLabel,
                  `${lastSeenWith.supportCount} corroborating record${
                    lastSeenWith.supportCount === 1 ? '' : 's'
                  }`,
                ]
              : []
          }
        />
      </article>

      <article className="summary-card accent-card">
        <div className="summary-card-header">
          <div className="summary-card-copy">
            <span className="summary-label">Most suspicious</span>
            <strong>{mostSuspicious?.personName ?? 'No suspect identified'}</strong>
          </div>
          <span className={`score-pill ${mostSuspicious?.statusTone ?? 'low'}`}>
            {mostSuspicious?.summaryLabel ?? 'Low signal'}
          </span>
        </div>

        <span className="summary-meta">
          {mostSuspicious
            ? `Suspicion score ${mostSuspicious.score}`
            : 'Not enough linked evidence to rank suspicious behavior.'}
        </span>

        <p className="summary-explanation">
          {mostSuspicious?.explanation ||
            'Suspicion ranking appears here once the records contain enough linked evidence.'}
        </p>

        <InsightMetaPills
          items={
            mostSuspicious
              ? [
                  `${mostSuspicious.withPodoCount} record${
                    mostSuspicious.withPodoCount === 1 ? '' : 's'
                  } with Podo`,
                  mostSuspicious.tipCount > 0
                    ? `${mostSuspicious.tipCount} tip mention${mostSuspicious.tipCount === 1 ? '' : 's'}`
                    : null,
                ]
              : []
          }
        />
      </article>
    </div>
  )
}