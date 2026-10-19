import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { isInstitutionalEmail } from './policy';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    }, () => setLoading(false));
  }, []);
  return {
    user, loading,
    authorized: Boolean(user?.email && user.emailVerified && isInstitutionalEmail(user.email)),
  };
}
