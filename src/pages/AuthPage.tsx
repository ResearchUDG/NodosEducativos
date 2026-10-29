import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, setPersistence, browserSessionPersistence, signInWithEmailAndPassword, updateProfile, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, Network, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { explainError } from '../lib/errors';
import { isInstitutionalEmail, normalizeEmail } from '../lib/policy';
import { validateGoogleIdentity } from '../lib/googleAccess';
import { ThemeSwitch } from '../components/ThemeSwitch';

type Mode = 'signin' | 'signup' | 'reset';
const GOOGLE_REJECTION_KEY = 'nodos-google-rejection-v1';
export function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => {
    const rejection = sessionStorage.getItem(GOOGLE_REJECTION_KEY) ?? '';
    sessionStorage.removeItem(GOOGLE_REJECTION_KEY);
    return rejection;
  });
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const address = normalizeEmail(email);
    if (!isInstitutionalEmail(address)) {
      setError('Solo se admiten dominios institucionales UdeG expresamente autorizados.');
      return;
    }
    if (mode === 'signup' && password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.'); return;
    }
    if (!auth) { setError('Firebase todavía no está configurado.'); return; }
    setBusy(true);
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, address);
        setMessage('Si existe una cuenta para este correo, recibirá instrucciones de recuperación.');
      } else if (mode === 'signup') {
        await setPersistence(auth, browserSessionPersistence);
        const result = await createUserWithEmailAndPassword(auth, address, password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim().slice(0, 90) });
        await sendEmailVerification(result.user);
        setMessage('Le enviamos el enlace de verificación. Revise su bandeja de entrada.');
      } else {
        await setPersistence(auth, browserSessionPersistence);
        await signInWithEmailAndPassword(auth, address, password);
      }
    } catch (reason) {
      setError(explainError(reason));
      // Si el envío de verificación falló, conservar la sesión para permitir reintento.
    } finally { setBusy(false); }
  }
  async function accessWithGoogle() {
    if (!auth || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      // Esta preferencia se aplica a la sesión iniciada por nuestra app.
      await setPersistence(auth, browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const googleEmail = result.user.providerData.find((entry) => entry.providerId === GoogleAuthProvider.PROVIDER_ID)?.email ?? null;
      const reason = validateGoogleIdentity(result.user.email, result.user.emailVerified, googleEmail);
      if (reason) {
        // onAuthStateChanged puede desmontar el formulario durante el popup.
        // Guardamos solamente el motivo genérico, nunca datos del usuario.
        sessionStorage.setItem(GOOGLE_REJECTION_KEY, reason);
        setMode('signin');
        await signOut(auth);
        setError(reason);
        return;
      }
      sessionStorage.removeItem(GOOGLE_REJECTION_KEY);
      // No enviamos enlaces ni correos de verificación a través de Google.
      // Los permisos reales los determina access/{uid} y Firestore Security Rules.
    } catch (reason) {
      const code = typeof reason === 'object' && reason !== null && 'code' in reason ? String(reason.code) : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setMode('signin');
      setError(explainError(reason));
    } finally { setBusy(false); }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <div className="auth-brand"><span className="brand-symbol"><Network size={25}/></span><b>NODOS<span className="brand-dot">.</span> EDUCATIVOS</b></div>
        <div className="auth-story-body"><div className="eyebrow eyebrow-light">PLATAFORMA DE CONOCIMIENTO</div><h1>Las ideas crecen<br/>cuando <em>se conectan.</em></h1><p>Un espacio para representar, organizar y explorar redes de conocimiento a través de esquemas 2D.</p>
          <div className="auth-story-art" aria-hidden="true"><span className="art-node art-node-a">Investigación</span><span className="art-node art-node-b">Conceptos</span><span className="art-node art-node-c">Análisis</span><span className="art-node art-node-d">Conocimiento</span><svg viewBox="0 0 470 270"><path d="M123 65 L280 28 L378 130 L265 225 L123 65 L120 210 L265 225" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 8" /></svg></div>
        </div>
        <small className="auth-story-footer">RESEARCHUDG / NODOS EDUCATIVOS · 2026</small>
      </div>
      <div className="auth-panel"><div className="auth-content">
        <div className="auth-theme-switch"><ThemeSwitch compact/></div>
        <div className="auth-mark"><GraduationCap size={23}/></div>
        <div className="eyebrow">ACCESO A LA PLATAFORMA</div>
        <h2>{mode === 'signin' ? 'Bienvenido de nuevo.' : mode === 'signup' ? 'Crear una cuenta.' : 'Recuperar acceso.'}</h2>
        <p className="auth-subtitle">{mode === 'signin' ? 'Use Google con su correo institucional o entre con contraseña.' : mode === 'signup' ? 'Confirme su correo institucional antes de ingresar.' : 'Recibirá un correo para restablecer su contraseña.'}</p>
        <div className="auth-switch"><button className={mode === 'signin' ? 'selected' : ''} onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>Iniciar sesión</button><button className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Registrarse</button></div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>Nombre visible (opcional)<input autoComplete="name" value={name} maxLength={90} placeholder="¿Cómo desea aparecer?" onChange={(e) => setName(e.target.value)}/></label>}
          <label>Correo institucional <div className="input-icon"><Mail size={18}/><input type="email" autoComplete="username" required placeholder="nombre@alumnos.udg.mx" value={email} onChange={(e) => setEmail(e.target.value)}/></div></label>
          {mode !== 'reset' && <label>Contraseña <div className="input-icon"><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 12 : 1} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Mínimo 12 caracteres' : 'Su contraseña'}/><button className="show-password" type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>}
          {mode === 'signup' && <p className="form-note">Al registrarse acepta las <Link to="/privacidad">condiciones y el aviso de privacidad</Link>. Use una contraseña nueva y distinta de su contraseña institucional UdeG. Firebase Authentication la gestiona; no se guarda en nuestro repositorio ni en Firestore.</p>}
          {error && <div role="alert" className="alert alert-error">{error}</div>}
          {message && <div role="status" className="alert alert-success">{message}</div>}
          <button disabled={busy} className="button button-primary button-full" type="submit">{busy ? 'Procesando…' : mode === 'signin' ? 'Entrar al tablero' : mode === 'signup' ? 'Crear cuenta y verificar' : 'Enviar recuperación'} <ArrowRight size={17}/></button>
        </form>
        {mode !== 'reset' && <div className="google-auth-section">
          <div className="google-auth-divider"><span>o</span></div>
          <button type="button" className="button-google" disabled={busy} onClick={() => void accessWithGoogle()}>
            <svg className="google-auth-logo" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.9 46.98 24.55z"/>
              <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.12.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.51 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg> Continuar con Google
          </button>
          <p className="google-auth-help">Solo dominios institucionales autorizados. Google puede proporcionar nombre, correo e imagen de perfil. <strong>Una cuenta Google no concede permisos académicos.</strong> Si ya tiene una cuenta con contraseña, consérvela hasta vincular ambos métodos de forma segura. Consulte el <Link to="/privacidad">aviso de privacidad</Link>.</p>
        </div>}
        {mode !== 'reset' ? <button className="link-button forgot-link" onClick={() => setMode('reset')}>¿Olvidó su contraseña?</button> : <button className="link-button forgot-link" onClick={() => setMode('signin')}>Volver a iniciar sesión</button>}
        <div className="secure-note"><ShieldCheck size={19}/><span><b>Acceso verificado.</b> Únicamente cuentas con dominio autorizado y correo verificado pueden consultar datos privados.</span></div>
        <p className="auth-privacy">El servicio necesita almacenar datos mínimos de cuenta y sesión; nunca afirmamos que no se procese información. <Link to="/privacidad">Cómo protegemos su privacidad.</Link></p>
      </div></div>
    </div>
  );
}
export function VerifyEmailPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function check() {
    if (!auth?.currentUser) return;
    setBusy(true);
    try { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); if (auth.currentUser.emailVerified) window.location.reload(); else setMessage('La verificación todavía está pendiente. Compruebe el enlace del correo.'); }
    catch (err) { setMessage(explainError(err)); }
    finally { setBusy(false); }
  }
  async function resend() {
    if (!auth?.currentUser) return;
    if (!isInstitutionalEmail(auth.currentUser.email ?? '')) {
      setMessage('No se envían enlaces de verificación a dominios no autorizados.');
      return;
    }
    setBusy(true);
    try { await sendEmailVerification(auth.currentUser); setMessage('Se envió un nuevo enlace.'); }
    catch (err) { setMessage(explainError(err)); }
    finally { setBusy(false); }
  }
  return <div className="verification-screen"><div className="verify-card"><div className="verification-theme-switch"><ThemeSwitch compact/></div><span className="verify-icon"><Mail size={34}/></span><div className="eyebrow">VERIFICACIÓN OBLIGATORIA</div><h1>Confirme su dirección institucional</h1><p>Para proteger los espacios de investigación, primero necesitamos confirmar que tiene acceso a la cuenta de correo indicada.</p><b>{auth?.currentUser?.email}</b>{message && <p role="status" className="alert">{message}</p>}<button className="button button-primary" disabled={busy} onClick={check}>Ya verifiqué mi correo <ArrowRight size={17}/></button><button className="button button-secondary" disabled={busy} onClick={resend}>Volver a enviar enlace</button><button className="link-button" onClick={async () => { if (auth) await signOut(auth); }}>Usar otra cuenta</button></div></div>;
}
