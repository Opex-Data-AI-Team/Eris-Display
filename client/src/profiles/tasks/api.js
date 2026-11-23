const BASE = '/api/tasks';

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  overview: () => getJSON('/overview'),
  sources: () => getJSON('/sources'),
  source: (id) => getJSON(`/sources/${id}`),
  elementTasks: (id) => getJSON(`/elements/${id}/tasks`),
  riskScenarios: () => getJSON('/risk-scenarios'),
  vocab: () => getJSON('/vocab'),
};
