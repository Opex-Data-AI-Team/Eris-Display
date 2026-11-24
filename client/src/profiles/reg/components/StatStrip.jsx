import React from 'react';

export default function StatStrip({ counts }) {
  if (!counts) return null;
  const items = [
    ['Sources', counts.sources],
    ['Requirements', counts.requirements],
    ['Critical requirements', counts.critical_requirements],
    ['Canonical requirements', counts.canonical_requirements],
    ['Control objectives', counts.control_objectives],
    ['Controls', counts.controls],
    ['Sanctions', counts.sanctions],
    ['Relationships', counts.relationships],
    ['Topics', counts.topics],
  ];
  return (
    <div className="stat-strip" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(([label, n]) => (
        <div className="stat" key={label}>
          <div className="n tabular">{n.toLocaleString()}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </div>
  );
}
