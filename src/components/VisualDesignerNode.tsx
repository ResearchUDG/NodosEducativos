import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ConceptNode as ConceptNodeType } from '../lib/types';
import { readNodeVisual } from '../lib/visualDesign';
const kindNames={tesis:'TESIS',idea:'CONCEPTO',fuente:'FUENTE',pregunta:'PREGUNTA'};
export function VisualDesignerNode({data,selected}:NodeProps<ConceptNodeType>){
  const v=readNodeVisual(data.visual);
  const style={
    '--visual-title-size':`${v.titleSize}px`,'--visual-body-size':`${v.bodySize}px`,'--visual-padding':`${v.padding}px`,'--visual-radius':`${v.radius}px`,
  } as CSSProperties;
  return <div className={`visual-node visual-node--${v.variant} visual-node--${v.accent} visual-node--align-${v.textAlign} visual-node--v-${v.verticalAlign} ${data.critical?'visual-node--critical':''}`} style={style}>
    <NodeResizer isVisible={selected} minWidth={140} minHeight={70} maxWidth={900} maxHeight={650} lineClassName="visual-resizer-line" handleClassName="visual-resizer-handle"/>
    <Handle type="target" position={Position.Left} className="concept-handle"/>
    <div className="visual-node-content"><div className="visual-node-meta"><span>{kindNames[data.category]}</span>{data.critical&&<b>CRÍTICO ✦</b>}</div><strong>{data.title}</strong><p>{data.description||'Sin descripción.'}</p></div>
    <Handle type="source" position={Position.Right} className="concept-handle"/>
  </div>;
}
