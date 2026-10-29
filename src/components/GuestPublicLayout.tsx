import type { ReactNode } from 'react';
import { ExternalLink, Network } from 'lucide-react';
import { ThemeSwitch } from './ThemeSwitch';

export function GuestPublicLayout({ children }: { children: ReactNode }) {
  const base = typeof window === 'undefined' ? '/' : `${window.location.origin}${window.location.pathname}`;
  return <div className="guest-public-shell">
    <header className="guest-public-header">
      <a className="guest-public-brand" href={base} aria-label="Nodos Educativos · Acceso institucional">
        <span className="guest-public-mark"><Network size={21}/></span>
        <span><b>NODOS.</b><small>EDUCATIVOS</small></span>
      </a>
      <div className="guest-public-header-actions">
        <ThemeSwitch compact/>
        <span className="guest-access-pill">Acceso invitado · Solo lectura</span>
        <a className="button button-secondary" href={base}>Acceso institucional <ExternalLink size={15}/></a>
      </div>
    </header>
    <main className="guest-public-content">{children}</main>
    <footer className="guest-public-footer">
      <span>Nodos Educativos · Proyecto independiente de investigación académica.</span>
      <a href={`${base}#/privacidad`}>Privacidad y condiciones</a>
    </footer>
  </div>;
}
