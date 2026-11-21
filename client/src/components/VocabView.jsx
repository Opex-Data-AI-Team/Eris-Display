import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function VocabView() {
  const [vocab, setVocab] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.vocab().then(setVocab).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!vocab) return <div className="loading">Loading controlled vocabulary…</div>;

  const groups = {};
  vocab.forEach((v) => {
    groups[v.type] = groups[v.type] || [];
    groups[v.type].push(v);
  });

  return (
    <div>
      {Object.entries(groups).map(([type, terms]) => (
        <div className="vocab-group" key={type}>
          <h3>{type.replace(/_/g, ' ')} · {terms.length}</h3>
          <div className="vocab-chip-row">
            {terms.map((t) => (
              <span className="chip" key={t.id} title={t.code}>{t.label}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
