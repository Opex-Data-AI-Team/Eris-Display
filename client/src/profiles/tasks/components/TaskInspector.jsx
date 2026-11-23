import React from 'react';

export default function TaskInspector({ element, tasks, loading }) {
  if (!element) {
    return (
      <div className="inspector-panel">
        <div className="panel-title">Inspector</div>
        <div className="empty-state">Select a clause to see its text and task templates.</div>
      </div>
    );
  }

  return (
    <div className="inspector-panel">
      <div className="ins-eyebrow">{element.key} · {element.class || 'unclassed'} · {element.tier ? element.tier.replace(/_/g, ' ') : 'untiered'}</div>
      <div className="ins-title">{element.title}</div>

      {element.text_informative && element.text_informative.length > 0 && (
        <p className="ins-text">{element.text_informative.join(' ')}</p>
      )}

      <div className="panel-title" style={{ marginTop: 16 }}>
        Task templates {loading ? '' : `(${tasks.length})`}
      </div>

      {loading && <div className="empty-state">Loading tasks…</div>}
      {!loading && tasks.length === 0 && (
        <div className="empty-state">No task templates attached directly to this clause.</div>
      )}
      {!loading && tasks.map((t) => (
        <div className="task-card" key={t.id}>
          <h4>{t.title}</h4>
          {t.description && <div className="desc">{t.description}</div>}
          <div className="task-meta">
            <span className="pill owner">{t.owner_role || 'unassigned'}</span>
            <span className="pill">{t.kind}{t.frequency ? ` · ${t.frequency}` : ''}</span>
            {t.mandatory && <span className="pill mandatory">mandatory</span>}
          </div>
          {t.evidence_spec && t.evidence_spec.length > 0 && (
            <ul className="evidence-list">
              {t.evidence_spec.flatMap((ev) => ev.required_content || []).slice(0, 6).map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
