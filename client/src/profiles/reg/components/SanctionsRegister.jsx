import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const DEFAULT_FILTERS = { q: '', status: '', page: 1 };

export default function SanctionsRegister() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.sanctions(filters)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  if (error) return <div className="error">{error}</div>;

  const totalPages = results ? Math.max(Math.ceil(results.total / results.pageSize), 1) : 1;
  const onFilterChange = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search citation, summary, text…"
          value={filters.q}
          onChange={(e) => onFilterChange({ q: e.target.value, page: 1 })}
        />
        <select value={filters.status} onChange={(e) => onFilterChange({ status: e.target.value, page: 1 })}>
          <option value="">All link statuses</option>
          <option value="proposed">proposed</option>
          <option value="accepted">accepted</option>
          <option value="rejected">rejected</option>
        </select>
      </div>

      {loading && <div className="loading">Loading sanctions…</div>}
      {!loading && results?.items.length === 0 && <div className="empty-state">No sanctions match this filter.</div>}

      <div className="card-grid">
        {!loading && results?.items.map((s) => (
          <div className="risk-card" key={s.id}>
            <div className="code">{s.source?.number || s.source?.title?.slice(0, 40) || 'unresolved source'}</div>
            <h4>{s.citation}</h4>
            <div className="desc">{s.summary}</div>

            {s.non_monetary?.length > 0 && (
              <ul className="evidence-list" style={{ marginBottom: 9 }}>
                {s.non_monetary.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}

            <div className="foot">
              <div className="chip-row">
                {s.applies_to?.map((a) => <span className="anchor-pill" key={a}>{a}</span>)}
              </div>
              {s.review_flags?.length > 0 && <span className="tree-badge flag">{s.review_flags[0].replace(/_/g, ' ')}</span>}
            </div>

            <div className="li-score" style={{ marginTop: 8 }}>
              link: {s.link_status}{s.link_confidence != null ? ` (${Math.round(s.link_confidence * 100)}% confidence, ${s.link_basis})` : ''}
              {' · '}{s.requirement_ids.length} requirement{s.requirement_ids.length === 1 ? '' : 's'} linked
            </div>

            {(s.monetary || s.custodial_term) && (
              <div className="li-score" style={{ marginTop: 4 }}>
                {s.monetary && <span>monetary: {JSON.stringify(s.monetary)} </span>}
                {s.custodial_term && <span>custodial: {s.custodial_term}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {results && totalPages > 1 && (
        <div className="pager">
          <button disabled={filters.page <= 1} onClick={() => onFilterChange({ page: filters.page - 1 })}>Prev</button>
          <span>Page {filters.page} of {totalPages} · {results.total.toLocaleString()} sanctions</span>
          <button disabled={filters.page >= totalPages} onClick={() => onFilterChange({ page: filters.page + 1 })}>Next</button>
        </div>
      )}
    </div>
  );
}
