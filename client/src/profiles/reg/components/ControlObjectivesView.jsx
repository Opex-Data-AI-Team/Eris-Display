import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const DEFAULT_FILTERS = { q: '', status: '', page: 1 };

export default function ControlObjectivesView() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [patternNames, setPatternNames] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.controlObjectives(filters)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    api.referenceData()
      .then((d) => {
        const map = {};
        (d.control_patterns || []).forEach((p) => { map[p.id] = p.name; });
        setPatternNames(map);
      })
      .catch(() => {});
  }, []);

  const onSelect = useCallback((id) => {
    setSelectedId(id);
    setDetailLoading(true);
    api.controlObjective(id)
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
        <div className="panel-title">Control objectives {results ? `· ${results.total.toLocaleString()} matches` : ''}</div>
        <div className="filter-bar">
          <input type="text" placeholder="Search outcome, rationale…" value={filters.q}
            onChange={(e) => onFilterChange({ q: e.target.value, page: 1 })} />
          <select value={filters.status} onChange={(e) => onFilterChange({ status: e.target.value, page: 1 })}>
            <option value="">All statuses</option>
            <option value="draft">draft</option>
            <option value="accepted">accepted</option>
            <option value="rejected">rejected</option>
            <option value="retired">retired</option>
          </select>
        </div>

        <div className="tree-scroll">
          {loading && <div className="empty-state">Loading…</div>}
          {!loading && results?.items.length === 0 && <div className="empty-state">No control objectives match this filter.</div>}
          {!loading && results?.items.map((o) => (
            <div
              key={o.id}
              className={`req-row ${o.id === selectedId ? 'selected' : ''}`}
              tabIndex={0}
              onClick={() => onSelect(o.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(o.id); }}
            >
              <div className="req-row-top">
                <span className="req-citation">{o.topic_id?.replace(/_/g, ' ')}</span>
                <span className={`tree-badge ${o.status === 'accepted' ? 'tasks' : o.status === 'rejected' || o.status === 'retired' ? 'critical' : 'flag'}`}>{o.status}</span>
              </div>
              <div className="req-summary">{o.outcome}</div>
              <div className="req-row-bottom">
                <span className="tree-badge tier">{o.direct_requirement_link ? 'direct link' : 'via canonical'}</span>
                <span className="tree-badge tasks">{o.control_count} control{o.control_count === 1 ? '' : 's'}</span>
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
        {!detailLoading && !detail && <div className="empty-state">Select a control objective to see what it's derived from and what satisfies it.</div>}
        {!detailLoading && detail && (
          <>
            <div className="ins-eyebrow">{detail.objective.topic_id?.replace(/_/g, ' ')} · {detail.objective.status}</div>
            <div className="ins-title">{detail.objective.outcome}</div>
            {detail.objective.rationale && <p className="ins-text">{detail.objective.rationale}</p>}
            <div className="pill-row">
              {detail.objective.confidence != null && <span className="pill">{Math.round(detail.objective.confidence * 100)}% confidence</span>}
              {detail.objective.owner && <span className="pill owner">{detail.objective.owner}</span>}
              <span className="pill">v{detail.objective.version}</span>
            </div>

            {detail.canonical && (
              <>
                <div className="ins-subhead">Derived from canonical requirement</div>
                <div className="task-card">
                  <h4>{detail.canonical.description}</h4>
                  <div className="desc">{detail.canonical.requirement_ids.length} requirements unified across regulations</div>
                </div>
              </>
            )}

            {!detail.canonical && detail.requirements.length > 0 && (
              <>
                <div className="ins-subhead">Directly linked requirements ({detail.requirements.length})</div>
                {detail.requirements.map((r) => (
                  <div className="task-card" key={r.id}>
                    <h4>{r.citation}</h4>
                    <div className="desc">{r.summary}</div>
                  </div>
                ))}
              </>
            )}

            {detail.objective.proposed_patterns?.length > 0 && (
              <>
                <div className="ins-subhead">Proposed control patterns</div>
                <div className="chip-row" style={{ marginBottom: 12 }}>
                  {detail.objective.proposed_patterns.map((pid) => (
                    <span className="chip" key={pid}>{patternNames[pid] || pid}</span>
                  ))}
                </div>
              </>
            )}

            <div className="ins-subhead">Controls implementing this ({detail.controls.length})</div>
            {detail.controls.length === 0 && <div className="chain-empty">No control activity defined for this objective yet.</div>}
            {detail.controls.map((c) => (
              <div className="task-card" key={c.id}>
                <h4>{c.activity}</h4>
                <div className="task-meta">
                  <span className="pill owner">{c.type}</span>
                  <span className="pill">{c.nature}</span>
                  {c.frequency && <span className="pill">{c.frequency}</span>}
                  {c.owner_role && <span className="pill">{c.owner_role}</span>}
                </div>
                {c.evidence_types?.length > 0 && (
                  <ul className="evidence-list">{c.evidence_types.map((e, i) => <li key={i}>{e}</li>)}</ul>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
