import React from 'react';

export default function StatStrip({ counts }) {
  if (!counts) return null;
  const items = [
    ['Sources', counts.sources],
    ['Requirements', counts.requirements],
    ['Critical requirements', counts.critical_requirements],
    ['Sanctions', counts.sanctions],
    ['Dependency edges', counts.dependency_edges],
    ['Topics', counts.topics],
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
