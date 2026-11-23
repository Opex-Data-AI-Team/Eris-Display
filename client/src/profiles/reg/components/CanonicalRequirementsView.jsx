import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function CanonicalRequirementsView() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.canonicalRequirements().then(setItems).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!items) return <div className="loading">Loading canonical requirements…</div>;

  return (
    <div>
      <div className="ai-summary">
        <div className="ai-summary-tag">What this is</div>
        <p>
          Groups of equivalent obligations from different regulations collapsed under one umbrella —
          e.g. the same AML customer-due-diligence duty appearing in both a CBN circular and an ISO
          standard — so coverage can be assessed once per topic instead of once per source. Each
          source requirement's <span className="mono">canonical_state</span> (unassessed / no candidate / mapped)
          tracks whether it has been matched to one of these yet.
        </p>
      </div>

      {items.length === 0 && <div className="empty-state">No canonical requirements mapped yet.</div>}

      <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
        {items.map((c) => (
          <div className="risk-card" key={c.id}>
            <div className="code">{c.canonical_id}</div>
            <h4>{c.topic_id?.replace(/_/g, ' ')}</h4>
            {c.description && <div className="desc">{c.description}</div>}
            <div className="li-score">{c.requirement_ids.length} linked requirement{c.requirement_ids.length === 1 ? '' : 's'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
