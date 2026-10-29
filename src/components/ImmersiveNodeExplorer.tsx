import { NodePresentation } from './NodePresentation';
import type { ConceptEdge, ConceptNode } from '../lib/types';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  onClose: () => void;
  initialNodeId?: string | null;
};

/**
 * Compatibilidad con las rutas y botones creados en Fase 4B.4.
 * La experiencia real vive ahora en NodePresentation.
 */
export function ImmersiveNodeExplorer({ open, ...props }: Props) {
  if (!open) return null;
  return <NodePresentation {...props} overlay/>;
}
