import { RefreshCw } from 'lucide-react';

const TAG_LABELS = {
  question: '❓ Question',
  talking_point: '💬 Talking Point',
  answer: '✅ Answer',
  fact_check: '🔍 Fact Check',
};

export default function SuggestionsColumn({ batches, isLoading, error, onRefresh, onSuggestionClick }) {
  return (
    <div className="column">
      <div className="column-header">
        <h2>
          <span className="col-icon">💡</span> Live Suggestions
        </h2>
        <div className="header-actions">
          {isLoading && <span className="status-badge processing"><RefreshCw size={12} className="spinner" /> Updating…</span>}
          <button
            id="refresh-suggestions-btn"
            className="btn"
            onClick={onRefresh}
            disabled={isLoading}
            title="Manually refresh suggestions"
          >
            <RefreshCw size={15} className={isLoading ? 'spinner' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="column-content" id="suggestions-scroll">
        {error && <div className="error-banner">⚠️ {error}</div>}

        {isLoading && batches.length === 0 && (
          <div className="loading-skeleton">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {batches.length === 0 && !isLoading && !error && (
          <div className="empty-state">
            <span style={{ fontSize: 40 }}>💡</span>
            <p>Start recording to get live AI suggestions based on your conversation.</p>
          </div>
        )}

        {batches.map((batch) => (
          <div key={batch.id} className="suggestion-batch">
            <div className="batch-time">{batch.timestamp}</div>
            {batch.suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                suggestion={s}
                onClick={() => onSuggestionClick(s)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, onClick }) {
  const tagClass = `tag-${suggestion.type}`;
  return (
    <div
      className="suggestion-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className={`suggestion-tag ${tagClass}`}>
        {TAG_LABELS[suggestion.type] || suggestion.type}
      </span>
      <p className="suggestion-content">{suggestion.preview}</p>
      <span className="suggestion-cta">Click for detailed answer →</span>
    </div>
  );
}
