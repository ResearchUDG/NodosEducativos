import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { ConceptEdge } from '../lib/types';
import { ACCENT_HEX, readEdgeVisual } from '../lib/visualDesign';

export function StyledEdge(props: EdgeProps<ConceptEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, data, label, selected, markerEnd } = props;
  const visual = readEdgeVisual((data as Record<string, unknown> | undefined)?.visual);
  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2;
  const cx = mx + visual.bendX;
  const cy = my + visual.bendY;
  let path: string;
  if (visual.route === 'straight') path = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  else if (visual.route === 'step') path = `M ${sourceX},${sourceY} L ${cx},${sourceY} L ${cx},${targetY} L ${targetX},${targetY}`;
  else path = `M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`;
  const dash = visual.lineStyle === 'dashed' ? '9 7' : visual.lineStyle === 'dotted' ? '2 6' : undefined;
  const stroke = ACCENT_HEX[visual.accent];
  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: visual.width, strokeDasharray: dash, opacity: selected ? 1 : .88 }}/>
    {label != null && String(label).trim() && <EdgeLabelRenderer>
      <div className={`styled-edge-label${selected ? ' styled-edge-label--selected' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${mx + visual.labelX}px,${my + visual.labelY}px)`, fontSize: visual.labelSize }}>
        {String(label)}
      </div>
    </EdgeLabelRenderer>}
  </>;
}
