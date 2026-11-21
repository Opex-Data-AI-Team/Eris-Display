import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import StatStrip from './components/StatStrip.jsx';
import SourceSidebar from './components/SourceSidebar.jsx';
import SourceDocument from './components/SourceDocument.jsx';
import ElementTree from './components/ElementTree.jsx';
import TaskInspector from './components/TaskInspector.jsx';
import RiskRegister from './components/RiskRegister.jsx';
import VocabView from './components/VocabView.jsx';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('eris-theme') || 'light');
  const [view, setView] = useState('sources');

  const [counts, setCounts] = useState(null);
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [sourceDetail, setSourceDetail] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const [selectedElement, setSelectedElement] = useState(null);
  const [elementTasks, setElementTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

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
        if (data.sources.length > 0) setSelectedSourceId(data.sources[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedSourceId) return;
    setSourceLoading(true);
    setSelectedElement(null);
    setElementTasks([]);
    api.source(selectedSourceId)
      .then((data) => setSourceDetail(data))
      .catch((e) => setError(e.message))
      .finally(() => setSourceLoading(false));
  }, [selectedSourceId]);

  const onSelectElement = useCallback((node) => {
    setSelectedElement(node);
    setTasksLoading(true);
    api.elementTasks(node.id)
      .then((data) => setElementTasks(data.tasks))
      .catch((e) => setError(e.message))
      .finally(() => setTasksLoading(false));
  }, []);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="mark">E</div>
          <div>
            <h1>Eris</h1>
            <div className="sub">regulatory compliance register · live from MongoDB</div>
          </div>
        </div>
        <nav className="topnav">
          <button className={view === 'sources' ? 'active' : ''} onClick={() => setView('sources')}>Sources</button>
          <button className={view === 'risks' ? 'active' : ''} onClick={() => setView('risks')}>Risk register</button>
          <button className={view === 'vocab' ? 'active' : ''} onClick={() => setView('vocab')}>Vocabulary</button>
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
                <SourceDocument data={sourceDetail} />
                <div className="explorer">
                  <div className="tree-panel">
                    <div className="panel-title">Clause outline · {sourceDetail.element_count} clauses</div>
                    <ElementTree
                      tree={sourceDetail.tree}
                      selectedId={selectedElement?.id}
                      onSelect={onSelectElement}
                    />
                  </div>
                  <TaskInspector element={selectedElement} tasks={elementTasks} loading={tasksLoading} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'risks' && (
        <div className="main" style={{ flex: 1 }}>
          <RiskRegister />
        </div>
      )}

      {view === 'vocab' && (
        <div className="main" style={{ flex: 1 }}>
          <VocabView />
        </div>
      )}
    </div>
  );
}
