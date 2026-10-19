import { useState } from 'react';
import { BookOpenText, ChevronDown, CircleHelp, LayoutDashboard, Lock, LogOut, Menu, Network, UserRound, X, Users, BookOpen, GraduationCap } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { useAccess, canAuthor } from '../lib/access';

export function Layout() {
  const { user } = useAuth();
  const { role } = useAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const nav = [
    { to: '/', label: role === 'student' ? 'Mi biblioteca' : 'Tablero', icon: LayoutDashboard },
    ...(canAuthor(role) ? [{ to: '/esquemas', label: 'Laboratorio 2D', icon: Network }, { to: '/investigador', label: 'Ficha de investigador', icon: GraduationCap }] : []),
    { to: '/biblioteca', label: 'Publicaciones académicas', icon: BookOpen },
    ...(role === 'admin' ? [{ to: '/directorio', label: 'Directorio académico', icon: Users }] : []),
    { to: '/privacidad', label: 'Privacidad', icon: Lock },
  ];
  const roleName = role === 'admin' ? 'Administrador' : role === 'professor' ? 'Profesor investigador' : 'Estudiante';
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-symbol"><Network size={24} strokeWidth={1.8}/></span>
          <span><b>NODOS<span className="brand-dot">.</span></b><small>EDUCATIVOS</small></span>
        </Link>
        <div className="sidebar-eyebrow">{roleName.toUpperCase()}</div>
        <nav className="sidebar-nav" aria-label="Principal">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`} onClick={() => setMenuOpen(false)}>
              <Icon size={18} />{label}<span className="nav-arrow">↗</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="access-note"><span className="online-indicator" /> Acceso institucional verificado</div>
          <p>Investigación, diálogo y conocimiento conectado.</p>
          <div className="sidebar-version">VERSIÓN 0.3.0 · INVESTIGADORES</div>
        </div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-leading"><button className="icon-button mobile-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menú"><Menu size={20}/></button><span>RESEARCHUDG</span><span className="topbar-separator">/</span><b>Área de trabajo</b></div>
          <div className="topbar-trailing">
            <Link className="icon-button topbar-help" to="/privacidad" title="Aviso de privacidad"><CircleHelp size={19} /></Link>
            <div className="profile-control">
              <button className="profile-button" aria-label="Menú de perfil" aria-expanded={profileOpen} onClick={() => setProfileOpen((v) => !v)}><span className="avatar">{user?.email?.charAt(0).toUpperCase() ?? 'U'}</span><span className="profile-brief"><b>Mi espacio</b><small>{roleName} · verificado</small></span><ChevronDown size={16}/></button>
              {profileOpen && <div className="profile-popover">
                <div className="popover-heading">CUENTA INSTITUCIONAL<small>{user?.email}</small></div>
                <Link to="/perfil" onClick={() => setProfileOpen(false)}><UserRound size={16}/> Ver mi perfil</Link>
                <Link to="/privacidad" onClick={() => setProfileOpen(false)}><BookOpenText size={16}/> Aviso de privacidad</Link>
                <button onClick={async () => { setProfileOpen(false); if (auth) await signOut(auth); }}><LogOut size={16}/> Cerrar sesión</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="content"><Outlet/></main>
        <footer className="site-footer">Nodos Educativos · Proyecto independiente de investigación académica. Sin afiliación oficial declarada con la Universidad de Guadalajara. <Link to="/privacidad">Privacidad y condiciones</Link></footer>
      </div>
      {menuOpen && <button className="menu-close" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}><X size={18}/></button>}
    </div>
  );
}
