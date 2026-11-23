import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../client/dist');

const PORT = process.env.PORT || 4000;
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);
let erisDb;
let erisRegDb;

const app = express();
app.use(cors());

function toId(v) {
  return v == null ? null : String(v);
}

/* ============================================================
 * /api/tasks — the "eris" database: a clause/task-template
 * compliance framework (sources -> elements -> task_templates,
 * plus risk_scenarios and a controlled vocabulary).
 * ============================================================ */

function serializeTaskSource(s) {
  return {
    id: toId(s._id),
    work_key: s.work_key,
    title: s.title,
    ref_no: s.ref_no,
    edition: s.edition,
    status: s.status,
    issuer_code: s.issuer_code,
    instrument_type: s.instrument_type,
    legal_force: s.legal_force,
    lifecycle: s.lifecycle,
    language: s.language,
    jurisdictions: s.jurisdictions || [],
    consequence_anchors: s.consequence_anchors || [],
    issued_on: s.issued_on,
    effective_on: s.effective_on,
    transition_until: s.transition_until,
    supersedes_id: toId(s.supersedes_id),
    legal_basis_ids: (s.legal_basis_ids || []).map(toId),
    amends_ids: (s.amends_ids || []).map(toId),
    doc: s.doc || {},
    ingestion: s.ingestion || {},
    locked_at: s.locked_at,
    org_id: s.org_id,
    created_at: s.created_at,
    created_by: s.created_by,
    updated_at: s.updated_at,
    updated_by: s.updated_by,
  };
}

function serializeElement(e) {
  return {
    id: toId(e._id),
    key: e.key,
    native_ref: e.native_ref,
    title: e.title,
    class: e.class || null,
    tier: e.tier || null,
    level: e.level,
    order: e.order,
    parent_id: toId(e.parent_id),
    text_informative: e.text_informative || [],
    status: e.status,
  };
}

function serializeTask(t) {
  return {
    id: toId(t._id),
    element_id: toId(t.element_id),
    title: t.title,
    description: t.description,
    mandatory: t.mandatory,
    kind: t.kind,
    frequency: t.frequency,
    owner_role: t.owner_role,
    completion_rule: t.completion_rule,
    evidence_spec: t.evidence_spec || [],
    status: t.status,
  };
}

app.get('/api/tasks/overview', async (req, res) => {
  const [sources, elements, tasks, risks, issuers, vocab] = await Promise.all([
    erisDb.collection('sources').countDocuments(),
    erisDb.collection('elements').countDocuments(),
    erisDb.collection('task_templates').countDocuments(),
    erisDb.collection('risk_scenarios').countDocuments(),
    erisDb.collection('issuers').countDocuments(),
    erisDb.collection('vocab').countDocuments(),
  ]);

  const sourceDocs = await erisDb.collection('sources').find().toArray();
  const taskCounts = await erisDb.collection('task_templates').aggregate([
    { $lookup: { from: 'elements', localField: 'element_id', foreignField: '_id', as: 'el' } },
    { $unwind: '$el' },
    { $group: { _id: '$el.source_id', count: { $sum: 1 } } },
  ]).toArray();
  const taskCountMap = new Map(taskCounts.map((t) => [toId(t._id), t.count]));

  const elementCounts = await erisDb.collection('elements').aggregate([
    { $group: { _id: '$source_id', count: { $sum: 1 } } },
  ]).toArray();
  const elementCountMap = new Map(elementCounts.map((e) => [toId(e._id), e.count]));

  const sourcesSummary = sourceDocs.map((s) => ({
    ...serializeTaskSource(s),
    element_count: elementCountMap.get(toId(s._id)) || 0,
    task_count: taskCountMap.get(toId(s._id)) || 0,
  }));

  res.json({
    counts: { sources, elements, task_templates: tasks, risk_scenarios: risks, issuers, vocab },
    sources: sourcesSummary,
  });
});

app.get('/api/tasks/sources', async (req, res) => {
  const sourceDocs = await erisDb.collection('sources').find().toArray();
  const elementCounts = await erisDb.collection('elements').aggregate([
    { $group: { _id: '$source_id', count: { $sum: 1 } } },
  ]).toArray();
  const elementCountMap = new Map(elementCounts.map((e) => [toId(e._id), e.count]));

  const taskCounts = await erisDb.collection('task_templates').aggregate([
    { $lookup: { from: 'elements', localField: 'element_id', foreignField: '_id', as: 'el' } },
    { $unwind: '$el' },
    { $group: { _id: '$el.source_id', count: { $sum: 1 } } },
  ]).toArray();
  const taskCountMap = new Map(taskCounts.map((t) => [toId(t._id), t.count]));

  const issuerDocs = await erisDb.collection('issuers').find().toArray();
  const issuerMap = new Map(issuerDocs.map((i) => [i.code, i]));

  res.json(sourceDocs.map((s) => ({
    ...serializeTaskSource(s),
    element_count: elementCountMap.get(toId(s._id)) || 0,
    task_count: taskCountMap.get(toId(s._id)) || 0,
    issuer_name: issuerMap.get(s.issuer_code)?.name || s.issuer_code,
  })));
});

app.get('/api/tasks/sources/:id', async (req, res) => {
  let _id;
  try {
    _id = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'invalid id' });
  }
  const source = await erisDb.collection('sources').findOne({ _id });
  if (!source) return res.status(404).json({ error: 'not found' });

  const issuer = await erisDb.collection('issuers').findOne({ code: source.issuer_code });

  const elements = await erisDb.collection('elements').find({ source_id: _id }).sort({ level: 1, order: 1 }).toArray();
  const elementIds = elements.map((e) => e._id);

  const taskCounts = await erisDb.collection('task_templates').aggregate([
    { $match: { element_id: { $in: elementIds } } },
    { $group: { _id: '$element_id', count: { $sum: 1 } } },
  ]).toArray();
  const taskCountMap = new Map(taskCounts.map((t) => [toId(t._id), t.count]));

  const nodesById = new Map();
  elements.forEach((e) => {
    nodesById.set(toId(e._id), { ...serializeElement(e), task_count: taskCountMap.get(toId(e._id)) || 0, children: [] });
  });
  const roots = [];
  nodesById.forEach((node) => {
    if (node.parent_id && nodesById.has(node.parent_id)) {
      nodesById.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortTree = (list) => {
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    list.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);

  const addSubtreeTaskTotal = (node) => {
    let total = node.task_count;
    node.children.forEach((c) => {
      total += addSubtreeTaskTotal(c);
    });
    node.subtree_task_count = total;
    return total;
  };
  roots.forEach(addSubtreeTaskTotal);

  res.json({
    source: serializeTaskSource(source),
    issuer: issuer ? { code: issuer.code, name: issuer.name, kind: issuer.kind, country: issuer.country } : null,
    element_count: elements.length,
    task_count: taskCounts.reduce((a, t) => a + t.count, 0),
    tree: roots,
  });
});

app.get('/api/tasks/elements/:id/tasks', async (req, res) => {
  let element_id;
  try {
    element_id = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'invalid id' });
  }
  const element = await erisDb.collection('elements').findOne({ _id: element_id });
  const tasks = await erisDb.collection('task_templates').find({ element_id }).toArray();
  res.json({
    element: element ? serializeElement(element) : null,
    tasks: tasks.map(serializeTask),
  });
});

app.get('/api/tasks/risk-scenarios', async (req, res) => {
  const risks = await erisDb.collection('risk_scenarios').find().toArray();
  res.json(risks.map((r) => ({
    id: toId(r._id),
    code: r.code,
    title: r.title,
    description: r.description,
    categories: r.categories || [],
    default_likelihood: r.default_likelihood,
    default_impact: r.default_impact,
    anchor: r.anchor,
    status: r.status,
  })));
});

app.get('/api/tasks/vocab', async (req, res) => {
  const vocab = await erisDb.collection('vocab').find().sort({ type: 1, rank: 1 }).toArray();
  res.json(vocab.map((v) => ({
    id: toId(v._id),
    type: v.type,
    code: v.code,
    label: v.label,
    parent_code: v.parent_code,
    rank: v.rank,
    status: v.status,
  })));
});

/* ============================================================
 * /api/reg — the "eris_reg" database: AI-extracted regulatory
 * requirements decomposed from raw regulation text, plus
 * sanctions, dependency edges, relationships, conflicts and
 * canonical requirements.
 * ============================================================ */

// sanction_id follows "SNC-<source_id>-NN"; dependency/requirement docs carry
// source_id directly, but sanctions don't, so this is the only link available.
function sanctionSourceId(sanctionId) {
  const m = /^SNC-(.+)-\d+$/.exec(sanctionId || '');
  return m ? m[1] : null;
}

function serializeRegSource(s) {
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
    review: r.review || null,
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

function serializeRelationship(r) {
  return {
    id: toId(r._id),
    from_id: r.from_id,
    to_id: r.to_id,
    type: r.type,
    topic_id: r.topic_id,
    rationale: r.rationale,
    confidence: r.confidence,
    reviewer: r.reviewer,
    from_version: r.from_version,
    to_version: r.to_version,
    status: r.status,
    revalidate: r.revalidate || null,
  };
}

function serializeConflict(c) {
  return {
    id: toId(c._id),
    kind: c.kind,
    members: c.members || [],
    pinned_versions: c.pinned_versions || [],
    legal_review_status: c.legal_review_status,
    working_standard: c.working_standard,
    reason: c.reason,
    precedence_rank: c.precedence_rank,
    precedence_outcome: c.precedence_outcome,
    decider: c.decider,
    decision: c.decision,
    status: c.status,
  };
}

function serializeCanonical(c) {
  return {
    id: toId(c._id),
    canonical_id: c.canonical_id,
    description: c.description,
    topic_id: c.topic_id,
    requirement_ids: c.requirement_ids || [],
  };
}

// Bulk per-source counts for ALL sources in 3 aggregate queries total, instead
// of 3 queries PER source (the eris_reg "sources" collection can hold hundreds
// of regulations, so an O(n) fan-out here is a real bottleneck, not a style
// nit - a single-source version of this once blocked the whole event loop).
async function regAllSourceCounts() {
  const [reqCounts, sanctionDocs, depCounts] = await Promise.all([
    erisRegDb.collection('requirements').aggregate([
      { $group: { _id: '$source_id', count: { $sum: 1 } } },
    ]).toArray(),
    erisRegDb.collection('sanctions').find({}, { projection: { sanction_id: 1 } }).toArray(),
    erisRegDb.collection('dependency_edges').aggregate([
      { $group: { _id: '$from_source_id', count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const reqMap = new Map(reqCounts.map((r) => [r._id, r.count]));
  const depMap = new Map(depCounts.map((d) => [d._id, d.count]));
  const sancMap = new Map();
  sanctionDocs.forEach((s) => {
    const sid = sanctionSourceId(s.sanction_id);
    if (sid) sancMap.set(sid, (sancMap.get(sid) || 0) + 1);
  });
  return { reqMap, depMap, sancMap };
}

function pickRegSourceCounts({ reqMap, depMap, sancMap }, sourceId) {
  return {
    requirement_count: reqMap.get(sourceId) || 0,
    sanction_count: sancMap.get(sourceId) || 0,
    dependency_count: depMap.get(sourceId) || 0,
  };
}

// Single-source version for the :sourceId detail route, where an O(1) lookup
// isn't worth building the full maps.
async function regSourceCounts(sourceId) {
  const [requirement_count, sanctions, dependency_count] = await Promise.all([
    erisRegDb.collection('requirements').countDocuments({ source_id: sourceId }),
    erisRegDb.collection('sanctions').find({}, { projection: { sanction_id: 1 } }).toArray(),
    erisRegDb.collection('dependency_edges').countDocuments({ from_source_id: sourceId }),
  ]);
  const sanction_count = sanctions.filter((s) => sanctionSourceId(s.sanction_id) === sourceId).length;
  return { requirement_count, sanction_count, dependency_count };
}

app.get('/api/reg/overview', async (req, res) => {
  const [sources, requirements, sanctions, dependency_edges, relationships, conflicts, canonical_requirements, refTopics] = await Promise.all([
    erisRegDb.collection('sources').countDocuments(),
    erisRegDb.collection('requirements').countDocuments(),
    erisRegDb.collection('sanctions').countDocuments(),
    erisRegDb.collection('dependency_edges').countDocuments(),
    erisRegDb.collection('relationships').countDocuments(),
    erisRegDb.collection('conflicts_and_cycles').countDocuments(),
    erisRegDb.collection('canonical_requirements').countDocuments(),
    erisRegDb.collection('reference_data').findOne({ _id: 'topics' }),
  ]);
  const critical_requirements = await erisRegDb.collection('requirements').countDocuments({ is_critical: true });

  const [sourceDocs, countMaps] = await Promise.all([
    erisRegDb.collection('sources').find().toArray(),
    regAllSourceCounts(),
  ]);
  const sourcesSummary = sourceDocs.map((s) => ({
    ...serializeRegSource(s),
    ...pickRegSourceCounts(countMaps, s.source_id),
  }));

  res.json({
    counts: {
      sources,
      requirements,
      critical_requirements,
      sanctions,
      dependency_edges,
      relationships,
      conflicts,
      canonical_requirements,
      topics: (refTopics?.values || []).length,
    },
    sources: sourcesSummary,
  });
});

app.get('/api/reg/sources', async (req, res) => {
  const [sourceDocs, countMaps] = await Promise.all([
    erisRegDb.collection('sources').find().toArray(),
    regAllSourceCounts(),
  ]);
  res.json(sourceDocs.map((s) => ({
    ...serializeRegSource(s),
    ...pickRegSourceCounts(countMaps, s.source_id),
  })));
});

app.get('/api/reg/sources/:sourceId', async (req, res) => {
  const source = await erisRegDb.collection('sources').findOne({ source_id: req.params.sourceId });
  if (!source) return res.status(404).json({ error: 'not found' });

  const counts = await regSourceCounts(source.source_id);
  const topicBreakdown = await erisRegDb.collection('requirements').aggregate([
    { $match: { source_id: source.source_id } },
    { $group: { _id: '$topic_id', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  res.json({
    source: serializeRegSource(source),
    ...counts,
    topic_breakdown: topicBreakdown.map((t) => ({ topic_id: t._id, count: t.count })),
  });
});

app.get('/api/reg/sources/:sourceId/full-text', async (req, res) => {
  const source = await erisRegDb.collection('sources').findOne(
    { source_id: req.params.sourceId },
    { projection: { full_text: 1 } }
  );
  if (!source) return res.status(404).json({ error: 'not found' });
  res.json({ full_text: source.full_text || '' });
});

app.get('/api/reg/sources/:sourceId/requirements', async (req, res) => {
  const { topic, critical, status, q } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 100);

  const match = { source_id: req.params.sourceId };
  if (topic) match.topic_id = topic;
  if (critical === 'true') match.is_critical = true;
  if (status) match.status = status;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ summary: re }, { original_text: re }, { citation: re }, { requirement_id: re }];
  }

  const total = await erisRegDb.collection('requirements').countDocuments(match);
  const items = await erisRegDb.collection('requirements')
    .find(match)
    .sort({ 'anchor.start': 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  res.json({ total, page, pageSize, items: items.map(serializeRequirement) });
});

app.get('/api/reg/requirements/:requirementId', async (req, res) => {
  const r = await erisRegDb.collection('requirements').findOne({ requirement_id: req.params.requirementId });
  if (!r) return res.status(404).json({ error: 'not found' });

  let sanctions = [];
  if (r.sanction_refs && r.sanction_refs.length > 0) {
    sanctions = await erisRegDb.collection('sanctions')
      .find({ sanction_id: { $in: r.sanction_refs } })
      .toArray();
  }

  res.json({
    requirement: serializeRequirement(r),
    sanctions: sanctions.map(serializeSanction),
  });
});

app.get('/api/reg/sanctions', async (req, res) => {
  const all = await erisRegDb.collection('sanctions').find().toArray();
  res.json(all.map(serializeSanction));
});

app.get('/api/reg/dependencies', async (req, res) => {
  const edges = await erisRegDb.collection('dependency_edges').find().toArray();
  res.json(edges.map(serializeEdge));
});

app.get('/api/reg/relationships', async (req, res) => {
  const all = await erisRegDb.collection('relationships').find().toArray();
  res.json(all.map(serializeRelationship));
});

app.get('/api/reg/conflicts', async (req, res) => {
  const all = await erisRegDb.collection('conflicts_and_cycles').find().toArray();
  res.json(all.map(serializeConflict));
});

app.get('/api/reg/canonical-requirements', async (req, res) => {
  const all = await erisRegDb.collection('canonical_requirements').find().toArray();
  res.json(all.map(serializeCanonical));
});

app.get('/api/reg/reference-data', async (req, res) => {
  const docs = await erisRegDb.collection('reference_data').find().toArray();
  const out = {};
  docs.forEach((d) => { out[d._id] = d.values || []; });
  res.json(out);
});

app.get('/api/reg/activity', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const entries = await erisRegDb.collection('audit_log').find().sort({ at: -1 }).limit(limit).toArray();
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
  erisDb = client.db('eris');
  erisRegDb = client.db('eris_reg');
  app.listen(PORT, () => console.log(`eris-display API listening on http://localhost:${PORT}`));
}).catch((err) => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});
