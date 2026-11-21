import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from './api.js';
import StatStrip from './components/StatStrip.jsx';
import SourceSidebar from './components/SourceSidebar.jsx';
import SourceDocument from './components/SourceDocument.jsx';
import RequirementsBrowser from './components/RequirementsBrowser.jsx';
import RequirementInspector from './components/RequirementInspector.jsx';
import SanctionsRegister from './components/SanctionsRegister.jsx';
import DependenciesView from './components/DependenciesView.jsx';
import ReferenceDataView from './components/ReferenceDataView.jsx';

const DEFAULT_FILTERS = { q: '', topic: '', critical: '', page: 1 };

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('eris-theme') || 'light');
  const [view, setView] = useState('sources');

  const [counts, setCounts] = useState(null);
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [sourceDetail, setSourceDetail] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const [topicLabels, setTopicLabels] = useState({});

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [selectedRequirementId, setSelectedRequirementId] = useState(null);
  const [requirementDetail, setRequirementDetail] = useState(null);
  const [requirementLoading, setRequirementLoading] = useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('eris-theme', theme);
  }, [theme]);

  useEffect(() => {
    api.overview()
      .then((data) => {
        setCounts(data.counts);
        setSources(data.sources);
        if (data.sources.length > 0) setSelectedSourceId(data.sources[0].source_id);
      })
      .catch((e) => setError(e.message));

    api.referenceData()
      .then((data) => {
        const map = {};
        (data.topics || []).forEach((t) => { map[t.id] = t.label; });
        setTopicLabels(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSourceId) return;
    setSourceLoading(true);
    setSelectedRequirementId(null);
    setRequirementDetail(null);
    setFilters(DEFAULT_FILTERS);
    api.source(selectedSourceId)
      .then(setSourceDetail)
      .catch((e) => setError(e.message))
      .finally(() => setSourceLoading(false));
  }, [selectedSourceId]);

  useEffect(() => {
    if (!selectedSourceId) return;
    setResultsLoading(true);
    api.requirements(selectedSourceId, filters)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setResultsLoading(false));
  }, [selectedSourceId, filters]);

  const onFilterChange = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const onSelectRequirement = useCallback((requirementId) => {
    setSelectedRequirementId(requirementId);
    setRequirementLoading(true);
    api.requirement(requirementId)
      .then(setRequirementDetail)
      .catch((e) => setError(e.message))
      .finally(() => setRequirementLoading(false));
  }, []);

  const topics = useMemo(() => sourceDetail?.topic_breakdown || [], [sourceDetail]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="mark">E</div>
          <div>
            <h1>Eris</h1>
            <div className="sub">regulatory requirements register · live from MongoDB</div>
          </div>
        </div>
        <nav className="topnav">
          <button className={view === 'sources' ? 'active' : ''} onClick={() => setView('sources')}>Sources</button>
          <button className={view === 'sanctions' ? 'active' : ''} onClick={() => setView('sanctions')}>Sanctions</button>
          <button className={view === 'dependencies' ? 'active' : ''} onClick={() => setView('dependencies')}>Dependencies</button>
          <button className={view === 'reference' ? 'active' : ''} onClick={() => setView('reference')}>Reference data</button>
        </nav>
        <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
      </div>

      <StatStrip counts={counts} />

      {error && <div className="error">{error}</div>}

      {view === 'sources' && (
        <div className="layout">
          <SourceSidebar sources={sources} selectedId={selectedSourceId} onSelect={setSelectedSourceId} />
          <div className="main">
            {sourceLoading && <div className="loading">Loading source…</div>}
            {!sourceLoading && sourceDetail && (
              <>
                <SourceDocument data={sourceDetail} sourceId={selectedSourceId} />
                <div className="explorer">
                  <RequirementsBrowser
                    topics={topics}
                    topicLabels={topicLabels}
                    filters={filters}
                    onFilterChange={onFilterChange}
                    results={results}
                    loading={resultsLoading}
                    selectedId={selectedRequirementId}
                    onSelect={onSelectRequirement}
                  />
                  <RequirementInspector
                    detail={requirementDetail}
                    loading={requirementLoading}
                    topicLabels={topicLabels}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'sanctions' && (
        <div className="main" style={{ flex: 1 }}>
          <SanctionsRegister />
        </div>
      )}

      {view === 'dependencies' && (
        <div className="main" style={{ flex: 1 }}>
          <DependenciesView />
        </div>
      )}

      {view === 'reference' && (
        <div className="main" style={{ flex: 1 }}>
          <ReferenceDataView />
        </div>
      )}
    </div>
  );
}
