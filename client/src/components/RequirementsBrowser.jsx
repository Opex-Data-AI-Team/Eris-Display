import React from 'react';

function topicLabel(topicId, topicLabels) {
  return topicLabels?.[topicId] || topicId || 'uncategorized';
}

export default function RequirementsBrowser({
  topics, topicLabels, filters, onFilterChange, results, loading, selectedId, onSelect,
}) {
  const totalPages = results ? Math.max(Math.ceil(results.total / results.pageSize), 1) : 1;

  return (
    <div className="tree-panel">
      <div className="panel-title">Requirements {results ? `· ${results.total.toLocaleString()} match` + (results.total === 1 ? '' : 'es') : ''}</div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search citation, summary, text…"
          value={filters.q}
          onChange={(e) => onFilterChange({ q: e.target.value, page: 1 })}
        />
        <select value={filters.topic} onChange={(e) => onFilterChange({ topic: e.target.value, page: 1 })}>
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.topic_id} value={t.topic_id}>{topicLabel(t.topic_id, topicLabels)} ({t.count})</option>
          ))}
        </select>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={filters.critical === 'true'}
            onChange={(e) => onFilterChange({ critical: e.target.checked ? 'true' : '', page: 1 })}
          />
          critical only
        </label>
      </div>

      <div className="tree-scroll">
        {loading && <div className="empty-state">Loading requirements…</div>}
        {!loading && results?.items.length === 0 && <div className="empty-state">No requirements match this filter.</div>}
        {!loading && results?.items.map((r) => (
          <div
            key={r.id}
            className={`req-row ${r.requirement_id === selectedId ? 'selected' : ''}`}
            tabIndex={0}
            onClick={() => onSelect(r.requirement_id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect(r.requirement_id); }}
          >
            <div className="req-row-top">
              <span className="req-citation">{r.citation}</span>
              {r.is_critical && <span className="tree-badge critical">critical</span>}
              {r.review_flags?.length > 0 && <span className="tree-badge flag">flagged</span>}
            </div>
            <div className="req-summary">{r.summary}</div>
            <div className="req-row-bottom">
              <span className="tree-badge tier">{topicLabel(r.topic_id, topicLabels)}</span>
              {r.pages?.length > 0 && <span className="tree-key">p.{r.pages[0]}</span>}
            </div>
          </div>
        ))}
      </div>

      {results && totalPages > 1 && (
        <div className="pager">
          <button disabled={filters.page <= 1} onClick={() => onFilterChange({ page: filters.page - 1 })}>Prev</button>
          <span>Page {filters.page} of {totalPages}</span>
          <button disabled={filters.page >= totalPages} onClick={() => onFilterChange({ page: filters.page + 1 })}>Next</button>
        </div>
      )}
    </div>
  );
}
