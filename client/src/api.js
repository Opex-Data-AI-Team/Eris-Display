const BASE = '/api';

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
  source: (sourceId) => getJSON(`/sources/${encodeURIComponent(sourceId)}`),
  sourceFullText: (sourceId) => getJSON(`/sources/${encodeURIComponent(sourceId)}/full-text`),
  requirements: (sourceId, params) => getJSON(`/sources/${encodeURIComponent(sourceId)}/requirements${qs(params)}`),
  requirement: (requirementId) => getJSON(`/requirements/${encodeURIComponent(requirementId)}`),
  sanctions: () => getJSON('/sanctions'),
  dependencies: () => getJSON('/dependencies'),
  relationships: () => getJSON('/relationships'),
  conflicts: () => getJSON('/conflicts'),
  canonicalRequirements: () => getJSON('/canonical-requirements'),
  referenceData: () => getJSON('/reference-data'),
  activity: (limit) => getJSON(`/activity${qs({ limit })}`),
};
