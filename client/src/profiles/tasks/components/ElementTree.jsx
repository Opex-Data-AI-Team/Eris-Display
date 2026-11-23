import React, { useState } from 'react';

function Node({ node, selectedId, onSelect, depth }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div className="tree-node">
      <div
        className={`tree-row ${isSelected ? 'selected' : ''}`}
        tabIndex={0}
        role="treeitem"
        aria-expanded={hasChildren ? open : undefined}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect(node); }}
      >
        <span
          className={`tree-caret ${open ? 'open' : ''}`}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) setOpen((o) => !o); }}
        >
          {hasChildren ? '▸' : ''}
        </span>
        <span className="tree-key">{node.native_ref ?? node.key}</span>
        <span className="tree-title">{node.title}</span>
        {node.tier && <span className="tree-badge tier">{node.tier.replace(/_/g, ' ')}</span>}
        {node.subtree_task_count > 0 && (
          <span className="tree-badge tasks">{node.subtree_task_count} task{node.subtree_task_count === 1 ? '' : 's'}</span>
        )}
      </div>
      {hasChildren && open && (
        <div className="tree-children" role="group">
          {node.children.map((c) => (
            <Node key={c.id} node={c} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ElementTree({ tree, selectedId, onSelect }) {
  if (!tree || tree.length === 0) {
    return <div className="empty-state">No clauses found for this source.</div>;
  }
  return (
    <div className="tree-scroll" role="tree">
      {tree.map((node) => (
        <Node key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} depth={0} />
      ))}
    </div>
  );
}
