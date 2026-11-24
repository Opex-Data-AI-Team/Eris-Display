import React, { useState } from 'react';
import { api } from '../api.js';

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

function Section({ title, children }) {
  return (
    <div className="doc-section">
      <h3>{title}</h3>
      <div className="meta-grid">{children}</div>
    </div>
  );
}

export default function SourceDocument({ data, sourceId }) {
  const [fullText, setFullText] = useState(null);
  const [loadingText, setLoadingText] = useState(false);
  const [showText, setShowText] = useState(false);

  if (!data) return null;
  const { source, requirement_count, sanction_count, dependency_count } = data;

  const toggleFullText = async () => {
    if (showText) { setShowText(false); return; }
    setShowText(true);
    if (fullText === null) {
      setLoadingText(true);
      try {
        const res = await api.sourceFullText(sourceId);
        setFullText(res.full_text);
      } finally {
        setLoadingText(false);
      }
    }
  };

  return (
    <div className="doc-panel">
      <div className="doc-head">
        <div>
          <div className="eyebrow">{source.doc_type} · {source.authority_tier}</div>
          <h2>{source.title}</h2>
          <div className="refno">{source.number || 'no reference number'} · v{source.version}</div>
        </div>
        <span className={`status-pill ${source.status}`}>{source.status}</span>
      </div>

      {source.summary?.text && (
        <div className="ai-summary">
          <div className="ai-summary-tag">{source.summary.derived ? 'AI-derived summary' : 'summary'}</div>
          <p>{source.summary.text}</p>
        </div>
      )}

      <div className="count-row">
        <span><b className="tabular">{requirement_count}</b> requirements</span>
        <span><b className="tabular">{sanction_count}</b> sanctions</span>
        <span><b className="tabular">{dependency_count}</b> dependency edges</span>
      </div>

      <Section title="Identity">
        <Field label="Issuer">{source.issuer ? `${source.issuer.name} (${source.issuer.code})` : null}</Field>
        <Field label="Legacy RegWatch ID">{source.legacy_regwatch_id}</Field>
        <Field label="Secondary references">
          {source.secondary_refs?.length > 0 && (
            <div className="chip-row">{source.secondary_refs.map((r) => <span className="chip" key={r}>{r}</span>)}</div>
          )}
        </Field>
      </Section>

      <Section title="Jurisdiction">
        <Field label="Country">{source.jurisdiction?.country}</Field>
        <Field label="Level">{source.jurisdiction?.level}</Field>
        <Field label="Applies to">
          {source.jurisdiction?.applies_to?.length > 0 && (
            <div className="chip-row">{source.jurisdiction.applies_to.map((a) => <span className="chip" key={a}>{a}</span>)}</div>
          )}
        </Field>
      </Section>

      <Section title="Timeline">
        <Field label="Issued">{fmtDate(source.issued_date)}</Field>
        <Field label="Commencement">
          {source.commencement?.date && `${fmtDate(source.commencement.date)} (${source.commencement.status})`}
        </Field>
        <Field label="Valid from">{fmtDate(source.valid_from)}</Field>
        <Field label="Valid to">{fmtDate(source.valid_to)}</Field>
        <Field label="Amendment date">{fmtDate(source.amendment_date)}</Field>
        <Field label="Publication reference">{source.publication_ref}</Field>
      </Section>
      {source.commencement?.basis && (
        <p className="commencement-basis"><b>Commencement basis:</b> {source.commencement.basis}</p>
      )}

      <Section title="Lineage &amp; verification">
        <Field label="Supersedes" mono>{source.supersedes}</Field>
        <Field label="Superseded by" mono>{source.superseded_by}</Field>
        <Field label="Changes from previous">
          {source.changes_from_previous?.sections_changed?.length > 0 && (
            <div className="chip-row">{source.changes_from_previous.sections_changed.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
          )}
        </Field>
        <Field label="Verified by">{source.verified_by}</Field>
        <Field label="Verified at">{fmtDate(source.verified_at)}</Field>
      </Section>

      <Section title="Official copy &amp; extraction">
        <Field label="Document URL">
          {source.official_copy?.url && (
            <a href={source.official_copy.url} target="_blank" rel="noopener noreferrer">{source.official_copy.format?.toUpperCase() || 'link'}</a>
          )}
        </Field>
        <Field label="SHA-256" mono>{source.official_copy?.sha256}</Field>
        <Field label="Retrieved">{fmtDate(source.official_copy?.retrieved_at)} {source.official_copy?.retrieval_method ? `· ${source.official_copy.retrieval_method}` : ''}</Field>
        <Field label="Pages extracted">
          {source.extraction && (
            <>
              <span className="tabular">{source.extraction.page_count}</span>
              {source.extraction.ocr_pages?.length > 0 && (
                <span style={{ color: 'var(--muted)' }}> · {source.extraction.ocr_pages.length} OCR'd</span>
              )}
            </>
          )}
        </Field>
        <Field label="In force">{source.extraction?.in_force === true ? 'yes' : source.extraction?.in_force === false ? 'no' : null}</Field>
        <Field label="Document class">{source.extraction?.doc_class}</Field>
      </Section>

      {source.known_gaps?.length > 0 && (
        <div className="callout">
          <div className="callout-title">Known extraction gaps ({source.known_gaps.length})</div>
          <ul>
            {source.known_gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}

      <button className="text-toggle" onClick={toggleFullText}>
        {showText ? 'Hide full text' : 'View full text'}
      </button>
      {showText && (
        <div className="fulltext-box">
          {loadingText && <div className="empty-state">Loading full text…</div>}
          {!loadingText && fullText && <pre>{fullText}</pre>}
        </div>
      )}

      <div className="audit-row">
        <span><b>Created</b> {fmtDate(source.created_at)} by {source.created_by}</span>
        <span><b>Updated</b> {fmtDate(source.updated_at)} by {source.updated_by}</span>
      </div>
    </div>
  );
}
