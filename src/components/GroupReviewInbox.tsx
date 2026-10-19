import { useEffect, useState } from 'react';
import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { BookOpen, Check, Send, X } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { useAccess } from '../lib/access';
import { assignedGroups, type GroupInfo } from '../lib/groups';
import { groupSubmissions, reviewStudentSubmission, type StudentSubmission } from '../lib/studentSubmissions';
import { ConceptNode } from './ConceptNode';
import { safeReferenceUrl } from '../lib/academicGraph';
import type { ConceptNode as GraphNode, ConceptEdge as GraphEdge } from '../lib/types';
import { explainError } from '../lib/errors';

export function GroupReviewInbox() {
  const { user } = useAuth();
  const { role } = useAccess();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [requests, setRequests] = useState<StudentSubmission[]>([]);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [focusedNode, setFocusedNode] = useState<string|null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!user || (role !== 'professor' && role !== 'admin')) return;
    let active = true;
    assignedGroups(user.uid, role === 'admin').then(async gs => {
      const incoming = await groupSubmissions(gs.map(g=>g.id));
      if (active) { setGroups(gs); setRequests(incoming); }
    }).catch(e=>{ if(active)setError(explainError(e)); });
    return () => { active=false; };
  }, [user?.uid, role]);
  const current = requests.find(r => r.id === selectedId) ?? null;
  const concept = current?.nodes.find(n=>n.id===focusedNode);
  async function review(status: 'revisado' | 'devuelto') {
    if (!user || !current || current.status !== 'pendiente' || busy) return;
    if (!window.confirm(status === 'revisado' ? 'Registrar como revisado (sin publicar el contenido). ¿Continuar?' : 'Devolver el trabajo al estudiante con observaciones. ¿Continuar?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await reviewStudentSubmission(current.groupId, current.id, status, user.uid, note);
      const latest = await groupSubmissions(groups.map(g=>g.id));
      setRequests(latest); setSelectedId(null); setNote(''); setFocusedNode(null);
      setNotice(status==='revisado' ? 'Revisión registrada; el esquema no se ha publicado.' : 'Observaciones enviadas al estudiante.');
    } catch(e) { setError(explainError(e)); } finally { setBusy(false); }
  }
  return <section className="governance-panel student-review-inbox" aria-labelledby="student-requests-title">
    <h2 id="student-requests-title"><Send size={20}/> Solicitudes de revisión de estudiantes</h2>
    <p>Revise las versiones enviadas a sus programas. Los borradores y los historiales del estudiante permanecen privados. Revisar nunca publica automáticamente.</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    {!requests.length ? <p>Aún no hay trabajos enviados a revisión.</p> : <div className="student-review-list">{requests.map(r => <article key={r.id}>
      <b>{r.title}</b><span>{groups.find(g=>g.id===r.groupId)?.name || r.groupId} · {r.status} · Estudiante {r.studentUid.slice(0, 8)}</span>
      <button type="button" className="button button-secondary" onClick={()=>{setSelectedId(r.id===selectedId?null:r.id);setFocusedNode(null);setNote('');}}>{r.id===selectedId?'Cerrar vista':'Consultar esquema recibido'}</button>
    </article>)}</div>}
    {current && <section className="student-review-detail"><div className="student-review-detail-head"><h3>{current.title}</h3><button className="button button-secondary" onClick={()=>setSelectedId(null)}><X size={15}/> Cerrar</button></div><p>{current.description}</p><div className="student-review-graph"><ReactFlowProvider><ReactFlow<GraphNode, GraphEdge> nodes={current.nodes.map(n=>({...n,draggable:false,selectable:true}))} edges={current.edges} nodeTypes={{concept:ConceptNode}} nodesDraggable={false} nodesConnectable={false} elementsSelectable onNodeClick={(_,n)=>setFocusedNode(n.id)} fitView><Background variant={BackgroundVariant.Dots}/><Controls showInteractive={false}/></ReactFlow></ReactFlowProvider></div>
      {concept && <div className="student-review-sources"><h4>{concept.data.title}</h4><p>{concept.data.description}</p><h5><BookOpen size={14}/> Bibliografía de este concepto</h5>{concept.data.references?.length ? concept.data.references.map((source,i)=><p key={i}>{source.author} — <b>{source.work}</b>{source.year && ` (${source.year})`}{source.locator && `, ${source.locator}`} {safeReferenceUrl(source.url) && <a href={safeReferenceUrl(source.url)} target="_blank" rel="noopener noreferrer">Consultar fuente</a>}</p>) : <p>Sin fuentes adjuntas.</p>}</div>}
      {current.status === 'pendiente' ? <div className="student-review-actions"><label>Observaciones para el estudiante<textarea rows={4} maxLength={1200} value={note} onChange={e=>setNote(e.target.value)} placeholder="Aspectos que debe revisar, bibliografía, argumentos..."/></label><div><button disabled={busy} className="button button-primary" onClick={()=>void review('revisado')}><Check size={16}/> Marcar como revisado</button><button disabled={busy||!note.trim()} className="button button-secondary" onClick={()=>void review('devuelto')}>Devolver con observaciones</button></div></div> : <p>Estado: {current.status}. {current.reviewNote}</p>}
    </section>}
  </section>;
}
