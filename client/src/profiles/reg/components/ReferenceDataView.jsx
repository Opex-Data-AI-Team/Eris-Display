import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ReferenceDataView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.referenceData().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="loading">Loading reference data…</div>;

  const topicGroups = new Map();
  (data.topics || []).forEach((t) => {
    const parent = t.parent || t.id;
    const list = topicGroups.get(parent) || [];
    list.push(t);
    topicGroups.set(parent, list);
  });
  const sortedParents = [...topicGroups.keys()].sort();

  return (
    <div>
      <div className="vocab-group">
        <h3>Authority precedence (highest first) · {data.precedence_order?.length || 0}</h3>
        <div className="vocab-chip-row">
          {(data.precedence_order || []).map((v, i) => <span className="chip" key={v}>{i + 1}. {v}</span>)}
        </div>
      </div>

      <div className="vocab-group">
        <h3>Regulators · {data.regulators?.length || 0}</h3>
        {(!data.regulators || data.regulators.length === 0) && <div className="empty-state">Nothing catalogued yet.</div>}
        <div className="vocab-chip-row">
          {(data.regulators || []).map((v, i) => (
            <span className="chip" key={v.id || i}>{typeof v === 'string' ? v : v.label || v.id}</span>
          ))}
        </div>
      </div>

      <div className="vocab-group">
        <h3>Topics · {(data.topics || []).length} across {sortedParents.length} categories</h3>
      </div>
      {sortedParents.map((parent) => (
        <div className="vocab-group" key={parent}>
          <h3 style={{ fontSize: 11 }}>{parent.replace(/_/g, ' ')} · {topicGroups.get(parent).length}</h3>
          <div className="vocab-chip-row">
            {topicGroups.get(parent).map((t) => (
              <span className="chip" key={t.id} title={t.id}>{t.label}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
