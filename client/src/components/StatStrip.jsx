import React from 'react';

export default function StatStrip({ counts }) {
  if (!counts) return null;
  const items = [
    ['Sources', counts.sources],
    ['Clauses', counts.elements],
    ['Task templates', counts.task_templates],
    ['Risk scenarios', counts.risk_scenarios],
    ['Issuers', counts.issuers],
    ['Controlled terms', counts.vocab],
  ];
  return (
    <div className="stat-strip">
      {items.map(([label, n]) => (
        <div className="stat" key={label}>
          <div className="n tabular">{n.toLocaleString()}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </div>
  );
}
