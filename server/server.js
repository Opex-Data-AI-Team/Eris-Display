import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../client/dist');

const PORT = process.env.PORT || 4000;
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'eris_reg';

const client = new MongoClient(uri);
let db;

const app = express();
app.use(cors());

function toId(v) {
  return v == null ? null : String(v);
}

// sanction_id follows "SNC-<source_id>-NN"; dependency/requirement docs carry
// source_id directly, but sanctions don't, so this is the only link available.
function sanctionSourceId(sanctionId) {
  const m = /^SNC-(.+)-\d+$/.exec(sanctionId || '');
  return m ? m[1] : null;
}

function serializeSource(s) {
  return {
    source_id: s.source_id,
    legacy_regwatch_id: s.legacy_regwatch_id,
    version: s.version,
    supersedes: s.supersedes,
    superseded_by: s.superseded_by,
    changes_from_previous: s.changes_from_previous,
    status: s.status,
    issuer: s.issuer || null,
    regulator_id: s.regulator_id,
    number: s.number,
    secondary_refs: s.secondary_refs || [],
    title: s.title,
    doc_type: s.doc_type,
    authority_tier: s.authority_tier,
    jurisdiction: s.jurisdiction || null,
    publication_ref: s.publication_ref,
    issued_date: s.issued_date,
    commencement: s.commencement || null,
    valid_from: s.valid_from,
    valid_to: s.valid_to,
    amendment_date: s.amendment_date,
    official_copy: s.official_copy || null,
    summary: s.summary || null,
    depends_on: s.depends_on || [],
    verified_by: s.verified_by,
    verified_at: s.verified_at,
    known_gaps: s.known_gaps || [],
    extraction: s.extraction
      ? {
          page_count: s.extraction.page_count,
          ocr_pages: s.extraction.ocr_pages || [],
          in_force: s.extraction.in_force,
          doc_class: s.extraction.doc_class,
        }
      : null,
    created_at: s.created_at,
    created_by: s.created_by,
    updated_at: s.updated_at,
    updated_by: s.updated_by,
  };
}

function serializeRequirement(r) {
  return {
    id: toId(r._id),
    requirement_id: r.requirement_id,
    source_id: r.source_id,
    source_version: r.source_version,
    citation: r.citation,
    original_text: r.original_text,
    summary: r.summary,
    unit_type: r.unit_type,
    duty_holder: r.duty_holder || [],
    sanction_refs: r.sanction_refs || [],
    mandatory: r.mandatory,
    missing_dependency: r.missing_dependency || null,
    deferred: r.deferred || null,
    review: r.review,
    status: r.status,
    batch_id: r.batch_id,
    ai: r.ai || null,
    topic_id: r.topic_id,
    canonical_state: r.canonical_state,
    parameters: r.parameters || [],
    periods: r.periods || [],
    applicability_rule: r.applicability_rule,
    anchor: r.anchor || null,
    is_critical: r.is_critical,
    guidance_reason: r.guidance_reason,
    review_flags: r.review_flags || [],
    pages: r.pages || [],
    created_at: r.created_at,
  };
}

function serializeSanction(s) {
  return {
    id: toId(s._id),
    sanction_id: s.sanction_id,
    source_id: sanctionSourceId(s.sanction_id),
    requirement_ids: s.requirement_ids || [],
    monetary: s.monetary,
    custodial_term: s.custodial_term,
    non_monetary: s.non_monetary || [],
    applies_to: s.applies_to || [],
    largest_applicable: s.largest_applicable,
    citation: s.citation,
    original_text: s.original_text,
    summary: s.summary,
    relates_to: s.relates_to,
    notes: s.notes,
    anchor: s.anchor || null,
    review_flags: s.review_flags || [],
  };
}

function serializeEdge(d) {
  return {
    id: toId(d._id),
    from_source_id: d.from_source_id,
    from_section: d.from_section,
    to_source_id: d.to_source_id,
    to_name: d.to_name,
    to_section: d.to_section,
    held: d.held,
  };
}

async function sourceCounts(sourceId) {
  const [requirement_count, sanctions, dependency_count] = await Promise.all([
    db.collection('requirements').countDocuments({ source_id: sourceId }),
    db.collection('sanctions').find().toArray(),
    db.collection('dependency_edges').countDocuments({ from_source_id: sourceId }),
  ]);
  const sanction_count = sanctions.filter((s) => sanctionSourceId(s.sanction_id) === sourceId).length;
  return { requirement_count, sanction_count, dependency_count };
}

app.get('/api/overview', async (req, res) => {
  const [sources, requirements, sanctions, dependency_edges, refTopics] = await Promise.all([
    db.collection('sources').countDocuments(),
    db.collection('requirements').countDocuments(),
    db.collection('sanctions').countDocuments(),
    db.collection('dependency_edges').countDocuments(),
    db.collection('reference_data').findOne({ _id: 'topics' }),
  ]);
  const critical_requirements = await db.collection('requirements').countDocuments({ is_critical: true });

  const sourceDocs = await db.collection('sources').find().toArray();
  const sourcesSummary = await Promise.all(
    sourceDocs.map(async (s) => ({ ...serializeSource(s), ...(await sourceCounts(s.source_id)) }))
  );

  res.json({
    counts: {
      sources,
      requirements,
      critical_requirements,
      sanctions,
      dependency_edges,
      topics: (refTopics?.values || []).length,
    },
    sources: sourcesSummary,
  });
});

app.get('/api/sources', async (req, res) => {
  const sourceDocs = await db.collection('sources').find().toArray();
  const summary = await Promise.all(
    sourceDocs.map(async (s) => ({ ...serializeSource(s), ...(await sourceCounts(s.source_id)) }))
  );
  res.json(summary);
});

app.get('/api/sources/:sourceId', async (req, res) => {
  const source = await db.collection('sources').findOne({ source_id: req.params.sourceId });
  if (!source) return res.status(404).json({ error: 'not found' });

  const counts = await sourceCounts(source.source_id);
  const topicBreakdown = await db.collection('requirements').aggregate([
    { $match: { source_id: source.source_id } },
    { $group: { _id: '$topic_id', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  res.json({
    source: serializeSource(source),
    ...counts,
    topic_breakdown: topicBreakdown.map((t) => ({ topic_id: t._id, count: t.count })),
  });
});

app.get('/api/sources/:sourceId/full-text', async (req, res) => {
  const source = await db.collection('sources').findOne(
    { source_id: req.params.sourceId },
    { projection: { full_text: 1 } }
  );
  if (!source) return res.status(404).json({ error: 'not found' });
  res.json({ full_text: source.full_text || '' });
});

app.get('/api/sources/:sourceId/requirements', async (req, res) => {
  const { topic, critical, q } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 100);

  const match = { source_id: req.params.sourceId };
  if (topic) match.topic_id = topic;
  if (critical === 'true') match.is_critical = true;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ summary: re }, { original_text: re }, { citation: re }, { requirement_id: re }];
  }

  const total = await db.collection('requirements').countDocuments(match);
  const items = await db.collection('requirements')
    .find(match)
    .sort({ 'anchor.start': 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  res.json({ total, page, pageSize, items: items.map(serializeRequirement) });
});

app.get('/api/requirements/:requirementId', async (req, res) => {
  const r = await db.collection('requirements').findOne({ requirement_id: req.params.requirementId });
  if (!r) return res.status(404).json({ error: 'not found' });

  let sanctions = [];
  if (r.sanction_refs && r.sanction_refs.length > 0) {
    sanctions = await db.collection('sanctions')
      .find({ sanction_id: { $in: r.sanction_refs } })
      .toArray();
  }

  res.json({
    requirement: serializeRequirement(r),
    sanctions: sanctions.map(serializeSanction),
  });
});

app.get('/api/sanctions', async (req, res) => {
  const all = await db.collection('sanctions').find().toArray();
  res.json(all.map(serializeSanction));
});

app.get('/api/dependencies', async (req, res) => {
  const edges = await db.collection('dependency_edges').find().toArray();
  res.json(edges.map(serializeEdge));
});

app.get('/api/sources/:sourceId/sanctions', async (req, res) => {
  const all = await db.collection('sanctions').find().toArray();
  const filtered = all.filter((s) => sanctionSourceId(s.sanction_id) === req.params.sourceId);
  res.json(filtered.map(serializeSanction));
});

app.get('/api/sources/:sourceId/dependencies', async (req, res) => {
  const edges = await db.collection('dependency_edges')
    .find({ $or: [{ from_source_id: req.params.sourceId }, { to_source_id: req.params.sourceId }] })
    .toArray();
  res.json(edges.map(serializeEdge));
});

app.get('/api/reference-data', async (req, res) => {
  const docs = await db.collection('reference_data').find().toArray();
  const out = {};
  docs.forEach((d) => { out[d._id] = d.values || []; });
  res.json(out);
});

app.get('/api/activity', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const entries = await db.collection('audit_log').find().sort({ at: -1 }).limit(limit).toArray();
  res.json(entries.map((e) => ({
    id: toId(e._id),
    record_type: e.record_type,
    record_id: e.record_id,
    step: e.step,
    action: e.action,
    actor: e.actor,
    ai_provenance: e.ai_provenance || null,
    reason: e.reason,
    at: e.at,
  })));
});

app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

client.connect().then(() => {
  db = client.db(dbName);
  app.listen(PORT, () => console.log(`eris-display API listening on http://localhost:${PORT}`));
}).catch((err) => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});
