import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function SanctionsRegister() {
  const [sanctions, setSanctions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.sanctions().then(setSanctions).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!sanctions) return <div className="loading">Loading sanctions…</div>;

  return (
    <div className="card-grid">
      {sanctions.map((s) => (
        <div className="risk-card" key={s.id}>
          <div className="code">{s.sanction_id}</div>
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

          {(s.monetary || s.custodial_term) && (
            <div className="li-score" style={{ marginTop: 8 }}>
              {s.monetary && <span>monetary: {JSON.stringify(s.monetary)} </span>}
              {s.custodial_term && <span>custodial: {JSON.stringify(s.custodial_term)}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
