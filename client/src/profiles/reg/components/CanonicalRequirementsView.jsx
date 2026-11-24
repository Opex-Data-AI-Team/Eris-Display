import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const DEFAULT_FILTERS = { q: '', status: '', page: 1 };

export default function CanonicalRequirementsView() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.canonicalRequirements(filters)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const onSelect = useCallback((id) => {
    setSelectedId(id);
    setDetailLoading(true);
    api.canonicalRequirement(id)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setDetailLoading(false));
  }, []);

  if (error) return <div className="error">{error}</div>;
  const totalPages = results ? Math.max(Math.ceil(results.total / results.pageSize), 1) : 1;
  const onFilterChange = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const controlsByObjective = new Map();
  (detail?.controls || []).forEach((c) => {
    const list = controlsByObjective.get(c.objective_id) || [];
    list.push(c);
    controlsByObjective.set(c.objective_id, list);
  });

  return (
    <div className="explorer">
      <div className="tree-panel">
        <div className="panel-title">Canonical requirements {results ? `· ${results.total.toLocaleString()} matches` : ''}</div>
        <div className="filter-bar">
          <input type="text" placeholder="Search description, rationale…" value={filters.q}
            onChange={(e) => onFilterChange({ q: e.target.value, page: 1 })} />
          <select value={filters.status} onChange={(e) => onFilterChange({ status: e.target.value, page: 1 })}>
            <option value="">All statuses</option>
            <option value="draft">draft</option>
            <option value="accepted">accepted</option>
            <option value="rejected">rejected</option>
          </select>
        </div>

        <div className="tree-scroll">
          {loading && <div className="empty-state">Loading…</div>}
          {!loading && results?.items.length === 0 && <div className="empty-state">No canonical requirements match this filter.</div>}
          {!loading && results?.items.map((c) => (
            <div
              key={c.id}
              className={`req-row ${c.id === selectedId ? 'selected' : ''}`}
              tabIndex={0}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(c.id); }}
            >
              <div className="req-row-top">
                <span className="req-citation">{c.topic_id?.replace(/_/g, ' ')}</span>
                <span className={`tree-badge ${c.status === 'accepted' ? 'tasks' : c.status === 'rejected' ? 'critical' : 'flag'}`}>{c.status}</span>
              </div>
              <div className="req-summary">{c.description}</div>
              <div className="req-row-bottom">
                <span className="tree-badge tier">{c.requirement_count} requirement{c.requirement_count === 1 ? '' : 's'}</span>
                <span className="tree-badge tasks">{c.objective_count} objective{c.objective_count === 1 ? '' : 's'}</span>
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
        {!detailLoading && !detail && <div className="empty-state">Select a canonical requirement to see every regulation it unifies, and what's built to satisfy it.</div>}
        {!detailLoading && detail && (
          <>
            <div className="ins-eyebrow">{detail.canonical.topic_id?.replace(/_/g, ' ')} · {detail.canonical.status}</div>
            <div className="ins-title">{detail.canonical.description}</div>
            {detail.canonical.rationale && <p className="ins-text">{detail.canonical.rationale}</p>}
            {detail.canonical.confidence != null && (
              <div className="pill-row"><span className="pill">{Math.round(detail.canonical.confidence * 100)}% confidence</span></div>
            )}

            <div className="ins-subhead">Requirements unified here ({detail.requirements.length})</div>
            {detail.requirements.map((r) => (
              <div className="task-card" key={r.id}>
                <h4>{r.citation}</h4>
                <div className="desc">{r.summary}</div>
                {r.is_critical && <span className="pill mandatory" style={{ marginTop: 6, display: 'inline-block' }}>critical</span>}
              </div>
            ))}

            <div className="ins-subhead" style={{ marginTop: 14 }}>Control objectives ({detail.control_objectives.length})</div>
            {detail.control_objectives.length === 0 && <div className="chain-empty">No control objective derived yet.</div>}
            {detail.control_objectives.map((o) => (
              <div className="chain-step" key={o.id} style={{ marginBottom: 10 }}>
                <div className="chain-label">{o.status}</div>
                <h5>{o.outcome}</h5>
                <div className="chain-controls">
                  {(controlsByObjective.get(o.id) || []).length === 0 && <div className="chain-empty">No control activity defined yet.</div>}
                  {(controlsByObjective.get(o.id) || []).map((c) => (
                    <div className="mini-control" key={c.id}>
                      <b>{c.type} · {c.nature}</b> — {c.activity}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
