import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { BookOpenText, Plus, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { useAccess, canAuthor } from '../lib/access';
import { explainError } from '../lib/errors';
import {
  addAcademicTag, emptyResearcherProfile, MAX_ACADEMIC_TAG_LENGTH,
  MAX_ACADEMIC_TAGS_PER_CATEGORY, normalizeResearcherProfile, readAcademicTags,
  removeAcademicTag, type AcademicTagCategory,
  type ResearcherProfileFields,
} from '../lib/researcherProfile';

type AcademicTagEditorProps = {
  category: AcademicTagCategory;
  label: string;
  example: string;
  tags: string[];
  busy: boolean;
  onAdd: (category: AcademicTagCategory, value: string) => boolean;
  onRemove: (category: AcademicTagCategory, index: number) => void;
};

function AcademicTagEditor({ category, label, example, tags, busy, onAdd, onRemove }: AcademicTagEditorProps) {
  const [draft, setDraft] = useState('');
  const full = tags.length >= MAX_ACADEMIC_TAGS_PER_CATEGORY;
  function commit() {
    if (busy || !draft.trim() || full) return;
    if (onAdd(category, draft)) setDraft('');
  }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  }
  return <div className="academic-tag-editor">
    <div className="academic-tag-heading"><strong>{label}</strong><span>{tags.length}/{MAX_ACADEMIC_TAGS_PER_CATEGORY}</span></div>
    <div className="academic-tag-list" aria-label={`Etiquetas de ${label.toLowerCase()}`}>
      {tags.map((tag, index) => <span className="academic-tag-chip" key={`${tag}-${index}`}>
        <span>{tag}</span>
        <button type="button" disabled={busy} onClick={() => onRemove(category, index)} aria-label={`Quitar ${tag} de ${label.toLowerCase()}`} title={`Quitar ${tag}`}><X size={13} aria-hidden="true"/></button>
      </span>)}
      {tags.length === 0 && <span className="academic-tag-empty">Sin etiquetas todavía</span>}
    </div>
    <div className="academic-tag-add">
      <input aria-label={`Nueva etiqueta en ${label.toLowerCase()}`} value={draft} maxLength={MAX_ACADEMIC_TAG_LENGTH}
        onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown}
        placeholder={example} disabled={busy || full}/>
      <button type="button" className="button button-secondary" onClick={commit} disabled={busy || full || !draft.trim()}><Plus size={16}/> Agregar</button>
    </div>
  </div>;
}

export function ResearcherProfile() {
  const { user } = useAuth();
  const { role } = useAccess();
  const [fields, setFields] = useState<ResearcherProfileFields>(emptyResearcherProfile);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!user || !db || !canAuthor(role)) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getDoc(doc(db, 'researcherProfiles', user.uid)).then(snapshot => {
      if (!active) return;
      setExists(snapshot.exists());
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFields({
          academicTitle: String(data.academicTitle || ''), institution: String(data.institution || ''),
          researchLines: String(data.researchLines || ''), biography: String(data.biography || ''),
          academicTags: readAcademicTags(data.academicTags),
        });
      } else setFields({ ...emptyResearcherProfile, academicTags: readAcademicTags(null) });
    }).catch(err => { if (active) setError(explainError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.uid, role]);

  function change(field: 'academicTitle' | 'institution' | 'researchLines' | 'biography', value: string) {
    setFields(previous => ({ ...previous, [field]: value }));
    setNotice('');
  }

  function addTag(category: AcademicTagCategory, value: string): boolean {
    try {
      const academicTags = addAcademicTag(fields.academicTags, category, value);
      setFields(previous => ({ ...previous, academicTags }));
      setError(''); setNotice('');
      return true;
    } catch (err) {
      setError(explainError(err));
      return false;
    }
  }
  function removeTag(category: AcademicTagCategory, index: number) {
    setFields(previous => ({ ...previous, academicTags: removeAcademicTag(previous.academicTags, category, index) }));
    setError(''); setNotice('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !user || !canAuthor(role) || busy) return;
    setError(''); setNotice(''); setBusy(true);
    try {
      const values = normalizeResearcherProfile(fields);
      const ref = doc(db, 'researcherProfiles', user.uid);
      // La regla Firestore decide finalmente si esta cuenta puede modificar su ficha.
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) await updateDoc(ref, { ...values, updatedAt: serverTimestamp() });
      else await setDoc(ref, { ...values, ownerUid: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setExists(true);
      setFields(values);
      setNotice('Ficha académica y etiquetas guardadas. Solo usted y la administración pueden consultarlas.');
    } catch (err) { setError(explainError(err)); }
    finally { setBusy(false); }
  }

  if (!canAuthor(role)) return <div role="alert">Solo profesores investigadores y administradores pueden gestionar una ficha académica.</div>;
  return <div className="researcher-profile-page">
    <div className="page-intro"><div><div className="eyebrow">INVESTIGACIÓN / IDENTIDAD ACADÉMICA</div><h1>Mi ficha de investigador<span className="period">.</span></h1><p>Describa su trayectoria mediante etiquetas, líneas de investigación y semblanza.</p></div></div>
    <div className="role-summary"><ShieldCheck size={23}/><div><b>Ficha interna y protegida</b><p>Solo usted puede modificar estos datos; la administración puede consultarlos. Las etiquetas son autodeclaradas: no verifican títulos ni cambian los roles o programas asignados. No aparecen en la biblioteca estudiantil.</p></div></div>
    {error && <div role="alert" className="alert alert-error">{error}</div>}
    {notice && <div role="status" className="alert alert-success">{notice}</div>}
    <div className="researcher-profile-grid">
      <section className="governance-panel">
        <h2><UserRound size={21}/> Identidad académica</h2>
        <p><strong>{user?.displayName || 'Investigador/a'}</strong><br/>{user?.email}</p>
        <p>Nombre y correo proceden de su cuenta y perfil institucional. No se pueden cambiar los permisos desde esta ficha.</p>
        <div className="researcher-profile-meta">{exists ? 'Ficha académica registrada' : 'Ficha académica por completar'}</div>
      </section>
      <section className="governance-panel">
        <h2><BookOpenText size={21}/> Formación y especialidades</h2>
        {loading ? <p>Cargando ficha…</p> : <form className="governance-form" onSubmit={event => void save(event)}>
          <div className="academic-tags-section">
            <h3>Trayectoria académica en etiquetas</h3>
            <p>Añada varias carreras, títulos, posgrados y certificaciones. Use «en curso» cuando corresponda. Estas etiquetas no conceden acceso a programas y todavía no se usan en búsquedas semánticas.</p>
            <AcademicTagEditor category="careers" label="Carreras" example="Ej. Licenciatura en Filosofía (en curso)" tags={fields.academicTags.careers} busy={busy} onAdd={addTag} onRemove={removeTag}/>
            <AcademicTagEditor category="degrees" label="Títulos y grados obtenidos" example="Ej. Ingeniería en Informática" tags={fields.academicTags.degrees} busy={busy} onAdd={addTag} onRemove={removeTag}/>
            <AcademicTagEditor category="postgraduate" label="Posgrados" example="Ej. Maestría en Filosofía" tags={fields.academicTags.postgraduate} busy={busy} onAdd={addTag} onRemove={removeTag}/>
            <AcademicTagEditor category="certifications" label="Certificaciones" example="Ej. Certificación de investigación" tags={fields.academicTags.certifications} busy={busy} onAdd={addTag} onRemove={removeTag}/>
          </div>
          <details className="academic-legacy-details"><summary>Resumen académico anterior (se conserva)</summary>
            <p>Su título o descripción anterior permanece intacto. No se transforma automáticamente en una titulación obtenida.</p>
            <label>Resumen académico<input maxLength={100} value={fields.academicTitle} onChange={event => change('academicTitle', event.target.value)} placeholder="Breve resumen de su formación"/></label>
          </details>
          <label>Institución o adscripción (opcional)<input maxLength={140} value={fields.institution} onChange={event => change('institution', event.target.value)} placeholder="Institución o centro de investigación"/></label>
          <label>Líneas de investigación<textarea rows={3} maxLength={450} value={fields.researchLines} onChange={event => change('researchLines', event.target.value)} placeholder="Ej. Ontología, teoría social, filosofía del lenguaje"/></label>
          <label>Semblanza académica<textarea rows={5} maxLength={1200} value={fields.biography} onChange={event => change('biography', event.target.value)} placeholder="Intereses, enfoque y trabajo académico (sin datos personales sensibles)"/></label>
          <button className="button button-primary" type="submit" disabled={busy}><Save size={17}/>{busy ? 'Guardando…' : 'Guardar ficha académica'}</button>
        </form>}
      </section>
    </div>
  </div>;
}
