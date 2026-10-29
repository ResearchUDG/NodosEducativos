import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ConceptNode as ConceptNodeType } from '../lib/types';
import { readNodeVisual } from '../lib/visualDesign';

const kindNames = { tesis: 'TESIS', idea: 'CONCEPTO', fuente: 'FUENTE', pregunta: 'PREGUNTA' };
export function ConceptNode({ data, selected }: NodeProps<ConceptNodeType>) {
  const visual = readNodeVisual(data.visual);
  const style = {
    '--visual-title-size': `${visual.titleSize}px`,
    '--visual-body-size': `${visual.bodySize}px`,
    '--visual-padding': `${visual.padding}px`,
    '--visual-radius': `${visual.radius}px`,
  } as CSSProperties;
  return (
    <div className={`concept visual-node visual-node--${visual.variant} visual-node--${visual.accent} visual-node--align-${visual.textAlign} visual-node--v-${visual.verticalAlign} ${selected ? 'concept--selected' : ''} ${data.highlight ? 'concept--guided' : ''} ${data.studyDimmed ? 'concept--study-dimmed' : ''} ${data.critical ? 'visual-node--critical' : ''} ${data.batchSource ? 'concept--batch-source' : ''} ${data.batchTarget ? 'concept--batch-target' : ''}`} style={style}>
      <Handle type="target" position={Position.Left} className="concept-handle" />
      <div className="visual-node-content">
        <div className="concept-identity visual-node-meta">
          <span className="concept-number" aria-label={`Nodo número ${data.displayNumber ?? 'sin asignar'}`}>{typeof data.displayNumber === 'number' ? String(data.displayNumber).padStart(2, '0') : '·'}</span>
          <span>{kindNames[data.category]}</span>
          {data.critical === true && <b className="concept-critical-label">CRÍTICO ✦</b>}
        </div>
        <strong>{data.title}</strong>
        <p>{data.description || 'Sin descripción.'}</p>
        {Boolean(data.references?.length) && <span className="concept-reference-count">{data.references?.length} {data.references?.length === 1 ? 'referencia' : 'referencias'}</span>}
      </div>
      {Boolean(data.qa?.length) && <span className="concept-qa-count">{data.qa?.length} {data.qa?.length === 1 ? 'pregunta' : 'preguntas'}</span>}
      <Handle type="source" position={Position.Right} className="concept-handle" />
    </div>
  );
}
