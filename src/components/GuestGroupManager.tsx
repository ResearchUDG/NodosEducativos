import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Clipboard, Eye, EyeOff, Link2, RefreshCw, UsersRound } from 'lucide-react';
import type { GroupInfo } from '../lib/groups';
import { explainError } from '../lib/errors';
import {
  disableGuestGroup, guestGroupShareUrl, listGuestGroupSettingsForAdmin,
  normalizeGuestSlug, saveGuestGroupSettings, type GuestGroupSettings,
} from '../lib/guestGroups';

type Props = { groups: GroupInfo[] };

export function GuestGroupManager({ groups }: Props) {
  const [settings, setSettings] = useState<Record<string, GuestGroupSettings>>({});
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [guideEnabled, setGuideEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedGroup = useMemo(() => groups.find(group => group.id === selectedGroupId) ?? null, [groups, selectedGroupId]);
  const current = selectedGroupId ? settings[selectedGroupId] : undefined;

  async function refresh() {
    setLoading(true); setError('');
    try {
      const list = await listGuestGroupSettingsForAdmin();
      setSettings(Object.fromEntries(list.map(item => [item.groupId, item])));
    } catch (reason) { setError(explainError(reason)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (!selectedGroup) {
      setSlug(''); setTitle(''); setDescription(''); setGuideEnabled(true); return;
    }
    const existing = settings[selectedGroup.id];
    setSlug(existing?.slug || normalizeGuestSlug(selectedGroup.name));
    setTitle(existing?.title || selectedGroup.name);
    setDescription(existing?.description || selectedGroup.description || '');
    setGuideEnabled(existing?.guideEnabled !== false);
    setError(''); setNotice('');
  }, [selectedGroupId, selectedGroup?.name, settings]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selectedGroup || busy) return;
    if (!selectedGroup.active) { setError('Reactive primero el programa para habilitar su acceso invitado.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const count = await saveGuestGroupSettings(selectedGroup.id, { slug, title, description, guideEnabled });
      await refresh();
      setNotice(`Grupo de invitados habilitado. Se sincronizaron ${count} ${count === 1 ? 'publicación' : 'publicaciones'} vigentes.`);
    } catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }

  async function disable() {
    if (!selectedGroup || busy || !current?.active) return;
    if (!window.confirm(`¿Desactivar el acceso invitado de «${selectedGroup.name}»? Las publicaciones académicas internas no se eliminarán.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await disableGuestGroup(selectedGroup.id);
      await refresh();
      setNotice('Acceso invitado desactivado. El grupo volvió a requerir una cuenta autorizada.');
    } catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    if (!current?.active) return;
    try {
      await navigator.clipboard.writeText(guestGroupShareUrl(current.slug));
      setNotice('Enlace público copiado.');
    } catch { setError('No fue posible copiar el enlace. Puede seleccionarlo manualmente.'); }
  }

  return <section className="governance-panel governance-wide guest-admin-panel">
    <div className="program-catalog-heading"><div><h2><UsersRound size={21}/> Grupos de invitados</h2>
      <p>Abra un programa a personas sin cuenta mediante una copia pública de solo lectura. Los borradores, historiales, perfiles y solicitudes permanecen privados.</p></div>
      <button type="button" className="button button-secondary" disabled={busy || loading} onClick={() => void refresh()}><RefreshCw size={15}/> Actualizar</button>
    </div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {notice && <p className="alert alert-success" role="status">{notice}</p>}
    <div className="guest-admin-grid">
      <div className="guest-program-list" aria-label="Programas y estado de invitados">
        {groups.map(group => {
          const guest = settings[group.id];
          const enabled = group.active && guest?.active === true;
          return <button type="button" key={group.id} className={`guest-program-choice ${selectedGroupId === group.id ? 'guest-program-choice--selected' : ''}`} onClick={() => setSelectedGroupId(group.id)}>
            <span><b>{group.name}</b><small>{enabled ? `Público · /${guest.slug}` : group.active ? 'Solo miembros' : 'Programa desactivado'}</small></span>
            <span className={enabled ? 'guest-state guest-state--open' : 'guest-state'}>{enabled ? <Eye size={15}/> : <EyeOff size={15}/>} {enabled ? 'Invitados' : 'Privado'}</span>
          </button>;
        })}
      </div>
      <div className="guest-admin-editor">
        {!selectedGroup ? <div className="guest-admin-placeholder"><Link2 size={25}/><p>Seleccione un programa para configurar su acceso invitado.</p></div> : <form className="governance-form" onSubmit={event => void save(event)}>
          <div className="guest-config-heading"><div><div className="eyebrow">ACCESO PÚBLICO CONTROLADO</div><h3>{selectedGroup.name}</h3></div>{current?.active && <span className="program-status program-status-active">Grupo de invitados activo</span>}</div>
          <label>Título público<input required minLength={3} maxLength={100} value={title} onChange={event => setTitle(event.target.value)} disabled={busy}/></label>
          <label>Dirección pública<div className="guest-slug-input"><span>/invitados/</span><input required minLength={3} maxLength={60} value={slug} onChange={event => setSlug(event.target.value)} onBlur={() => { try { setSlug(normalizeGuestSlug(slug)); } catch { /* El submit mostrará el error. */ } }} disabled={busy}/></div></label>
          <label>Descripción pública<textarea rows={3} maxLength={400} value={description} onChange={event => setDescription(event.target.value)} disabled={busy}/></label>
          <label className="guest-option"><input type="checkbox" checked={guideEnabled} onChange={event => setGuideEnabled(event.target.checked)} disabled={busy}/><span><b>Permitir guía de lectura</b><small>Los invitados podrán recorrer los nodos paso a paso. Nunca podrán editarlos.</small></span></label>
          {current?.active && <div className="guest-public-link"><div><small>ENLACE PÚBLICO</small><a href={guestGroupShareUrl(current.slug)} target="_blank" rel="noopener noreferrer">{guestGroupShareUrl(current.slug)}</a></div><button type="button" className="button button-secondary" onClick={() => void copyLink()} disabled={busy}><Clipboard size={15}/> Copiar</button></div>}
          {!selectedGroup.active && <p className="alert alert-warning">Este programa está desactivado. Aunque exista una configuración anterior, las reglas bloquean su lectura pública.</p>}
          <div className="directory-actions"><button type="submit" className="button button-primary" disabled={busy || !selectedGroup.active}><Check size={15}/> {current?.active ? 'Guardar configuración' : 'Habilitar invitados'}</button>{current?.active && <button type="button" className="button button-secondary" disabled={busy} onClick={() => void disable()}><EyeOff size={15}/> Desactivar invitados</button>}</div>
        </form>}
      </div>
    </div>
  </section>;
}
