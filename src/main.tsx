import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import '@xyflow/react/dist/style.css';
import './styles/app.css';
import './styles/theme.css';
import { Layout } from './components/Layout';
import { AuthPage, VerifyEmailPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { DiagramEditor } from './pages/DiagramEditor';
import { VisualDesigner } from './pages/VisualDesigner';
import { ExportStudio } from './pages/ExportStudio';
import { ProfilePage } from './pages/ProfilePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { auth, firebaseConfigured } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { isInstitutionalEmail } from './lib/policy';
import { useAuth } from './lib/useAuth';
import { AccessProvider, canAuthor, useAccess } from './lib/access';
import { AccessRequestPage } from './pages/AccessRequestPage';
import { AcademicLibrary } from './pages/AcademicLibrary';
import { PublishedViewer } from './pages/PublishedViewer';
import { AdminDirectory } from './pages/AdminDirectory';
import { ResearcherProfile } from './pages/ResearcherProfile';
import { StudentDashboard } from './pages/StudentDashboard';
import { GuestGroupPage } from './pages/GuestGroupPage';
import { GuestPublishedViewer } from './pages/GuestPublishedViewer';
import { GuestFigurePage } from './pages/GuestFigurePage';
import { ThemeProvider } from './lib/theme';
import { ThemeSwitch } from './components/ThemeSwitch';

function ConfigRequired() {
  return <div className="verification-screen"><div className="verify-card"><div className="verification-theme-switch"><ThemeSwitch compact/></div><h1>Configuración pendiente</h1><p>La aplicación se ha preparado, pero aún no existe una conexión configurada con Firebase. Defina las variables públicas VITE_FIREBASE_* y publique las reglas de seguridad antes de poner el sistema en funcionamiento.</p><a href="https://github.com/ResearchUDG/NodosEducativos" rel="noreferrer">Ver el repositorio</a></div></div>;
}
function ApprovedApplication({ user }: { user: import('firebase/auth').User }) {
  const { role, loading, active, error } = useAccess();
  if (loading) return <div className="verification-screen">Consultando roles y permisos…</div>;
  if (error) return <div className="verification-screen"><div className="verify-card"><h1>Acceso no disponible</h1><p role="alert">{error}</p></div></div>;
  if (!role || !active) return <AccessRequestPage user={user} suspended={Boolean(role) && !active}/>;
  return <HashRouter><Routes><Route element={<Layout/>}>
    <Route index element={canAuthor(role) ? <Dashboard/> : <StudentDashboard/>}/>
    <Route path="biblioteca" element={<AcademicLibrary/>}/>
    <Route path="publicacion/:groupId/:id" element={<PublishedViewer/>}/>
    <Route path="esquemas" element={canAuthor(role) ? <Dashboard/> : <StudentDashboard/>}/>
    <Route path="esquema/:id" element={<DiagramEditor/>}/>
    <Route path="esquema/:id/diseno" element={canAuthor(role) ? <VisualDesigner/> : <Navigate to="/" replace/>}/>
    <Route path="esquema/:id/exportar" element={canAuthor(role) ? <ExportStudio/> : <Navigate to="/" replace/>}/>
    <Route path="directorio" element={role === 'admin' ? <AdminDirectory/> : <Navigate to="/" replace/>}/>
    <Route path="investigador" element={canAuthor(role) ? <ResearcherProfile/> : <Navigate to="/biblioteca" replace/>}/>
    <Route path="perfil" element={<ProfilePage/>}/>
    <Route path="privacidad" element={<PrivacyPage/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route></Routes></HashRouter>;
}
function GuestApplication() {
  return <HashRouter><Routes>
    <Route path="/invitados/:slug" element={<GuestGroupPage/>}/>
    <Route path="/invitados/:slug/publicacion/:id" element={<GuestPublishedViewer/>}/>
    <Route path="/invitados/:slug/esquema/:id" element={<GuestPublishedViewer/>}/>
    <Route path="/invitados/:slug/figura/:id" element={<GuestFigurePage/>}/>
  </Routes></HashRouter>;
}
function Application() {
  const { loading, user, authorized } = useAuth();
  if (!firebaseConfigured) return <HashRouter><Routes><Route path="/privacidad" element={<PrivacyPage/>}/><Route path="*" element={<ConfigRequired/>}/></Routes></HashRouter>;
  const guestRoute = /^#\/invitados(?:\/|$)/.test(window.location.hash);
  if (guestRoute) return <GuestApplication/>;
  if (loading) return <div className="verification-screen"><span className="loading-screen">Verificando la sesión institucional…</span></div>;
  if (!user) return <HashRouter><Routes><Route path="/privacidad" element={<PrivacyPage/>}/><Route path="*" element={<AuthPage/>}/></Routes></HashRouter>;
  if (!isInstitutionalEmail(user.email ?? '')) return <div className="verification-screen"><div className="verify-card"><h1>Dominio no autorizado</h1><p>La cuenta autenticada no pertenece a la lista de dominios institucionales admitidos. No puede acceder a perfiles ni esquemas.</p><button className="button button-secondary" onClick={async () => { if (auth) await signOut(auth); }}>Cerrar sesión</button></div></div>;
  if (!authorized) return <HashRouter><Routes><Route path="/privacidad" element={<PrivacyPage/>}/><Route path="*" element={<VerifyEmailPage/>}/></Routes></HashRouter>;
  return <AccessProvider user={user}><ApprovedApplication user={user}/></AccessProvider>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><Application/></ThemeProvider></React.StrictMode>);
