import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const DEFAULT_FILTERS = { type: '', status: '', page: 1 };

function EntityRef({ entity }) {
  if (!entity) return <span className="empty-state" style={{ padding: 0, display: 'inline' }}>unresolved</span>;
  return (
    <span>
      <span className={`kind-badge ${entity.kind}`}>{entity.kind}</span>{' '}
      {entity.label}
    </span>
  );
}

export default function RelationshipsView() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.relationships(filters)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  if (error) return <div className="error">{error}</div>;

  const totalPages = results ? Math.max(Math.ceil(results.total / results.pageSize), 1) : 1;
  const onFilterChange = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div>
      <div className="ai-summary">
        <div className="ai-summary-tag">What this is</div>
        <p>
          Edges between requirements, canonical requirements, control objectives and sources recording
          how one relates to another — <span className="mono">satisfies</span>, <span className="mono">partially_satisfies</span>,{' '}
          <span className="mono">related</span>, <span className="mono">depends_on</span>, or <span className="mono">conflicts</span> —
          each with a confidence score and review status.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select value={filters.type} onChange={(e) => onFilterChange({ type: e.target.value, page: 1 })}>
          <option value="">All types</option>
          <option value="satisfies">satisfies</option>
          <option value="partially_satisfies">partially_satisfies</option>
          <option value="related">related</option>
          <option value="depends_on">depends_on</option>
          <option value="conflicts">conflicts</option>
        </select>
        <select value={filters.status} onChange={(e) => onFilterChange({ status: e.target.value, page: 1 })}>
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="accepted">accepted</option>
          <option value="rejected">rejected</option>
        </select>
      </div>

      {loading && <div className="loading">Loading relationships…</div>}
      {!loading && results?.items.length === 0 && <div className="empty-state">No relationships match this filter.</div>}

      <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
        {!loading && results?.items.map((r) => (
          <div className="risk-card" key={r.id}>
            <div className="foot" style={{ marginBottom: 8 }}>
              <span className="code">{r.type}{r.topic_id ? ` · ${r.topic_id.replace(/_/g, ' ')}` : ''}</span>
              <span className={`status-pill ${r.status}`}>{r.status}</span>
            </div>
            <h4><EntityRef entity={r.from} /></h4>
            <div className="desc" style={{ margin: '6px 0' }}>↓</div>
            <h4><EntityRef entity={r.to} /></h4>
            {r.rationale && <div className="desc" style={{ marginTop: 8 }}>{r.rationale}</div>}
            <div className="li-score" style={{ marginTop: 8 }}>
              {r.confidence != null && <span>{Math.round(r.confidence * 100)}% confidence</span>}
              {r.revalidate?.flag && <span style={{ color: 'var(--warn)' }}> · needs revalidation{r.revalidate.trigger ? `: ${r.revalidate.trigger}` : ''}</span>}
            </div>
          </div>
        ))}
      </div>

      {results && totalPages > 1 && (
        <div className="pager">
          <button disabled={filters.page <= 1} onClick={() => onFilterChange({ page: filters.page - 1 })}>Prev</button>
          <span>Page {filters.page} of {totalPages} · {results.total.toLocaleString()} relationships</span>
          <button disabled={filters.page >= totalPages} onClick={() => onFilterChange({ page: filters.page + 1 })}>Next</button>
        </div>
      )}
    </div>
  );
}
