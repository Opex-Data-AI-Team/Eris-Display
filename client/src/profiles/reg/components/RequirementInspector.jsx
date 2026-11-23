import React from 'react';

const STATUS_PILL = {
  draft: 'draft', deferred: 'deferred',
  accepted: 'accepted',
  rejected: 'rejected', superseded: 'superseded',
};

function renderApplicabilityRule(rule) {
  if (!rule) return null;
  if (typeof rule === 'string') return <p className="ins-text">{rule}</p>;
  return (
    <div className="chip-row" style={{ marginBottom: 12 }}>
      {Object.entries(rule).map(([k, v]) => (
        <span className="chip" key={k}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
      ))}
    </div>
  );
}

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
        <span className={`status-pill ${STATUS_PILL[r.status] || ''}`}>{r.status}</span>
        {r.is_critical && <span className="pill mandatory">critical</span>}
        {r.mandatory && <span className="pill owner">mandatory</span>}
        <span className="pill">{r.canonical_state?.replace(/_/g, ' ')}</span>
        {r.ai?.confidence != null && <span className="pill">confidence {Math.round(r.ai.confidence * 100)}%</span>}
      </div>

      <blockquote className="original-text">{r.original_text}</blockquote>

      {r.duty_holder?.length > 0 && (
        <>
          <div className="ins-subhead">Duty holders</div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {r.duty_holder.map((d, i) => (
              <span className="chip" key={i} title={`confidence ${Math.round((d.confidence || 0) * 100)}%`}>
                {d.value}{d.provenance && d.provenance !== 'text' ? ` (${d.provenance})` : ''}
              </span>
            ))}
          </div>
        </>
      )}

      {r.guidance_reason && (
        <>
          <div className="ins-subhead">Guidance reason</div>
          <p className="ins-text">{r.guidance_reason}</p>
        </>
      )}

      {r.review && (
        <div className="callout small">
          <div className="callout-title">Reviewed · {r.review.decision}</div>
          <p>by {r.review.reviewer}{r.review.reason ? ` — ${r.review.reason}` : ''}</p>
        </div>
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

      {r.periods?.length > 0 && (
        <>
          <div className="ins-subhead">Periods</div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {r.periods.map((p) => (
              <span className="chip" key={p.sn}>#{p.sn}: {new Date(p.start).toISOString().slice(0, 10)} → {new Date(p.end).toISOString().slice(0, 10)}</span>
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
          {renderApplicabilityRule(r.applicability_rule)}
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
