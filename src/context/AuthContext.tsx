import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export type UserRole = 'admin' | 'teacher' | 'student' | 'guest';

export interface AppUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  teacherId?: string;
  studentId?: string;
  classId?: string;
  teacherName?: string;
  studentName?: string;
  requestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  requestedRole?: 'teacher' | 'student';
  requestedPersonId?: string;
  requestedPersonName?: string;
  requestedAt?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: AppUserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  teacherId?: string;
  studentId?: string;
  classId?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  isInIframe: boolean;
  openInFullTab: () => void;
  signInWithGoogle: () => void;
  signInWithRegisteredAccount: (email: string, displayName?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canEditSession: (sessionTeacherId?: string) => boolean;
  requestRole: (requestedRole: 'teacher' | 'student', requestedPersonId: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const openInFullTab = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  }, []);

  const syncProfileWithTurso = useCallback(
    async (userData: { uid: string; email: string | null; displayName: string | null; photoURL?: string | null }): Promise<AppUserProfile | null> => {
      if (!userData.email) return null;
      try {
        const response = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
          }),
        });

        if (!response.ok) {
          throw new Error(`Sync request failed with status ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.profile) {
          setProfile(result.profile);
          setAuthError(null);
          return result.profile;
        }
      } catch (err: any) {
        console.error('❌ [AuthContext] Error syncing user with Turso:', err?.message);
        setAuthError(err?.message || 'Gagal menghubungkan profil akun.');
      }
      return null;
    },
    []
  );

  useEffect(() => {
    // 1. Listen for Firebase Auth changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        await syncProfileWithTurso({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
        });
      } else {
        // If no Firebase user, check if there is an active saved preview user
        try {
          const savedPreview = localStorage.getItem('ijma_active_preview_user');
          if (savedPreview) {
            const parsed = JSON.parse(savedPreview);
            if (parsed.email) {
              await syncProfileWithTurso({
                uid: `turso-${parsed.email.replace(/[^a-zA-Z0-9]/g, '_')}`,
                email: parsed.email,
                displayName: parsed.displayName,
              });
            }
          }
        } catch {}
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [syncProfileWithTurso]);

  // Synchronous user-gesture trigger for signInWithPopup
  const signInWithGoogle = useCallback(() => {
    setAuthError(null);
    setIsLoading(true);

    // Call signInWithPopup synchronously on user click to preserve browser gesture context
    signInWithPopup(auth, googleProvider)
      .then(async (cred) => {
        if (cred.user && cred.user.email) {
          setUser(cred.user);
          await syncProfileWithTurso({
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName,
            photoURL: cred.user.photoURL,
          });
        }
      })
      .catch((error: any) => {
        if (error?.code === 'auth/popup-closed-by-user') {
          // User cancelled the popup manually
          console.log('Google popup closed by user.');
        } else if (error?.code === 'auth/unauthorized-domain') {
          console.error('Firebase unauthorized domain error:', error);
          setAuthError(
            'Domain aplikasi belum diizinkan di Firebase Console. Gunakan tombol "Buka Tab Baru" atau opsi masuk langsung di bawah.'
          );
        } else {
          console.error('Google Sign-In Error:', error);
          setAuthError(error?.message || 'Terjadi kendala saat menghubungkan akun Google.');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [syncProfileWithTurso]);

  // Direct authentication for registered Turso accounts (especially reliable inside iframe preview)
  const signInWithRegisteredAccount = useCallback(
    async (email: string, displayName?: string) => {
      setAuthError(null);
      setIsLoading(true);
      try {
        const profileResult = await syncProfileWithTurso({
          uid: `turso-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email,
          displayName: displayName || email.split('@')[0],
        });
        if (profileResult) {
          try {
            localStorage.setItem('ijma_active_preview_user', JSON.stringify({ email, displayName }));
          } catch {}
        }
      } catch (err: any) {
        console.error('Error signing in with registered account:', err);
        setAuthError('Gagal memuat profil akun.');
      } finally {
        setIsLoading(false);
      }
    },
    [syncProfileWithTurso]
  );

  const signOutUser = async () => {
    try {
      setIsLoading(true);
      try {
        localStorage.removeItem('ijma_active_preview_user');
      } catch {}
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      setAuthError(null);
    } catch (error) {
      console.error('Sign-Out Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (profile?.email) {
      await syncProfileWithTurso({
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
      });
    }
  };

  const requestRole = useCallback(
    async (requestedRole: 'teacher' | 'student', requestedPersonId: string): Promise<{ success: boolean; error?: string }> => {
      if (!profile?.uid) {
        return { success: false, error: 'Silakan masuk terlebih dahulu.' };
      }
      try {
        const res = await fetch('/api/auth/request-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: profile.uid,
            requestedRole,
            requestedPersonId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Gagal mengajukan peran.');
        }
        if (data.profile) {
          setProfile(data.profile);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Terjadi kesalahan saat mengajukan peran.' };
      }
    },
    [profile?.uid]
  );

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const role: UserRole = profile?.role || 'guest';
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const teacherId = profile?.teacherId;
  const studentId = profile?.studentId;
  const classId = profile?.classId;
  const isAuthenticated = Boolean(profile);

  // RBAC Permission Evaluator:
  // Admin can edit everything. Teacher can only edit if their teacherId matches session's teacher.
  // Guests and students cannot edit (read-only 'ya (ro)').
  const canEditSession = useCallback(
    (sessionTeacherId?: string): boolean => {
      if (isAdmin) return true;
      if (isTeacher && teacherId && sessionTeacherId && String(teacherId) === String(sessionTeacherId)) {
        return true;
      }
      return false;
    },
    [isAdmin, isTeacher, teacherId]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isAdmin,
        isTeacher,
        isStudent,
        teacherId,
        studentId,
        classId,
        isAuthenticated,
        isLoading,
        authError,
        clearAuthError,
        isInIframe,
        openInFullTab,
        signInWithGoogle,
        signInWithRegisteredAccount,
        signOutUser,
        refreshProfile,
        canEditSession,
        requestRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
