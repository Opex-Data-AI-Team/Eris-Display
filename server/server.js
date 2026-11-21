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
const dbName = process.env.MONGODB_DB || 'eris';

const client = new MongoClient(uri);
let db;

const app = express();
app.use(cors());

function toId(v) {
  return v == null ? null : String(v);
}

function serializeSource(s) {
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

app.get('/api/overview', async (req, res) => {
  const [sources, elements, tasks, risks, issuers, vocab] = await Promise.all([
    db.collection('sources').countDocuments(),
    db.collection('elements').countDocuments(),
    db.collection('task_templates').countDocuments(),
    db.collection('risk_scenarios').countDocuments(),
    db.collection('issuers').countDocuments(),
    db.collection('vocab').countDocuments(),
  ]);

  const sourceDocs = await db.collection('sources').find().toArray();
  const taskCounts = await db.collection('task_templates').aggregate([
    { $lookup: { from: 'elements', localField: 'element_id', foreignField: '_id', as: 'el' } },
    { $unwind: '$el' },
    { $group: { _id: '$el.source_id', count: { $sum: 1 } } },
  ]).toArray();
  const taskCountMap = new Map(taskCounts.map((t) => [toId(t._id), t.count]));

  const elementCounts = await db.collection('elements').aggregate([
    { $group: { _id: '$source_id', count: { $sum: 1 } } },
  ]).toArray();
  const elementCountMap = new Map(elementCounts.map((e) => [toId(e._id), e.count]));

  const sourcesSummary = sourceDocs.map((s) => ({
    ...serializeSource(s),
    element_count: elementCountMap.get(toId(s._id)) || 0,
    task_count: taskCountMap.get(toId(s._id)) || 0,
  }));

  res.json({
    counts: { sources, elements, task_templates: tasks, risk_scenarios: risks, issuers, vocab },
    sources: sourcesSummary,
  });
});

app.get('/api/sources', async (req, res) => {
  const sourceDocs = await db.collection('sources').find().toArray();
  const elementCounts = await db.collection('elements').aggregate([
    { $group: { _id: '$source_id', count: { $sum: 1 } } },
  ]).toArray();
  const elementCountMap = new Map(elementCounts.map((e) => [toId(e._id), e.count]));

  const taskCounts = await db.collection('task_templates').aggregate([
    { $lookup: { from: 'elements', localField: 'element_id', foreignField: '_id', as: 'el' } },
    { $unwind: '$el' },
    { $group: { _id: '$el.source_id', count: { $sum: 1 } } },
  ]).toArray();
  const taskCountMap = new Map(taskCounts.map((t) => [toId(t._id), t.count]));

  const issuerDocs = await db.collection('issuers').find().toArray();
  const issuerMap = new Map(issuerDocs.map((i) => [i.code, i]));

  res.json(sourceDocs.map((s) => ({
    ...serializeSource(s),
    element_count: elementCountMap.get(toId(s._id)) || 0,
    task_count: taskCountMap.get(toId(s._id)) || 0,
    issuer_name: issuerMap.get(s.issuer_code)?.name || s.issuer_code,
  })));
});

app.get('/api/sources/:id', async (req, res) => {
  const { ObjectId } = await import('mongodb');
  let _id;
  try {
    _id = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'invalid id' });
  }
  const source = await db.collection('sources').findOne({ _id });
  if (!source) return res.status(404).json({ error: 'not found' });

  const issuer = await db.collection('issuers').findOne({ code: source.issuer_code });

  const elements = await db.collection('elements').find({ source_id: _id }).sort({ level: 1, order: 1 }).toArray();
  const elementIds = elements.map((e) => e._id);

  const taskCounts = await db.collection('task_templates').aggregate([
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
    source: serializeSource(source),
    issuer: issuer ? { code: issuer.code, name: issuer.name, kind: issuer.kind, country: issuer.country } : null,
    element_count: elements.length,
    task_count: taskCounts.reduce((a, t) => a + t.count, 0),
    tree: roots,
  });
});

app.get('/api/elements/:id/tasks', async (req, res) => {
  const { ObjectId } = await import('mongodb');
  let element_id;
  try {
    element_id = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'invalid id' });
  }
  const element = await db.collection('elements').findOne({ _id: element_id });
  const tasks = await db.collection('task_templates').find({ element_id }).toArray();
  res.json({
    element: element ? serializeElement(element) : null,
    tasks: tasks.map(serializeTask),
  });
});

app.get('/api/risk-scenarios', async (req, res) => {
  const risks = await db.collection('risk_scenarios').find().toArray();
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

app.get('/api/vocab', async (req, res) => {
  const vocab = await db.collection('vocab').find().sort({ type: 1, rank: 1 }).toArray();
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
