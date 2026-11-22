import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { UserProfile, UserRole } from '../types/queue';

const BOOTSTRAP_STAFF_EMAIL = 'thejashwinin61@gmail.com';
const DEMO_STAFF_STORAGE_KEY = 'lineless_demo_staff_v1';
const DEMO_VISITOR_STORAGE_KEY = 'lineless_demo_visitor_v1';

export const DEMO_VISITOR_UID = 'demo_visitor_local';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isStaff: boolean;
  isDemoStaff: boolean;
  isDemoVisitor: boolean;
  isDemoMode: boolean;
  authReady: boolean;
  authBusy: boolean;
  emailProviderDisabledNotice: boolean;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (options?: {
    forceAccountSelect?: boolean;
    clearDemoMode?: 'staff' | 'visitor' | 'all';
  }) => Promise<{ user: User; isAuthorizedStaff: boolean }>;
  logout: () => Promise<void>;
  updatePreferences: (updates: { name?: string; emailNotificationsEnabled?: boolean }) => Promise<void>;
  clearEmailProviderNotice: () => void;
  enterDemoStaffMode: () => void;
  exitDemoStaffMode: () => void;
  enterDemoVisitorMode: () => void;
  exitDemoVisitorMode: () => void;
  exitAllDemoModes: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function tsToMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

function isFirebaseOperationNotAllowed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  return code === 'auth/operation-not-allowed';
}

export function formatAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Authentication failed. Please try again.';
  const code = (error as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please check your credentials and try again.';
    case 'auth/too-many-requests':
      return 'Too many login attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before finishing.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in the Firebase project console. Enable Email/Password under Authentication > Sign-in method, or sign in with Google.';
    default:
      return error instanceof Error ? error.message : 'Unable to sign in right now.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasStaffDoc, setHasStaffDoc] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [emailProviderDisabledNotice, setEmailProviderDisabledNotice] = useState(false);
  const [isDemoStaff, setIsDemoStaff] = useState<boolean>(() => {
    try {
      localStorage.removeItem(DEMO_STAFF_STORAGE_KEY);
      return sessionStorage.getItem(DEMO_STAFF_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isDemoVisitor, setIsDemoVisitor] = useState<boolean>(() => {
    try {
      localStorage.removeItem(DEMO_VISITOR_STORAGE_KEY);
      return sessionStorage.getItem(DEMO_VISITOR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const pendingNameRef = useRef<string | null>(null);

  const isBootstrappedAdmin = Boolean(
    user?.email &&
      user.email.toLowerCase() === BOOTSTRAP_STAFF_EMAIL &&
      user.emailVerified
  );

  const isStaff = Boolean(user && (isBootstrappedAdmin || hasStaffDoc));
  const isDemoMode = isDemoStaff || isDemoVisitor;
  const role: UserRole | null = user ? (isStaff ? 'staff' : 'visitor') : null;

  const ensureUserProfile = useCallback(
    async (firebaseUser: User, explicitName?: string): Promise<boolean> => {
      const userPath = `users/${firebaseUser.uid}`;
      const staffPath = `staff/${firebaseUser.uid}`;
      try {
        const staffSnap = await getDoc(doc(db, 'staff', firebaseUser.uid));
        const isAuthorizedStaff =
          staffSnap.exists() ||
          (firebaseUser.email?.toLowerCase() === BOOTSTRAP_STAFF_EMAIL &&
            firebaseUser.emailVerified);

        setHasStaffDoc(staffSnap.exists());

        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          const cleanName = (
            explicitName ||
            pendingNameRef.current ||
            firebaseUser.displayName ||
            firebaseUser.email?.split('@')[0] ||
            'Visitor'
          )
            .trim()
            .slice(0, 80);

          pendingNameRef.current = null;

          await setDoc(userRef, {
            uid: firebaseUser.uid,
            name: cleanName || 'Visitor',
            email: (firebaseUser.email || `${firebaseUser.uid}@lineless.local`).slice(0, 160),
            role: isAuthorizedStaff ? 'staff' : 'visitor',
            emailNotificationsEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        return isAuthorizedStaff;
      } catch (err) {
        if (err instanceof Error && err.message.includes('permissions')) {
          handleFirestoreError(err, OperationType.WRITE, `${userPath} / ${staffPath}`);
        }
        console.error('Failed ensuring user profile:', err);
        return (
          firebaseUser.email?.toLowerCase() === BOOTSTRAP_STAFF_EMAIL &&
          firebaseUser.emailVerified
        );
      }
    },
    []
  );

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubStaff: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubStaff) {
        unsubStaff();
        unsubStaff = null;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setHasStaffDoc(false);
        setAuthReady(true);
        return;
      }

      await ensureUserProfile(firebaseUser);

      unsubStaff = onSnapshot(
        doc(db, 'staff', firebaseUser.uid),
        (snap) => {
          setHasStaffDoc(snap.exists());
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `staff/${firebaseUser.uid}`);
        }
      );

      unsubProfile = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setProfile({
              uid: d.uid,
              name: d.name,
              email: d.email,
              role: d.role,
              emailNotificationsEnabled: Boolean(d.emailNotificationsEnabled),
              createdAt: tsToMillis(d.createdAt),
              updatedAt: tsToMillis(d.updatedAt),
            });
          }
          setAuthReady(true);
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubStaff) unsubStaff();
    };
  }, [ensureUserProfile]);

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const trimmedName = name.trim().slice(0, 80);
      if (!trimmedName) {
        throw new Error('Please enter your full name.');
      }
      setAuthBusy(true);
      setEmailProviderDisabledNotice(false);
      pendingNameRef.current = trimmedName;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: trimmedName });
        await ensureUserProfile(cred.user, trimmedName);
      } catch (err) {
        pendingNameRef.current = null;
        if (isFirebaseOperationNotAllowed(err)) {
          setEmailProviderDisabledNotice(true);
        }
        throw err;
      } finally {
        setAuthBusy(false);
      }
    },
    [ensureUserProfile]
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      setAuthBusy(true);
      setEmailProviderDisabledNotice(false);
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await ensureUserProfile(cred.user);
      } catch (err) {
        if (isFirebaseOperationNotAllowed(err)) {
          setEmailProviderDisabledNotice(true);
        }
        throw err;
      } finally {
        setAuthBusy(false);
      }
    },
    [ensureUserProfile]
  );

  const loginWithGoogle = useCallback(
    async (options?: {
      forceAccountSelect?: boolean;
      clearDemoMode?: 'staff' | 'visitor' | 'all';
    }) => {
      setAuthBusy(true);
      try {
        if (options?.forceAccountSelect) {
          googleProvider.setCustomParameters({ prompt: 'select_account' });
        } else {
          googleProvider.setCustomParameters({});
        }
        const cred = await signInWithPopup(auth, googleProvider);
        setUser(cred.user);
        const isAuthorizedStaff = await ensureUserProfile(cred.user);

        const clearTarget = options?.clearDemoMode ?? (isAuthorizedStaff ? 'all' : 'visitor');
        if (clearTarget === 'all' || (clearTarget === 'staff' && isAuthorizedStaff)) {
          setIsDemoStaff(false);
          try {
            sessionStorage.removeItem(DEMO_STAFF_STORAGE_KEY);
          } catch {
            // Ignore storage error
          }
        }
        if (clearTarget === 'all' || clearTarget === 'visitor') {
          setIsDemoVisitor(false);
          try {
            sessionStorage.removeItem(DEMO_VISITOR_STORAGE_KEY);
          } catch {
            // Ignore storage error
          }
        }

        return { user: cred.user, isAuthorizedStaff };
      } finally {
        setAuthBusy(false);
      }
    },
    [ensureUserProfile]
  );

  const logout = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (updates: { name?: string; emailNotificationsEnabled?: boolean }) => {
      if (!user) return;
      const userPath = `users/${user.uid}`;
      const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (typeof updates.name === 'string') {
        const clean = updates.name.trim().slice(0, 80);
        if (clean) {
          payload.name = clean;
          await updateProfile(user, { displayName: clean });
        }
      }
      if (typeof updates.emailNotificationsEnabled === 'boolean') {
        payload.emailNotificationsEnabled = updates.emailNotificationsEnabled;
      }
      try {
        await updateDoc(doc(db, 'users', user.uid), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    },
    [user]
  );

  const clearEmailProviderNotice = useCallback(() => {
    setEmailProviderDisabledNotice(false);
  }, []);

  const enterDemoStaffMode = useCallback(() => {
    setIsDemoStaff(true);
    try {
      sessionStorage.setItem(DEMO_STAFF_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage error
    }
  }, []);

  const exitDemoStaffMode = useCallback(() => {
    setIsDemoStaff(false);
    try {
      sessionStorage.removeItem(DEMO_STAFF_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
  }, []);

  const enterDemoVisitorMode = useCallback(() => {
    setIsDemoVisitor(true);
    try {
      sessionStorage.setItem(DEMO_VISITOR_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage error
    }
  }, []);

  const exitDemoVisitorMode = useCallback(() => {
    setIsDemoVisitor(false);
    try {
      sessionStorage.removeItem(DEMO_VISITOR_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
  }, []);

  const exitAllDemoModes = useCallback(() => {
    setIsDemoStaff(false);
    setIsDemoVisitor(false);
    try {
      sessionStorage.removeItem(DEMO_STAFF_STORAGE_KEY);
      sessionStorage.removeItem(DEMO_VISITOR_STORAGE_KEY);
      localStorage.removeItem(DEMO_STAFF_STORAGE_KEY);
      localStorage.removeItem(DEMO_VISITOR_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isStaff,
        isDemoStaff,
        isDemoVisitor,
        isDemoMode,
        authReady,
        authBusy,
        emailProviderDisabledNotice,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        updatePreferences,
        clearEmailProviderNotice,
        enterDemoStaffMode,
        exitDemoStaffMode,
        enterDemoVisitorMode,
        exitDemoVisitorMode,
        exitAllDemoModes,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
