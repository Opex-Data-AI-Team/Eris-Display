import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function PatternLibraryView() {
  const [patterns, setPatterns] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.referenceData()
      .then((d) => setPatterns([...(d.control_patterns || [])].sort((a, b) => (b.observed_in || 0) - (a.observed_in || 0))))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!patterns) return <div className="loading">Loading pattern library…</div>;

  return (
    <div>
      <div className="ai-summary">
        <div className="ai-summary-tag">What this is</div>
        <p>
          A curated library of reusable control designs. Each pattern names a known-good way to satisfy a
          recurring kind of compliance outcome — the "<span className="mono">observed_in</span>" count is how many
          actual controls across all regulations already follow it.
        </p>
      </div>

      <div className="card-grid">
        {patterns.map((p) => (
          <div className="risk-card" key={p.id}>
            <div className="code">{p.id}</div>
            <h4>{p.name}</h4>
            <div className="desc">{p.objective_outcome}</div>
            <p className="ins-text" style={{ margin: '8px 0' }}>{p.activity}</p>

            <div className="task-meta">
              <span className="pill owner">{p.type}</span>
              <span className="pill">{p.nature}</span>
              {p.owner_role && <span className="pill">{p.owner_role}</span>}
            </div>
            {p.frequency && <div className="li-score" style={{ marginTop: 6 }}>{p.frequency}</div>}

            {p.evidence?.length > 0 && (
              <>
                <div className="ins-subhead" style={{ marginTop: 10 }}>Evidence</div>
                <ul className="evidence-list" style={{ marginBottom: 9 }}>
                  {p.evidence.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </>
            )}

            {p.alternatives?.length > 0 && (
              <>
                <div className="ins-subhead">Alternatives</div>
                <ul className="evidence-list" style={{ marginBottom: 9 }}>
                  {p.alternatives.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </>
            )}

            <div className="foot">
              <div className="chip-row">
                {p.topics?.map((t) => <span className="anchor-pill" key={t}>{t.replace(/_/g, ' ')}</span>)}
              </div>
              <span className="tree-badge tasks">used {p.observed_in ?? 0}×</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
