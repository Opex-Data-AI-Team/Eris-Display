import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const DEFAULT_FILTERS = { q: '', type: '', nature: '', status: '', page: 1 };

export default function ControlsView() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.controls(filters)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const onSelect = useCallback((id) => {
    setSelectedId(id);
    setDetailLoading(true);
    api.control(id)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setDetailLoading(false));
  }, []);

  if (error) return <div className="error">{error}</div>;
  const totalPages = results ? Math.max(Math.ceil(results.total / results.pageSize), 1) : 1;
  const onFilterChange = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="explorer">
      <div className="tree-panel">
        <div className="panel-title">Controls {results ? `· ${results.total.toLocaleString()} matches` : ''}</div>
        <div className="filter-bar">
          <input type="text" placeholder="Search activity, owner role…" value={filters.q}
            onChange={(e) => onFilterChange({ q: e.target.value, page: 1 })} />
          <select value={filters.type} onChange={(e) => onFilterChange({ type: e.target.value, page: 1 })}>
            <option value="">All types</option>
            <option value="preventive">preventive</option>
            <option value="detective">detective</option>
            <option value="corrective">corrective</option>
          </select>
          <select value={filters.nature} onChange={(e) => onFilterChange({ nature: e.target.value, page: 1 })}>
            <option value="">All natures</option>
            <option value="manual">manual</option>
            <option value="automated">automated</option>
            <option value="hybrid">hybrid</option>
          </select>
        </div>

        <div className="tree-scroll">
          {loading && <div className="empty-state">Loading…</div>}
          {!loading && results?.items.length === 0 && <div className="empty-state">No controls match this filter.</div>}
          {!loading && results?.items.map((c) => (
            <div
              key={c.id}
              className={`req-row ${c.id === selectedId ? 'selected' : ''}`}
              tabIndex={0}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(c.id); }}
            >
              <div className="req-row-top">
                <span className="req-citation">{c.objective?.topic_id?.replace(/_/g, ' ') || c.owner_role || ''}</span>
                <span className={`tree-badge ${c.type === 'preventive' ? 'tasks' : c.type === 'corrective' ? 'critical' : 'flag'}`}>{c.type}</span>
                <span className="tree-badge tier">{c.nature}</span>
              </div>
              <div className="req-summary">{c.activity}</div>
              <div className="req-row-bottom">
                {c.frequency && <span className="tree-key">{c.frequency}</span>}
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

      <div className="inspector-panel">
        {detailLoading && <div className="empty-state">Loading…</div>}
        {!detailLoading && !detail && <div className="empty-state">Select a control to see the objective it satisfies and the pattern it follows.</div>}
        {!detailLoading && detail && (
          <>
            <div className="ins-eyebrow">{detail.control.type} · {detail.control.nature} · {detail.control.status}</div>
            <div className="ins-title">{detail.control.activity}</div>

            <div className="pill-row">
              {detail.control.frequency && <span className="pill">{detail.control.frequency}</span>}
              {detail.control.owner_role && <span className="pill owner">{detail.control.owner_role}</span>}
              <span className="pill">v{detail.control.version}</span>
            </div>

            {detail.objective && (
              <>
                <div className="ins-subhead">Satisfies objective</div>
                <div className="task-card">
                  <h4>{detail.objective.outcome}</h4>
                </div>
              </>
            )}

            {detail.control.evidence_types?.length > 0 && (
              <>
                <div className="ins-subhead">Evidence types</div>
                <ul className="evidence-list" style={{ marginBottom: 12 }}>
                  {detail.control.evidence_types.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </>
            )}

            {detail.control.alternatives?.length > 0 && (
              <>
                <div className="ins-subhead">Alternatives considered</div>
                <ul className="evidence-list" style={{ marginBottom: 12 }}>
                  {detail.control.alternatives.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </>
            )}

            {detail.pattern && (
              <>
                <div className="ins-subhead">Follows pattern</div>
                <div className="task-card">
                  <h4>{detail.pattern.name}</h4>
                  <div className="desc">{detail.pattern.objective_outcome}</div>
                  <div className="li-score" style={{ marginTop: 6 }}>observed in {detail.pattern.observed_in} controls</div>
                </div>
              </>
            )}

            {detail.control.ai?.confidence != null && (
              <div className="audit-row" style={{ marginTop: 14 }}>
                <span>AI confidence {Math.round(detail.control.ai.confidence * 100)}%</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
