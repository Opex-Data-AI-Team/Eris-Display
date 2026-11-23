import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ConflictsView() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.conflicts().then(setItems).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!items) return <div className="loading">Loading conflicts…</div>;

  return (
    <div>
      <div className="ai-summary">
        <div className="ai-summary-tag">What this is</div>
        <p>
          Contradictions, overlaps, or circular references detected between regulatory sources —
          a <span className="mono">cycle</span>, <span className="mono">conflict</span>, or <span className="mono">overlap</span>{' '}
          between named members, with a precedence outcome (proposed or final) and which source is
          treated as the working standard until legal review resolves it.
        </p>
      </div>

      {items.length === 0 && <div className="empty-state">No conflicts or cycles detected yet.</div>}

      <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
        {items.map((c) => (
          <div className="risk-card" key={c.id}>
            <div className="foot" style={{ marginBottom: 8 }}>
              <span className="code">{c.kind}</span>
              <span className={`status-pill ${c.status}`}>{c.status}</span>
            </div>
            <h4>{c.members.join(' ↔ ') || 'unnamed members'}</h4>
            {c.reason && <div className="desc">{c.reason}</div>}
            <div className="chip-row">
              {c.working_standard && <span className="chip">working standard: {c.working_standard}</span>}
              {c.precedence_outcome && <span className="chip">{c.precedence_outcome}</span>}
              {c.legal_review_status && <span className="chip">legal review: {c.legal_review_status}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
