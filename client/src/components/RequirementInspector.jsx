import React from 'react';

export default function RequirementInspector({ detail, loading, topicLabels }) {
  if (loading) {
    return (
      <div className="inspector-panel">
        <div className="panel-title">Inspector</div>
        <div className="empty-state">Loading requirement…</div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="inspector-panel">
        <div className="panel-title">Inspector</div>
        <div className="empty-state">Select a requirement to see its full text and provenance.</div>
      </div>
    );
  }

  const { requirement: r, sanctions } = detail;

  return (
    <div className="inspector-panel">
      <div className="ins-eyebrow">{r.requirement_id} · {r.unit_type} · {topicLabels?.[r.topic_id] || r.topic_id}</div>
      <div className="ins-title">{r.citation}</div>

      <div className="pill-row">
        {r.is_critical && <span className="pill mandatory">critical</span>}
        {r.mandatory && <span className="pill owner">mandatory</span>}
        <span className="pill">{r.canonical_state}</span>
        {r.ai?.confidence != null && <span className="pill">confidence {Math.round(r.ai.confidence * 100)}%</span>}
      </div>

      <blockquote className="original-text">{r.original_text}</blockquote>

      {r.duty_holder?.length > 0 && (
        <>
          <div className="ins-subhead">Duty holders</div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {r.duty_holder.map((d, i) => (
              <span className="chip" key={i} title={`confidence ${Math.round((d.confidence || 0) * 100)}%`}>{d.value}</span>
            ))}
          </div>
        </>
      )}

      {r.parameters?.length > 0 && (
        <>
          <div className="ins-subhead">Parameters</div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {r.parameters.map((p, i) => (
              <span className="chip" key={i}>{p.verbatim || `${p.value}${p.unit || ''}`} ({p.kind})</span>
            ))}
          </div>
        </>
      )}

      {sanctions.length > 0 && (
        <>
          <div className="ins-subhead">Linked sanctions</div>
          {sanctions.map((s) => (
            <div className="task-card" key={s.id}>
              <h4>{s.citation}</h4>
              <div className="desc">{s.summary}</div>
            </div>
          ))}
        </>
      )}

      {r.applicability_rule && (
        <>
          <div className="ins-subhead">Applicability rule</div>
          <p className="ins-text">{r.applicability_rule}</p>
        </>
      )}

      {r.missing_dependency?.flag && (
        <div className="callout small">
          <div className="callout-title">Missing dependency</div>
          <p>{r.missing_dependency.regulation_name || 'Referenced but not yet catalogued.'}</p>
        </div>
      )}
      {r.deferred?.flag && (
        <div className="callout small">
          <div className="callout-title">Deferred</div>
          <p>{r.deferred.reason || 'No reason given.'}</p>
        </div>
      )}
      {r.review_flags?.length > 0 && (
        <div className="callout small">
          <div className="callout-title">Review flags</div>
          <ul>{r.review_flags.map((f) => <li key={f}>{f.replace(/_/g, ' ')}</li>)}</ul>
        </div>
      )}

      <div className="audit-row" style={{ marginTop: 14 }}>
        <span>page {r.anchor?.page ?? '—'}</span>
        <span>batch {r.batch_id || '—'}</span>
      </div>
    </div>
  );
}
