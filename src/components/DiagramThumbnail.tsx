import type { ConceptNode } from '../lib/types';
export function DiagramThumbnail({ nodes }: { nodes: ConceptNode[] }) {
  const sample = nodes.slice(0, 3);
  return (
    <div className="diagram-thumb" aria-hidden="true">
      <div className="diagram-thumb-grid" />
      <div className="preview-line" />
      {sample.map((node, index) => (
        <div className={`preview-node preview-node--${index} preview-node--${node.data.category}`} key={node.id}>
          <i /> <span>{node.data.title}</span>
        </div>
      ))}
      <span className="preview-caption">VISTA DEL SISTEMA 2D</span>
    </div>
  );
}
