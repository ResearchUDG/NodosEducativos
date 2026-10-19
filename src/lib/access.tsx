import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export type AcademicRole = 'admin' | 'professor' | 'student';
type AccessState = { role: AcademicRole | null; loading: boolean; active: boolean; error: string };
const Context = createContext<AccessState>({ role: null, loading: true, active: false, error: '' });

export function AccessProvider({ user, children }: { user: User; children: ReactNode }) {
  const [state, setState] = useState<AccessState>({ role: null, loading: true, active: false, error: '' });
  useEffect(() => {
    if (!db) { setState({ role: null, active: false, loading: false, error: 'Firebase no configurado.' }); return; }
    setState({ role: null, active: false, loading: true, error: '' });
    return onSnapshot(doc(db, 'access', user.uid), (snapshot) => {
      const data = snapshot.data();
      const role = data && ['admin','professor','student'].includes(data.role) ? data.role as AcademicRole : null;
      setState({ role, active: data?.active === true, loading: false, error: '' });
    }, () => setState({ role: null, active: false, loading: false, error: 'No fue posible validar sus permisos. No se habilitará el acceso.' }));
  }, [user.uid]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useAccess() { return useContext(Context); }
export function canAuthor(role: AcademicRole | null) { return role === 'admin' || role === 'professor'; }
