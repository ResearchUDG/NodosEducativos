import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GuestFigureNode as GuestFigureNodeType } from '../lib/guestFigure';

export function GuestFigureNode({ data }: NodeProps<GuestFigureNodeType>) {
  return <div className={`guest-figure-node guest-figure-node--${data.category} ${data.critical ? 'guest-figure-node--critical' : ''}`}>
    <Handle type="target" position={Position.Left} className="guest-figure-handle"/>
    <span className="guest-figure-node-dot" aria-hidden="true"/>
    <strong>{data.title}</strong>
    <Handle type="source" position={Position.Right} className="guest-figure-handle"/>
  </div>;
}
