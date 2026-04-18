export function StatusPanel({
  actionLabel,
  message,
  onAction,
  title,
  variant,
}) {
  return (
    <section className="panel panel-section status-panel">
      <div className="status-layout">
        <span className={`status-pill ${variant === 'error' ? 'high' : 'medium'}`}>
          {variant === 'loading' ? 'Loading' : 'Issue'}
        </span>
        <h2 className="status-title">{title}</h2>
        <p className="status-copy">{message}</p>
        {variant === 'loading' ? (
          <div className="status-skeleton" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : null}
        {actionLabel && onAction ? (
          <button className="action-button" onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  )
}