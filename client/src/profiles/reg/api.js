const BASE = '/api/reg';

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.set(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  overview: () => getJSON('/overview'),
  sources: () => getJSON('/sources'),
  source: (id) => getJSON(`/sources/${encodeURIComponent(id)}`),
  sourceFullText: (id) => getJSON(`/sources/${encodeURIComponent(id)}/full-text`),
  requirements: (sourceId, params) => getJSON(`/sources/${encodeURIComponent(sourceId)}/requirements${qs(params)}`),
  requirement: (id) => getJSON(`/requirements/${encodeURIComponent(id)}`),
  sanctions: (params) => getJSON(`/sanctions${qs(params)}`),
  dependencies: () => getJSON('/dependencies'),
  relationships: (params) => getJSON(`/relationships${qs(params)}`),
  canonicalRequirements: (params) => getJSON(`/canonical-requirements${qs(params)}`),
  canonicalRequirement: (id) => getJSON(`/canonical-requirements/${encodeURIComponent(id)}`),
  controlObjectives: (params) => getJSON(`/control-objectives${qs(params)}`),
  controlObjective: (id) => getJSON(`/control-objectives/${encodeURIComponent(id)}`),
  controls: (params) => getJSON(`/controls${qs(params)}`),
  control: (id) => getJSON(`/controls/${encodeURIComponent(id)}`),
  referenceData: () => getJSON('/reference-data'),
  activity: (limit) => getJSON(`/activity${qs({ limit })}`),
};
