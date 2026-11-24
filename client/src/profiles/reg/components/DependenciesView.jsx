import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

export default function DependenciesView() {
  const [edges, setEdges] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [heldOnly, setHeldOnly] = useState(false);

  useEffect(() => {
    api.dependencies().then(setEdges).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!edges) return [];
    const needle = q.trim().toLowerCase();
    return edges.filter((e) => {
      if (heldOnly && !e.held) return false;
      if (!needle) return true;
      const haystack = `${e.from_source?.title || ''} ${e.to_name || ''} ${e.to_source?.title || ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [edges, q, heldOnly]);

  if (error) return <div className="error">{error}</div>;
  if (!edges) return <div className="loading">Loading dependency edges…</div>;

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input type="text" placeholder="Search source or target name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="filter-check">
          <input type="checkbox" checked={heldOnly} onChange={(e) => setHeldOnly(e.target.checked)} />
          held only
        </label>
        <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>{filtered.length} of {edges.length}</span>
      </div>

      {filtered.length === 0 && <div className="empty-state">No dependency edges match this filter.</div>}

      <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
        {filtered.map((e) => (
          <div className="risk-card" key={e.id}>
            <div className="foot" style={{ marginBottom: 8 }}>
              <span className="code">{e.from_source?.number || e.from_source?.title?.slice(0, 40) || 'unresolved source'}</span>
              <span className={`status-pill ${e.held ? 'held' : 'outstanding'}`}>{e.held ? 'held' : 'outstanding'}</span>
            </div>
            <h4>→ {e.to_source?.title || e.to_name}</h4>
            {e.from_section && <div className="desc"><b>From:</b> {e.from_section}</div>}
            {e.to_section && <div className="desc"><b>To:</b> {e.to_section}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
