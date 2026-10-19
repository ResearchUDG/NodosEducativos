import { useEffect, useState, type FormEvent } from 'react';
import { Link2, LockKeyhole, MailCheck, Save, ShieldCheck, UserRound } from 'lucide-react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithCredential,
  signOut,
  unlink,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { explainError } from '../lib/errors';
import { hasProvider, refreshGoogleLinkStatus, validateLinkedGoogleAccount } from '../lib/googleLinkPolicy';
import { normalizeEmail, PRIVACY_VERSION } from '../lib/policy';
import { useAuth } from '../lib/useAuth';

export function ProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [exists, setExists] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkMessage, setLinkMessage] = useState('');
  // El hook de autenticación empieza sin usuario y restaura la sesión más tarde.
  // No derivar esta condición solamente en el primer render: quedaría obsoleta.
  const [googleStatus, setGoogleStatus] = useState<'checking' | 'linked' | 'not-linked' | 'error'>('checking');

  useEffect(() => {
    if (!user || !auth) {
      setGoogleStatus('checking');
      return;
    }
    let active = true;
    setGoogleStatus('checking');
    // Actualizar los proveedores desde Firebase, no desde un estado local anterior.
    void refreshGoogleLinkStatus(
      user.uid,
      () => user.reload(),
      () => {
        const current = auth?.currentUser;
        return current
          ? { uid: current.uid, providerIds: current.providerData.map((entry) => entry.providerId) }
          : null;
      },
    ).then((linked) => {
      if (active) setGoogleStatus(linked ? 'linked' : 'not-linked');
    }).catch(() => {
      if (active) setGoogleStatus('error');
    });
    return () => { active = false; };
  }, [user?.uid]);

  useEffect(() => {
    if (!db || !user) return;
    let active = true;
    getDoc(doc(db, 'users', user.uid)).then((snapshot) => {
      if (!active) return;
      setExists(snapshot.exists());
      if (snapshot.exists()) setName(String(snapshot.data().displayName ?? ''));
    }).catch((err) => { if (active) setMessage(explainError(err)); });
    return () => { active = false; };
  }, [user]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!db || !user) return;
    setBusy(true); setMessage('');
    try {
      const ref = doc(db, 'users', user.uid);
      if (exists) await updateDoc(ref, { displayName: name.trim(), updatedAt: serverTimestamp() });
      else await setDoc(ref, { displayName: name.trim(), privacyVersion: PRIVACY_VERSION, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setSaved(true); setExists(true);
    } catch (err) { setMessage(explainError(err)); }
    finally { setBusy(false); }
  }

  const providers = user?.providerData.map((provider) => provider.providerId) ?? [];
  const hasPasswordLogin = hasProvider(providers, 'password');

  async function connectGoogle(event: FormEvent) {
    event.preventDefault();
    if (!auth || !user || linkBusy || googleStatus !== 'not-linked' || !hasPasswordLogin || !user.email) return;
    setLinkBusy(true); setLinkError(''); setLinkMessage('');
    const originalUid = user.uid;
    const originalEmail = normalizeEmail(user.email);

    try {
      const current = auth.currentUser;
      if (!current || current.uid !== originalUid) {
        throw new Error('La sesión cambió. Vuelva a ingresar con contraseña antes de vincular Google.');
      }
      // Reautenticación reciente: la mera sesión abierta no basta para agregar un proveedor.
      await reauthenticateWithCredential(
        current,
        EmailAuthProvider.credential(originalEmail, linkPassword),
      );
      const provider = new GoogleAuthProvider();
      // login_hint y hd solo facilitan la elección: NO son controles de seguridad.
      provider.setCustomParameters({
        login_hint: originalEmail,
        hd: originalEmail.split('@')[1],
        prompt: 'select_account',
      });
      const result = await linkWithPopup(current, provider);
      const googleEmail = result.user.providerData.find(
        (entry) => entry.providerId === GoogleAuthProvider.PROVIDER_ID,
      )?.email ?? null;
      const problem = validateLinkedGoogleAccount(
        originalUid,
        result.user.uid,
        originalEmail,
        result.user.email,
        result.user.emailVerified,
        googleEmail,
      );
      if (problem) {
        // linkWithPopup enlaza antes de entregar los datos del proveedor.
        // Revertimos inmediatamente cualquier vínculo indebido.
        try {
          if (result.user.uid !== originalUid) {
            throw new Error('UID inesperado tras la vinculación');
          }
          await unlink(result.user, GoogleAuthProvider.PROVIDER_ID);
          setGoogleStatus('not-linked');
          setLinkError(`${problem} La vinculación de Google se revirtió; su cuenta conserva el ingreso mediante contraseña.`);
        } catch {
          window.alert('ATENCIÓN: No fue posible revertir la vinculación de Google. Se cerrará su sesión. Revise los proveedores asociados en Firebase Authentication antes de volver a usar esta cuenta.');
          await signOut(auth);
        }
        return;
      }
      await result.user.reload();
      if (auth.currentUser?.uid !== originalUid) {
        throw new Error('No se confirmó la conservación de UID. Verifique la cuenta en Firebase Console antes de seguir.');
      }
      setGoogleStatus('linked');
      setLinkMessage('Google institucional conectado. Se conservó el mismo UID y no cambiamos sus permisos ni sus esquemas.');
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setLinkError(explainError(err));
      }
    } finally {
      setLinkPassword('');
      setLinkBusy(false);
    }
  }

  return <div className="narrow-page">
    <div className="page-intro"><div><div className="eyebrow">MI CUENTA / CONFIGURACIÓN</div><h1>Perfil institucional<span className="period">.</span></h1><p>Administre los datos básicos visibles en su espacio personal.</p></div></div>
    <div className="profile-card"><div className="profile-avatar"><UserRound size={31}/></div><div><div className="eyebrow">IDENTIDAD VERIFICADA</div><h2>{user?.displayName || name || 'Investigador/a'}</h2><p>{user?.email}</p></div><span className="verified-pill"><MailCheck size={16}/> Verificado</span></div>
    <div className="profile-form"><h2>Datos del perfil</h2><p>La contraseña se administra mediante Firebase Authentication y no se muestra aquí.</p><form onSubmit={save}><label>Nombre público en su espacio<input maxLength={90} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Nombre para su perfil"/></label>{message && <p role="alert" className="alert alert-error">{message}</p>}<button className="button button-primary" disabled={busy}><Save size={17}/>{busy ? 'Guardando…' : saved ? 'Guardado' : 'Guardar perfil'}</button></form></div>
    <section className="profile-form google-link-panel" aria-labelledby="google-link-title">
      <div className="google-link-header"><div><div className="eyebrow">MÉTODOS DE ACCESO</div><h2 id="google-link-title">{googleStatus === 'linked' ? 'Métodos de acceso conectados' : 'Vincular Google'}</h2><p>{googleStatus === 'linked' ? 'Su Google institucional está asociado a esta cuenta Firebase. Los roles y documentos siguen ligados al mismo UID.' : 'Asocie su Google institucional a esta misma cuenta Firebase. Sus roles y documentos permanecen ligados a su UID actual.'}</p></div><Link2 size={25} aria-hidden="true"/></div>
      {googleStatus === 'checking' ? <p className="google-link-note" role="status">Comprobando los métodos de acceso vinculados…</p>
        : googleStatus === 'error' ? <div className="alert alert-error" role="alert">No fue posible comprobar los métodos vinculados con Firebase. Recargue el perfil para intentarlo nuevamente. No es necesario volver a vincular Google.</div>
        : googleStatus === 'linked' ? <div className="alert alert-success" role="status">{linkMessage || 'Google institucional conectado. También puede seguir usando su método de acceso anterior.'}</div>
        : !hasPasswordLogin ? <p className="google-link-note">Su cuenta no tiene un método de contraseña vinculado. No es necesario conectar Google desde aquí si ya inició sesión con ese proveedor. Solicite asistencia antes de cambiar identidades.</p>
        : <form className="google-link-form" onSubmit={(event) => void connectGoogle(event)}>
          <p className="google-link-note">Por seguridad, confirme su contraseña de <strong>Nodos Educativos</strong> (no la contraseña universitaria) y seleccione en Google <strong>exactamente {user?.email}</strong>. No aceptamos cuentas personales ni otro correo institucional distinto.</p>
          <label>Contraseña actual de Nodos Educativos<input type="password" autoComplete="current-password" required value={linkPassword} onChange={(event) => setLinkPassword(event.target.value)} placeholder="Confirme su contraseña para continuar"/></label>
          <button type="submit" className="button button-primary" disabled={linkBusy || !linkPassword}>{linkBusy ? 'Vinculando…' : 'Confirmar y vincular Google'}</button>
        </form>}
      {linkError && <div role="alert" className="alert alert-error">{linkError}</div>}
      
      {googleStatus !== 'linked' && <p className="google-link-note">No se envían mensajes de verificación para este proceso. Si Google ya pertenece a otro UID, detendremos la vinculación; nunca fusionaremos cuentas automáticamente.</p>}
    </section>
    <div className="profile-details"><div><ShieldCheck size={22}/><b>Datos protegidos</b><p>Los esquemas y el perfil se autorizan mediante reglas de Firestore por usuario.</p></div><div><LockKeyhole size={22}/><b>Sesión del navegador</b><p>La persistencia de autenticación se configura para esta sesión de navegador.</p></div></div>
    <p className="fine-print">Para solicitudes de acceso, corrección o eliminación consulte el <Link to="/privacidad">aviso provisional de privacidad</Link>. No complete el lanzamiento público sin registrar un responsable real.</p>
  </div>;
}
