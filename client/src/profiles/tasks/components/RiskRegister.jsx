import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function RiskRegister() {
  const [risks, setRisks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.riskScenarios().then(setRisks).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!risks) return <div className="loading">Loading risk scenarios…</div>;

  return (
    <div className="card-grid">
      {risks.map((r) => (
        <div className="risk-card" key={r.id}>
          <div className="code">{r.code}</div>
          <h4>{r.title}</h4>
          {r.description && <div className="desc">{r.description}</div>}
          <div className="foot">
            <span className="anchor-pill">{r.anchor?.replace(/_/g, ' ') || 'unanchored'}</span>
            <span className="li-score">L{r.default_likelihood ?? '–'} × I{r.default_impact ?? '–'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
