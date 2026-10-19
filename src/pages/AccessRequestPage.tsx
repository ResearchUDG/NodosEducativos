import { useEffect, useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { explainError } from '../lib/errors';

export function AccessRequestPage({ user, suspended = false }: { user: User; suspended?: boolean }) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'accessRequests', user.uid)).then((snap) => {
      if (snap.exists()) {
        setStatus((snap.data().status as 'pending' | 'approved' | 'rejected') ?? 'pending');
        setDisplayName(String(snap.data().displayName || user.displayName || ''));
      }
    }).catch((e) => setError(explainError(e)));
  }, [user.uid, user.displayName]);
  async function apply() {
    const cleanName = displayName.trim();
    if (!db || !user.email || status || cleanName.length < 2 || cleanName.length > 90) return;
    setBusy(true); setError('');
    try {
      await setDoc(doc(db, 'accessRequests', user.uid), {
        email: user.email, displayName: cleanName,
        status: 'pending', createdAt: serverTimestamp(),
      });
      setStatus('pending');
    } catch (e) { setError(explainError(e)); }
    finally { setBusy(false); }
  }
  return <div className="verification-screen"><div className="verify-card role-request">
    <div className="eyebrow">DIRECTORIO ACADÉMICO / CONTROL DE ACCESO</div>
    <h1>{suspended ? 'Acceso suspendido' : 'Acceso sujeto a aprobación'}</h1>
    <p>La verificación del correo confirma su identidad institucional, pero no asigna permisos de profesor ni de estudiante. Un administrador revisará su solicitud y determinará qué publicaciones podrá consultar.</p>
    <p><strong>Correo institucional:</strong> {user.email}</p>
    {!suspended && !status && <div className="governance-form">
      <label htmlFor="academic-request-name">Nombre para el directorio académico
        <input id="academic-request-name" maxLength={90} minLength={2} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nombre y apellidos" autoComplete="name" />
      </label>
      <small>El administrador verá este nombre y su correo para identificar su solicitud. No escriba matrícula, CURP ni datos adicionales.</small>
    </div>}
    {status && <div className="alert">Estado de la solicitud: <strong>{status === 'pending' ? 'Pendiente' : status === 'approved' ? 'Revisada' : 'No aprobada'}</strong>.</div>}
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {!suspended && !status && <button className="button button-primary" disabled={busy || displayName.trim().length < 2} onClick={() => void apply()}>{busy ? 'Enviando…' : 'Solicitar acceso académico'}</button>}
    <button className="button button-secondary" onClick={() => { if (auth) void signOut(auth); }}>Cerrar sesión</button>
    <p className="fine-print">La autorización es manual y no garantiza acceso hasta que un administrador asigne un rol y programas académicos.</p>
  </div></div>;
}
