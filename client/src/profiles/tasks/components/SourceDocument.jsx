import React from 'react';

function fmtDate(v) {
  if (!v) return null;
  return new Date(v).toISOString().slice(0, 10);
}

function Field({ label, children, mono }) {
  const empty = children === null || children === undefined || children === '' ||
    (Array.isArray(children) && children.length === 0);
  return (
    <div className="meta-field">
      <div className="k">{label}</div>
      <div className={`v ${mono ? 'mono' : ''} ${empty ? 'empty' : ''}`}>
        {empty ? '—' : children}
      </div>
    </div>
  );
}

export default function SourceDocument({ data }) {
  if (!data) return null;
  const { source, issuer, element_count, task_count } = data;

  return (
    <div className="doc-panel">
      <div className="doc-head">
        <div>
          <div className="eyebrow">{source.work_key}</div>
          <h2>{source.title}</h2>
          <div className="refno">{source.ref_no || 'no reference number'} {source.edition ? `· ${source.edition} edition` : ''}</div>
        </div>
        <span className={`status-pill ${source.status}`}>{source.status}</span>
      </div>

      <div className="meta-grid">
        <Field label="Issuer">{issuer ? `${issuer.name} (${issuer.code})` : source.issuer_code}</Field>
        <Field label="Instrument type">{source.instrument_type}</Field>
        <Field label="Legal force">{source.legal_force?.replace(/_/g, ' ')}</Field>
        <Field label="Lifecycle">{source.lifecycle?.replace(/_/g, ' ')}</Field>

        <Field label="Language">{source.language}</Field>
        <Field label="Issued on">{fmtDate(source.issued_on)}</Field>
        <Field label="Effective on">{fmtDate(source.effective_on)}</Field>
        <Field label="Transition until">{fmtDate(source.transition_until)}</Field>

        <Field label="Jurisdictions">
          {source.jurisdictions?.length > 0 && (
            <div className="chip-row">{source.jurisdictions.map((j) => <span className="chip" key={j}>{j}</span>)}</div>
          )}
        </Field>
        <Field label="Consequence anchors">
          {source.consequence_anchors?.length > 0 && (
            <div className="chip-row">{source.consequence_anchors.map((a) => <span className="chip" key={a}>{a.replace(/_/g, ' ')}</span>)}</div>
          )}
        </Field>
        <Field label="Clauses loaded">
          <span className="tabular">{element_count}</span>
          {source.ingestion?.published_element_count != null && (
            <span style={{ color: 'var(--muted)' }}> / {source.ingestion.published_element_count} published</span>
          )}
        </Field>
        <Field label="Task templates">
          <span className="tabular">{task_count}</span>
        </Field>

        <Field label="Document hash" mono>{source.doc?.hash}</Field>
        <Field label="Document URL" mono>{source.doc?.url}</Field>
        <Field label="License">{source.doc?.license}</Field>
        <Field label="Supersedes">{source.supersedes_id}</Field>

        <Field label="Legal basis">
          {source.legal_basis_ids?.length > 0 && (
            <div className="chip-row">{source.legal_basis_ids.map((id) => <span className="chip mono" key={id}>{id}</span>)}</div>
          )}
        </Field>
        <Field label="Amends">
          {source.amends_ids?.length > 0 && (
            <div className="chip-row">{source.amends_ids.map((id) => <span className="chip mono" key={id}>{id}</span>)}</div>
          )}
        </Field>
        <Field label="Organization scope">{source.org_id}</Field>
      </div>

      <div className="audit-row">
        <span><b>Created</b> {fmtDate(source.created_at)} by {source.created_by}</span>
        <span><b>Updated</b> {fmtDate(source.updated_at)} by {source.updated_by}</span>
        {source.locked_at && <span><b>Locked</b> {fmtDate(source.locked_at)}</span>}
      </div>
    </div>
  );
}
