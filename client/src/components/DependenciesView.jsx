import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function DependenciesView() {
  const [edges, setEdges] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.dependencies().then(setEdges).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!edges) return <div className="loading">Loading dependency edges…</div>;
  if (edges.length === 0) return <div className="empty-state">No dependency edges recorded yet.</div>;

  return (
    <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
      {edges.map((e) => (
        <div className="risk-card" key={e.id}>
          <div className="foot" style={{ marginBottom: 8 }}>
            <span className="code">{e.from_source_id}</span>
            <span className={`status-pill ${e.held ? 'accepted' : 'draft'}`}>{e.held ? 'held' : 'outstanding'}</span>
          </div>
          <h4>→ {e.to_name || e.to_source_id}</h4>
          {e.from_section && <div className="desc"><b>From:</b> {e.from_section}</div>}
          {e.to_section && <div className="desc"><b>To:</b> {e.to_section}</div>}
        </div>
      ))}
    </div>
  );
}
