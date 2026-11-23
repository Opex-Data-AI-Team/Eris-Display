import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const GROUP_LABELS = {
  topics: 'Topics',
  precedence_order: 'Authority precedence (highest first)',
  regulators: 'Regulators',
};

export default function ReferenceDataView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.referenceData().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="loading">Loading reference data…</div>;

  return (
    <div>
      {Object.entries(data).map(([key, values]) => (
        <div className="vocab-group" key={key}>
          <h3>{GROUP_LABELS[key] || key.replace(/_/g, ' ')} · {values.length}</h3>
          {values.length === 0 && <div className="empty-state">Nothing catalogued yet.</div>}
          {values.length > 0 && (
            <div className="vocab-chip-row">
              {values.map((v, i) => {
                if (typeof v === 'string') return <span className="chip" key={v}>{i + 1}. {v}</span>;
                return <span className="chip" key={v.id || i} title={v.id}>{v.label || v.id}</span>;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
