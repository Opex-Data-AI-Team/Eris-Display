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
          <div className="issuer">{s.issuer_code}</div>
          <div className="title">{s.ref_no || s.work_key}</div>
          <div className="refno">{s.title}</div>
          <div className="counts">
            <span><b className="tabular">{s.element_count}</b> clauses</span>
            <span><b className="tabular">{s.task_count}</b> tasks</span>
          </div>
        </button>
      ))}
    </div>
  );
}
