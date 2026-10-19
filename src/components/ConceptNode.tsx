import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ConceptNode as ConceptNodeType } from '../lib/types';

const kindNames = { tesis: 'TESIS', idea: 'CONCEPTO', fuente: 'FUENTE', pregunta: 'PREGUNTA' };
export function ConceptNode({ data, selected }: NodeProps<ConceptNodeType>) {
  return (
    <div className={`concept concept--${data.category} ${selected ? 'concept--selected' : ''} ${data.highlight ? 'concept--guided' : ''} ${data.studyDimmed ? 'concept--study-dimmed' : ''}`}>
      <Handle type="target" position={Position.Left} className="concept-handle" />
      <span className="concept-kind">{kindNames[data.category]}</span>
      <strong>{data.title}</strong>
      <p>{data.description || 'Sin descripción.'}</p>
      {Boolean(data.references?.length) && <span className="concept-reference-count">{data.references?.length} {data.references?.length === 1 ? 'referencia' : 'referencias'}</span>}
      <Handle type="source" position={Position.Right} className="concept-handle" />
    </div>
  );
}
