import React from 'react';

export default function SourceSidebar({ sources, selectedId, onSelect }) {
  return (
    <div className="sidebar">
      <div className="sidebar-head">Sources · {sources.length}</div>
      {sources.map((s) => (
        <button
          key={s.id}
          className={`source-card ${s.id === selectedId ? 'active' : ''}`}
          onClick={() => onSelect(s.id)}
        >
          <div className="issuer">{s.issuer?.code}</div>
          <div className="title">{s.number || s.title?.slice(0, 40)}</div>
          <div className="refno">{s.title}</div>
          <div className="counts">
            <span><b className="tabular">{s.requirement_count}</b> requirements</span>
            <span><b className="tabular">{s.sanction_count}</b> sanctions</span>
          </div>
        </button>
      ))}
    </div>
  );
}
