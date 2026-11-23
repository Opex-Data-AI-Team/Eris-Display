import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function RelationshipsView() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.relationships().then(setItems).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!items) return <div className="loading">Loading relationships…</div>;

  return (
    <div>
      <div className="ai-summary">
        <div className="ai-summary-tag">What this is</div>
        <p>
          Edges between requirements (and canonical requirements) recording how one obligation
          relates to another — <span className="mono">satisfies</span>, <span className="mono">partially_satisfies</span>,{' '}
          <span className="mono">related</span>, <span className="mono">depends_on</span>, or <span className="mono">conflicts</span> —
          each with a confidence score and review status. Built once cross-regulation analysis links this
          source's requirements to others.
        </p>
      </div>

      {items.length === 0 && <div className="empty-state">No relationships recorded yet.</div>}

      <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
        {items.map((r) => (
          <div className="risk-card" key={r.id}>
            <div className="foot" style={{ marginBottom: 8 }}>
              <span className="code">{r.from_id} → {r.to_id}</span>
              <span className={`status-pill ${r.status}`}>{r.status}</span>
            </div>
            <h4>{r.type?.replace(/_/g, ' ') || 'unspecified relation'}</h4>
            {r.rationale && <div className="desc">{r.rationale}</div>}
            <div className="chip-row">
              {r.topic_id && <span className="chip">{r.topic_id.replace(/_/g, ' ')}</span>}
              {r.confidence != null && <span className="chip">confidence {Math.round(r.confidence * 100)}%</span>}
              {r.reviewer && <span className="chip">reviewed by {r.reviewer}</span>}
            </div>
            {r.revalidate?.flag && (
              <div className="callout small">
                <div className="callout-title">Needs revalidation</div>
                <p>{r.revalidate.trigger || 'No trigger given.'}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
