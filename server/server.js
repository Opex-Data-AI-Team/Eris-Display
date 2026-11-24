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

// Explicit timeouts so a stuck socket gets recycled instead of holding a
// connection out of the pool forever - without this, a handful of slow or
// interrupted operations can quietly exhaust maxPoolSize and the whole app
// stops responding (even to unrelated requests) with no error logged.
const client = new MongoClient(uri, {
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 20000,
  connectTimeoutMS: 15000,
});
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
 * requirements decomposed from raw regulation text, organized into
 * a full compliance chain:
 *
 *   sources -> requirements -> canonical_requirements (cross-source
 *   dedup by topic) -> control_objectives (outcome needed) ->
 *   controls (concrete activity), optionally instantiating a named
 *   control_patterns library entry.
 *
 *   requirements also carry sanction_refs (-> sanctions) and the
 *   whole thing is cross-linked by a generic "relationships" graph
 *   (satisfies / partially_satisfies / related / depends_on /
 *   conflicts) plus per-source "dependency_edges".
 *
 * Every reference in this schema is a Mongo ObjectId, not a human
 * string key (an earlier version of this schema used string ids
 * like "CBN-NONSECU26"; that's gone - ids below are always _id).
 * ============================================================ */

function oid(v) {
  if (v == null) return null;
  if (v instanceof ObjectId) return v;
  try { return new ObjectId(v); } catch { return null; }
}

function uniqueObjectIds(arr) {
  const seen = new Map();
  (arr || []).forEach((v) => {
    const o = oid(v);
    if (o) seen.set(o.toString(), o);
  });
  return [...seen.values()];
}

function pageParams(req, defaultSize = 25, maxSize = 100) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || defaultSize, 1), maxSize);
  return { page, pageSize };
}

function searchRegex(q) {
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

async function resolveSourceTitles(ids) {
  const objIds = uniqueObjectIds(ids);
  if (objIds.length === 0) return new Map();
  const docs = await erisRegDb.collection('sources')
    .find({ _id: { $in: objIds } }, { projection: { title: 1, number: 1, issuer: 1 } })
    .toArray();
  return new Map(docs.map((d) => [toId(d._id), { id: toId(d._id), title: d.title, number: d.number, issuer: d.issuer || null }]));
}

async function resolveRequirementSummaries(ids) {
  const objIds = uniqueObjectIds(ids);
  if (objIds.length === 0) return new Map();
  const docs = await erisRegDb.collection('requirements')
    .find({ _id: { $in: objIds } }, { projection: { citation: 1, summary: 1, source_id: 1, topic_id: 1, is_critical: 1, status: 1 } })
    .toArray();
  return new Map(docs.map((d) => [toId(d._id), {
    id: toId(d._id), citation: d.citation, summary: d.summary, source_id: toId(d.source_id),
    topic_id: d.topic_id, is_critical: d.is_critical, status: d.status,
  }]));
}

// relationships.from_id/to_id (and a few other refs) can point at a
// requirement, a canonical_requirement, a control_objective or a source -
// there's no tag saying which, so this checks all four collections at once.
async function describeEntities(ids) {
  const objIds = uniqueObjectIds(ids);
  const out = new Map();
  if (objIds.length === 0) return out;
  const [reqs, cans, objs, srcs] = await Promise.all([
    erisRegDb.collection('requirements').find({ _id: { $in: objIds } }, { projection: { citation: 1, summary: 1 } }).toArray(),
    erisRegDb.collection('canonical_requirements').find({ _id: { $in: objIds } }, { projection: { description: 1, topic_id: 1 } }).toArray(),
    erisRegDb.collection('control_objectives').find({ _id: { $in: objIds } }, { projection: { outcome: 1, topic_id: 1 } }).toArray(),
    erisRegDb.collection('sources').find({ _id: { $in: objIds } }, { projection: { title: 1, number: 1 } }).toArray(),
  ]);
  reqs.forEach((d) => out.set(toId(d._id), { kind: 'requirement', label: d.citation, detail: d.summary }));
  cans.forEach((d) => out.set(toId(d._id), { kind: 'canonical', label: d.description, detail: d.topic_id }));
  objs.forEach((d) => out.set(toId(d._id), { kind: 'objective', label: d.outcome, detail: d.topic_id }));
  srcs.forEach((d) => out.set(toId(d._id), { kind: 'source', label: d.title, detail: d.number }));
  return out;
}

function serializeRegSource(s) {
  return {
    id: toId(s._id),
    legacy_regwatch_id: s.legacy_regwatch_id,
    version: s.version,
    supersedes: toId(s.supersedes),
    superseded_by: toId(s.superseded_by),
    changes_from_previous: s.changes_from_previous || null,
    status: s.status,
    issuer: s.issuer || null,
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
    depends_on: (s.depends_on || []).map((d) => ({ ...d, target_source_id: toId(d.target_source_id) })),
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
    source_id: toId(r.source_id),
    source_version: r.source_version,
    citation: r.citation,
    original_text: r.original_text,
    summary: r.summary,
    unit_type: r.unit_type,
    duty_holder: r.duty_holder || [],
    sanction_refs: (r.sanction_refs || []).map(toId),
    mandatory: r.mandatory,
    mandatory_basis: r.mandatory_basis,
    missing_dependency: r.missing_dependency || null,
    deferred: r.deferred || null,
    review: r.review || null,
    status: r.status,
    ai: r.ai || null,
    topic_id: r.topic_id,
    topic_id_original: r.topic_id_original,
    topic_parent: r.topic_parent,
    canonical_state: r.canonical_state,
    canonical_id: toId(r.canonical_id),
    parameters: r.parameters || [],
    periods: r.periods || [],
    applicability_rule: r.applicability_rule,
    anchor: r.anchor || null,
    is_critical: r.is_critical,
    is_critical_basis: r.is_critical_basis,
    guidance_reason: r.guidance_reason,
    review_flags: r.review_flags || [],
    pages: r.pages || [],
    created_at: r.created_at,
  };
}

function serializeSanction(s) {
  return {
    id: toId(s._id),
    source_id: toId(s.source_id),
    source_version: s.source_version,
    requirement_ids: (s.requirement_ids || []).map(toId),
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
    link_basis: s.link_basis,
    link_confidence: s.link_confidence,
    link_status: s.link_status,
  };
}

function serializeEdge(d) {
  return {
    id: toId(d._id),
    source_id: toId(d.source_id),
    from_section: d.from_section,
    to_source_id: toId(d.to_source_id),
    to_name: d.to_name,
    to_section: d.to_section,
    held: d.held,
  };
}

function serializeRelationship(r) {
  return {
    id: toId(r._id),
    from_id: toId(r.from_id),
    to_id: toId(r.to_id),
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

function serializeCanonical(c) {
  return {
    id: toId(c._id),
    description: c.description,
    topic_id: c.topic_id,
    requirement_ids: (c.requirement_ids || []).map(toId),
    rationale: c.rationale,
    confidence: c.confidence,
    status: c.status,
    reviewer: c.reviewer,
    created_at: c.created_at,
  };
}

function serializeControlObjective(o) {
  return {
    id: toId(o._id),
    canonical_id: toId(o.canonical_id),
    requirement_ids: (o.requirement_ids || []).map(toId),
    direct_requirement_link: o.direct_requirement_link,
    outcome: o.outcome,
    rationale: o.rationale,
    topic_id: o.topic_id,
    proposed_patterns: o.proposed_patterns || [],
    status: o.status,
    reviewer: o.reviewer,
    owner: o.owner,
    confidence: o.confidence,
    version: o.version,
    supersedes: toId(o.supersedes),
    superseded_by: toId(o.superseded_by),
    ai: o.ai || null,
    created_at: o.created_at,
  };
}

function serializeControl(c) {
  return {
    id: toId(c._id),
    objective_id: toId(c.objective_id),
    pattern_id: c.pattern_id,
    activity: c.activity,
    type: c.type,
    nature: c.nature,
    frequency: c.frequency,
    owner: c.owner,
    owner_role: c.owner_role,
    evidence_types: c.evidence_types || [],
    alternatives: c.alternatives || [],
    status: c.status,
    reviewer: c.reviewer,
    version: c.version,
    supersedes: toId(c.supersedes),
    superseded_by: toId(c.superseded_by),
    ai: c.ai || null,
    created_at: c.created_at,
  };
}

// Bulk per-source counts for ALL sources in 3 aggregate queries total, instead
// of 3 queries PER source (the eris_reg "sources" collection can hold hundreds
// of regulations, so an O(n) fan-out here is a real bottleneck, not a style
// nit - a single-source version of this once blocked the whole event loop).
async function regAllSourceCounts() {
  const [reqCounts, sancCounts, depCounts] = await Promise.all([
    erisRegDb.collection('requirements').aggregate([{ $group: { _id: '$source_id', count: { $sum: 1 } } }]).toArray(),
    erisRegDb.collection('sanctions').aggregate([{ $group: { _id: '$source_id', count: { $sum: 1 } } }]).toArray(),
    erisRegDb.collection('dependency_edges').aggregate([{ $group: { _id: '$source_id', count: { $sum: 1 } } }]).toArray(),
  ]);
  return {
    reqMap: new Map(reqCounts.map((r) => [toId(r._id), r.count])),
    sancMap: new Map(sancCounts.map((r) => [toId(r._id), r.count])),
    depMap: new Map(depCounts.map((r) => [toId(r._id), r.count])),
  };
}

function pickRegSourceCounts({ reqMap, sancMap, depMap }, sourceIdStr) {
  return {
    requirement_count: reqMap.get(sourceIdStr) || 0,
    sanction_count: sancMap.get(sourceIdStr) || 0,
    dependency_count: depMap.get(sourceIdStr) || 0,
  };
}

async function regSourceCounts(sourceObjId) {
  const [requirement_count, sanction_count, dependency_count] = await Promise.all([
    erisRegDb.collection('requirements').countDocuments({ source_id: sourceObjId }),
    erisRegDb.collection('sanctions').countDocuments({ source_id: sourceObjId }),
    erisRegDb.collection('dependency_edges').countDocuments({ source_id: sourceObjId }),
  ]);
  return { requirement_count, sanction_count, dependency_count };
}

// /api/reg/overview touches every collection (counts + a 296-source bulk
// aggregation) and the eris_reg database is both large and under continuous
// write load from its own ingestion pipeline on a shared free-tier cluster -
// recomputing it on every page load was taking 8-15s. A short cache is a much
// better trade than making every viewer wait on a cold read each time.
let overviewCache = { data: null, at: 0 };
const OVERVIEW_CACHE_MS = 30_000;
// Single-flight guard: while the cache is cold, concurrent requests (several
// tabs opening at once, or a request racing the startup warm-up) must share
// one in-flight computation instead of each independently re-running the
// full cross-collection scan - exactly the scenario that piles the most load
// onto the cluster at the moment it's least able to take it.
let overviewInFlight = null;

async function computeRegOverview() {
  const [
    sources, requirements, critical_requirements, sanctions, dependency_edges,
    relationships, canonical_requirements, control_objectives, controls,
    refTopics, refPatterns,
  ] = await Promise.all([
    erisRegDb.collection('sources').countDocuments(),
    erisRegDb.collection('requirements').countDocuments(),
    erisRegDb.collection('requirements').countDocuments({ is_critical: true }),
    erisRegDb.collection('sanctions').countDocuments(),
    erisRegDb.collection('dependency_edges').countDocuments(),
    erisRegDb.collection('relationships').countDocuments(),
    erisRegDb.collection('canonical_requirements').countDocuments(),
    erisRegDb.collection('control_objectives').countDocuments(),
    erisRegDb.collection('controls').countDocuments(),
    erisRegDb.collection('reference_data').findOne({ _id: 'topics' }),
    erisRegDb.collection('reference_data').findOne({ _id: 'control_patterns' }),
  ]);

  const [sourceDocs, countMaps] = await Promise.all([
    erisRegDb.collection('sources').find().toArray(),
    regAllSourceCounts(),
  ]);
  const sourcesSummary = sourceDocs.map((s) => ({
    ...serializeRegSource(s),
    ...pickRegSourceCounts(countMaps, toId(s._id)),
  }));

  const payload = {
    counts: {
      sources, requirements, critical_requirements, sanctions, dependency_edges,
      relationships, canonical_requirements, control_objectives, controls,
      topics: (refTopics?.values || []).length,
      control_patterns: (refPatterns?.values || []).length,
    },
    sources: sourcesSummary,
  };
  overviewCache = { data: payload, at: Date.now() };
  return payload;
}

app.get('/api/reg/overview', async (req, res) => {
  if (overviewCache.data && Date.now() - overviewCache.at < OVERVIEW_CACHE_MS) {
    return res.json(overviewCache.data);
  }
  if (!overviewInFlight) {
    overviewInFlight = computeRegOverview().finally(() => { overviewInFlight = null; });
  }
  res.json(await overviewInFlight);
});

app.get('/api/reg/sources', async (req, res) => {
  const [sourceDocs, countMaps] = await Promise.all([
    erisRegDb.collection('sources').find().toArray(),
    regAllSourceCounts(),
  ]);
  res.json(sourceDocs.map((s) => ({
    ...serializeRegSource(s),
    ...pickRegSourceCounts(countMaps, toId(s._id)),
  })));
});

app.get('/api/reg/sources/:id', async (req, res) => {
  const _id = oid(req.params.id);
  if (!_id) return res.status(400).json({ error: 'invalid id' });
  const source = await erisRegDb.collection('sources').findOne({ _id });
  if (!source) return res.status(404).json({ error: 'not found' });

  const counts = await regSourceCounts(_id);
  const topicBreakdown = await erisRegDb.collection('requirements').aggregate([
    { $match: { source_id: _id } },
    { $group: { _id: '$topic_parent', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  res.json({
    source: serializeRegSource(source),
    ...counts,
    topic_breakdown: topicBreakdown.map((t) => ({ topic_id: t._id, count: t.count })),
  });
});

app.get('/api/reg/sources/:id/full-text', async (req, res) => {
  const _id = oid(req.params.id);
  if (!_id) return res.status(400).json({ error: 'invalid id' });
  const source = await erisRegDb.collection('sources').findOne({ _id }, { projection: { full_text: 1 } });
  if (!source) return res.status(404).json({ error: 'not found' });
  res.json({ full_text: source.full_text || '' });
});

app.get('/api/reg/sources/:id/requirements', async (req, res) => {
  const source_id = oid(req.params.id);
  if (!source_id) return res.status(400).json({ error: 'invalid id' });
  const { topic, subtopic, critical, status, q } = req.query;
  const { page, pageSize } = pageParams(req);

  const match = { source_id };
  if (subtopic) match.topic_id = subtopic;
  else if (topic) match.topic_parent = topic;
  if (critical === 'true') match.is_critical = true;
  if (status) match.status = status;
  if (q) {
    const re = searchRegex(q);
    match.$or = [{ summary: re }, { original_text: re }, { citation: re }];
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

app.get('/api/reg/requirements/:id', async (req, res) => {
  const _id = oid(req.params.id);
  if (!_id) return res.status(400).json({ error: 'invalid id' });
  const r = await erisRegDb.collection('requirements').findOne({ _id });
  if (!r) return res.status(404).json({ error: 'not found' });

  const [sanctions, canonical] = await Promise.all([
    r.sanction_refs?.length
      ? erisRegDb.collection('sanctions').find({ _id: { $in: r.sanction_refs } }).toArray()
      : [],
    r.canonical_id
      ? erisRegDb.collection('canonical_requirements').findOne({ _id: r.canonical_id })
      : null,
  ]);

  const objectiveMatch = canonical
    ? { $or: [{ canonical_id: r.canonical_id }, { direct_requirement_link: true, requirement_ids: _id }] }
    : { direct_requirement_link: true, requirement_ids: _id };
  const objectives = await erisRegDb.collection('control_objectives').find(objectiveMatch).toArray();
  const objectiveIds = objectives.map((o) => o._id);
  const controls = objectiveIds.length
    ? await erisRegDb.collection('controls').find({ objective_id: { $in: objectiveIds } }).toArray()
    : [];

  res.json({
    requirement: serializeRequirement(r),
    sanctions: sanctions.map(serializeSanction),
    canonical: canonical ? serializeCanonical(canonical) : null,
    control_objectives: objectives.map(serializeControlObjective),
    controls: controls.map(serializeControl),
  });
});

app.get('/api/reg/sanctions', async (req, res) => {
  const { page, pageSize } = pageParams(req, 25, 100);
  const { status, q } = req.query;
  const match = {};
  if (status) match.link_status = status;
  if (q) {
    const re = searchRegex(q);
    match.$or = [{ citation: re }, { summary: re }, { original_text: re }, { relates_to: re }];
  }
  const total = await erisRegDb.collection('sanctions').countDocuments(match);
  const items = await erisRegDb.collection('sanctions')
    .find(match).sort({ created_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  const sourceMap = await resolveSourceTitles(items.map((s) => s.source_id));
  res.json({
    total, page, pageSize,
    items: items.map((s) => ({ ...serializeSanction(s), source: sourceMap.get(toId(s.source_id)) || null })),
  });
});

app.get('/api/reg/dependencies', async (req, res) => {
  const edges = await erisRegDb.collection('dependency_edges').find().sort({ created_at: -1 }).toArray();
  const sourceMap = await resolveSourceTitles(edges.flatMap((e) => [e.source_id, e.to_source_id]));
  res.json(edges.map((e) => ({
    ...serializeEdge(e),
    from_source: sourceMap.get(toId(e.source_id)) || null,
    to_source: e.to_source_id ? sourceMap.get(toId(e.to_source_id)) || null : null,
  })));
});

app.get('/api/reg/relationships', async (req, res) => {
  const { type, status } = req.query;
  const { page, pageSize } = pageParams(req, 30, 100);
  const match = {};
  if (type) match.type = type;
  if (status) match.status = status;
  const total = await erisRegDb.collection('relationships').countDocuments(match);
  const items = await erisRegDb.collection('relationships')
    .find(match).sort({ created_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  const labelMap = await describeEntities(items.flatMap((r) => [r.from_id, r.to_id]));
  res.json({
    total, page, pageSize,
    items: items.map((r) => ({
      ...serializeRelationship(r),
      from: labelMap.get(toId(r.from_id)) || null,
      to: labelMap.get(toId(r.to_id)) || null,
    })),
  });
});

app.get('/api/reg/canonical-requirements', async (req, res) => {
  const { topic, status, q } = req.query;
  const { page, pageSize } = pageParams(req);
  const match = {};
  if (topic) match.topic_id = topic;
  if (status) match.status = status;
  if (q) {
    const re = searchRegex(q);
    match.$or = [{ description: re }, { rationale: re }];
  }
  const total = await erisRegDb.collection('canonical_requirements').countDocuments(match);
  const items = await erisRegDb.collection('canonical_requirements')
    .find(match).sort({ created_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  const objCounts = items.length
    ? await erisRegDb.collection('control_objectives').aggregate([
        { $match: { canonical_id: { $in: items.map((c) => c._id) } } },
        { $group: { _id: '$canonical_id', count: { $sum: 1 } } },
      ]).toArray()
    : [];
  const objCountMap = new Map(objCounts.map((o) => [toId(o._id), o.count]));
  res.json({
    total, page, pageSize,
    items: items.map((c) => ({
      ...serializeCanonical(c),
      requirement_count: (c.requirement_ids || []).length,
      objective_count: objCountMap.get(toId(c._id)) || 0,
    })),
  });
});

app.get('/api/reg/canonical-requirements/:id', async (req, res) => {
  const _id = oid(req.params.id);
  if (!_id) return res.status(400).json({ error: 'invalid id' });
  const c = await erisRegDb.collection('canonical_requirements').findOne({ _id });
  if (!c) return res.status(404).json({ error: 'not found' });

  const [reqMap, objectives] = await Promise.all([
    resolveRequirementSummaries(c.requirement_ids || []),
    erisRegDb.collection('control_objectives').find({ canonical_id: _id }).toArray(),
  ]);
  const objectiveIds = objectives.map((o) => o._id);
  const controls = objectiveIds.length
    ? await erisRegDb.collection('controls').find({ objective_id: { $in: objectiveIds } }).toArray()
    : [];

  res.json({
    canonical: serializeCanonical(c),
    requirements: (c.requirement_ids || []).map((id) => reqMap.get(toId(id))).filter(Boolean),
    control_objectives: objectives.map(serializeControlObjective),
    controls: controls.map(serializeControl),
  });
});

app.get('/api/reg/control-objectives', async (req, res) => {
  const { topic, status, q } = req.query;
  const { page, pageSize } = pageParams(req);
  const match = {};
  if (topic) match.topic_id = topic;
  if (status) match.status = status;
  if (q) {
    const re = searchRegex(q);
    match.$or = [{ outcome: re }, { rationale: re }];
  }
  const total = await erisRegDb.collection('control_objectives').countDocuments(match);
  const items = await erisRegDb.collection('control_objectives')
    .find(match).sort({ created_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  const controlCounts = items.length
    ? await erisRegDb.collection('controls').aggregate([
        { $match: { objective_id: { $in: items.map((o) => o._id) } } },
        { $group: { _id: '$objective_id', count: { $sum: 1 } } },
      ]).toArray()
    : [];
  const ccMap = new Map(controlCounts.map((c) => [toId(c._id), c.count]));
  res.json({
    total, page, pageSize,
    items: items.map((o) => ({ ...serializeControlObjective(o), control_count: ccMap.get(toId(o._id)) || 0 })),
  });
});

app.get('/api/reg/control-objectives/:id', async (req, res) => {
  const _id = oid(req.params.id);
  if (!_id) return res.status(400).json({ error: 'invalid id' });
  const o = await erisRegDb.collection('control_objectives').findOne({ _id });
  if (!o) return res.status(404).json({ error: 'not found' });

  const [canonical, reqMap, controls] = await Promise.all([
    o.canonical_id ? erisRegDb.collection('canonical_requirements').findOne({ _id: o.canonical_id }) : null,
    resolveRequirementSummaries(o.requirement_ids || []),
    erisRegDb.collection('controls').find({ objective_id: _id }).toArray(),
  ]);

  res.json({
    objective: serializeControlObjective(o),
    canonical: canonical ? serializeCanonical(canonical) : null,
    requirements: (o.requirement_ids || []).map((id) => reqMap.get(toId(id))).filter(Boolean),
    controls: controls.map(serializeControl),
  });
});

app.get('/api/reg/controls', async (req, res) => {
  const { type, status, nature, pattern, q } = req.query;
  const { page, pageSize } = pageParams(req);
  const match = {};
  if (type) match.type = type;
  if (status) match.status = status;
  if (nature) match.nature = nature;
  if (pattern) match.pattern_id = pattern;
  if (q) {
    const re = searchRegex(q);
    match.$or = [{ activity: re }, { owner_role: re }];
  }
  const total = await erisRegDb.collection('controls').countDocuments(match);
  const items = await erisRegDb.collection('controls')
    .find(match).sort({ created_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  const objIds = uniqueObjectIds(items.map((c) => c.objective_id));
  const objs = objIds.length
    ? await erisRegDb.collection('control_objectives').find({ _id: { $in: objIds } }, { projection: { outcome: 1, topic_id: 1 } }).toArray()
    : [];
  const objMap = new Map(objs.map((o) => [toId(o._id), { outcome: o.outcome, topic_id: o.topic_id }]));
  res.json({
    total, page, pageSize,
    items: items.map((c) => ({ ...serializeControl(c), objective: objMap.get(toId(c.objective_id)) || null })),
  });
});

app.get('/api/reg/controls/:id', async (req, res) => {
  const _id = oid(req.params.id);
  if (!_id) return res.status(400).json({ error: 'invalid id' });
  const c = await erisRegDb.collection('controls').findOne({ _id });
  if (!c) return res.status(404).json({ error: 'not found' });

  const objective = c.objective_id ? await erisRegDb.collection('control_objectives').findOne({ _id: c.objective_id }) : null;
  let pattern = null;
  if (c.pattern_id) {
    const patterns = await erisRegDb.collection('reference_data').findOne({ _id: 'control_patterns' });
    pattern = (patterns?.values || []).find((p) => p.id === c.pattern_id) || null;
  }

  res.json({
    control: serializeControl(c),
    objective: objective ? serializeControlObjective(objective) : null,
    pattern,
  });
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

// Must be last, and must take 4 args, or Express won't treat it as an error handler.
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'internal error' });
});

client.connect().then(() => {
  erisDb = client.db('eris');
  erisRegDb = client.db('eris_reg');
  app.listen(PORT, () => console.log(`eris-display API listening on http://localhost:${PORT}`));
  // Fire-and-forget: pre-warm the overview cache so the first real visitor
  // doesn't pay the 10-15s cold-read cost themselves. Goes through the same
  // single-flight guard as the route handler so a real request racing this
  // warm-up awaits the same computation instead of starting a second one.
  overviewInFlight = computeRegOverview().finally(() => { overviewInFlight = null; });
  overviewInFlight.catch((err) => console.error('Overview warm-up failed', err));
}).catch((err) => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});
