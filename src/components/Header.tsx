import React, { useState } from 'react';
import {
  Home,
  Calendar as CalendarIcon,
  AlertTriangle,
  BookOpen,
  Book,
  Users,
  Database,
  Menu,
  ChevronDown,
  Lock,
  Save,
  Unlock,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Layers,
  BookmarkCheck,
  CalendarDays,
  Download,
  CalendarCheck,
  Sliders,
  Table2,
  GraduationCap,
  ClipboardCheck,
  X,
  LogOut,
  LogIn,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Clock,
  UserCheck
} from 'lucide-react';
import { ScheduleConflict, DatabaseState } from '../types';
import { LOGO_BASE64 } from '../assets/logo';
import { useAuth } from '../context/AuthContext';
import { ClaimRoleModal } from './ClaimRoleModal';

export type ActiveTabType = 'home' | 'studio' | 'kaldik' | 'presensi' | 'enrollment' | 'journal' | 'syllabus' | 'subjects' | 'books' | 'teachers' | 'students' | 'conflicts' | 'database' | 'export-import' | 'rule-manager';

export type DatabaseSubTab =
  | 'classes'
  | 'teachers'
  | 'students'
  | 'rooms'
  | 'subjects'
  | 'books'
  | 'sessions'
  | 'periods'
  | 'materi'
  | 'requests';

interface HeaderProps {
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  kaldikMode: 'kaldik' | 'jurnal';
  onSelectKaldikView: (view: 'kaldik' | 'jurnal') => void;
  onSelectDatabaseSubTab?: (subTab: DatabaseSubTab) => void;
  conflicts: ScheduleConflict[];
  db?: DatabaseState;
  showRules?: boolean;
  onToggleRules?: (show: boolean) => void;
  isSaving: boolean;
  isAdmin: boolean;
  onOpenAdminLogin: () => void;
  onAdminLogout: () => void;
  isDirty: boolean;
  onSave: () => void;
  draftItems?: string[];
  onDiscardDrafts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  kaldikMode,
  onSelectKaldikView,
  onSelectDatabaseSubTab,
  conflicts,
  db,
  showRules,
  onToggleRules,
  isSaving,
  isAdmin,
  onOpenAdminLogin,
  onAdminLogout,
  isDirty,
  onSave,
  draftItems,
  onDiscardDrafts
}) => {
  const auth = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoginMenuOpen, setIsLoginMenuOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const effectiveIsAdmin = auth.isAdmin;
  const isAcademicVisible = effectiveIsAdmin || auth.isTeacher || auth.isStudent;
  const [isDraftBannerDismissed, setIsDraftBannerDismissed] = useState(false);
  const prevDraftKey = React.useRef('');
  const currentDraftKey = (draftItems || []).join('|');

  // Auto-open role claim modal when a user signs in as a guest with no pending request
  React.useEffect(() => {
    if (auth.isAuthenticated && auth.role === 'guest' && (!auth.profile?.requestStatus || auth.profile?.requestStatus === 'none')) {
      setIsClaimModalOpen(true);
    }
  }, [auth.isAuthenticated, auth.role, auth.profile?.requestStatus]);

  React.useEffect(() => {
    if (!effectiveIsAdmin) return;
    let isMounted = true;
    const checkPending = () => {
      fetch('/api/auth/pending-requests')
        .then((r) => r.json())
        .then((d) => {
          if (isMounted && d && typeof d.count === 'number') {
            setPendingRequestsCount(d.count);
          }
        })
        .catch(() => {});
    };
    checkPending();
    const interval = setInterval(checkPending, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [effectiveIsAdmin]);

  // Auto-close dropdown menu on any outside action (window scroll, resize, or Escape key)
  React.useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideAction = () => {
      setIsMenuOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleOutsideAction, { passive: true, capture: true });
    window.addEventListener('resize', handleOutsideAction, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleOutsideAction, { capture: true });
      window.removeEventListener('resize', handleOutsideAction);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);



  React.useEffect(() => {
    if (currentDraftKey !== prevDraftKey.current) {
      prevDraftKey.current = currentDraftKey;
      if (draftItems && draftItems.length > 0) {
        setIsDraftBannerDismissed(false);
      }
    }
  }, [currentDraftKey, draftItems]);

  {/* Dropdown menu icons */}
  const getMenuIcon = () => {
    switch (activeTab) {
      case 'enrollment':
        return <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      case 'journal':
        return <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-amber-600" />;
      case 'syllabus':
        return <BookmarkCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-amber-600" />;
      case 'subjects':
        return <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      case 'books':
        return <Book className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      case 'teachers':
        return <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      case 'students':
        return <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-600" />;
      case 'database':
        return <Database className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-slate-700" />;
      case 'conflicts':
        return <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-slate-600" />;
      case 'export-import':
        return <Download className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-slate-600" />;
      case 'rule-manager':
        return <Sliders className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-slate-600" />;
      default:
        return <Menu className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />;
    }
  };

  return (
    <header className="relative bg-white backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-s">
      {/* Global Draft Notification Banner */}
      {draftItems && draftItems.length > 0 && !isDraftBannerDismissed && (
        <div className="absolute top-0 left-10 right-10 z-50 rounded-b-xl bg-amber-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-between shadow-2xs border-b border-amber-600/30 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 mx-auto">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
            <span>
              Perubahan belum disimpan: <strong className="font-bold underline decoration-white/60">{draftItems.join(', ')}</strong>
            </span>
            {onDiscardDrafts && (
              <button
                type="button"
                onClick={onDiscardDrafts}
                className="ml-2.5 px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold transition-colors cursor-pointer text-[11px] shadow-2xs border border-amber-400/40"
                title="Batalkan semua draft dan kembalikan ke data server"
              >
                Buang Draft
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsDraftBannerDismissed(true)}
            className="text-white/80 hover:text-white p-0.5 rounded hover:bg-amber-600/50 transition-colors ml-2 cursor-pointer shrink-0"
            title="Tutup pemberitahuan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2 sm:py-2.5 min-h-[56px] sm:h-16 gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden relative">
              <img
                src={LOGO_BASE64}
                alt="Logo IJMA"
                className="w-9 h-9 sm:w-9 sm:h-9 md:w-11 md:h-11 max-w-none object-cover scale-110"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight truncate">
                  Portal Akademik IJMA
                </h1>
                <span className="hidden sm:inline-flex text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0 whitespace-nowrap">
                  I'dad Jami'iy Ma'had Asy-Syifa
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                Pendidikan &amp; Aktivitas Program IJMA T.A. 2026 - 2027
              </p>
            </div>
          </div>

          {/* Right Area: Conflicts alert & Admin Auth */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {conflicts.length > 0 && (
              <button
                id="header-conflict-pill"
                onClick={() => {
                  if (!isAdmin) {
                    onOpenAdminLogin();
                  } else {
                    setActiveTab('conflicts');
                  }
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors animate-pulse cursor-pointer whitespace-nowrap"
                title={isAdmin ? 'Buka Conflict Inspector' : 'Masuk admin untuk memeriksa konflik'}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="hidden sm:inline">{conflicts.length} Konflik</span>
                <span className="sm:hidden font-bold">{conflicts.length}</span>
                {!isAdmin && <Lock className="w-3 h-3 text-rose-400 shrink-0 ml-0.5" />}
              </button>
            )}

            {/* Google Authentication & Profile Dropdown */}
            {!auth.isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  id="btn-google-login"
                  onClick={() => {
                    if (!auth.isInIframe) {
                      auth.signInWithGoogle();
                    } else {
                      setIsLoginMenuOpen(!isLoginMenuOpen);
                    }
                  }}
                  disabled={auth.isLoading}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                  title="Masuk Akun"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{auth.isLoading ? 'Menghubungkan...' : 'Masuk'}</span>
                  {auth.isInIframe && (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isLoginMenuOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {/* Login Menu for Iframe Preview & Fallback */}
                {isLoginMenuOpen && auth.isInIframe && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsLoginMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800">Masuk Akun IJMA</span>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Mode Preview Editor
                        </span>
                      </div>

                      {auth.authError && (
                        <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p>{auth.authError}</p>
                            <button
                              type="button"
                              onClick={auth.clearAuthError}
                              className="text-[10px] underline text-rose-800 font-semibold mt-1 cursor-pointer"
                            >
                              Tutup Pesan
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-2.5 space-y-2">
                        {/* Option 1: Open in full tab for real Google popup without iframe sandbox */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsLoginMenuOpen(false);
                            auth.openInFullTab();
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                            <span>Buka Tab Baru (Login Google)</span>
                          </div>
                          <span className="text-[10px] text-slate-300 font-normal">Disarankan</span>
                        </button>
                        <p className="text-[10px] text-slate-400 px-1">
                          Browser memblokir pop-up Google di dalam iframe editor AI Studio. Membuka di tab penuh memastikan login Google 100% lancar.
                        </p>

                        {/* Divider */}
                        <div className="relative py-1">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-100" />
                          </div>
                          <div className="relative flex justify-center text-[10px]">
                            <span className="bg-white px-2 text-slate-400 font-medium">Atau Masuk Langsung di Editor:</span>
                          </div>
                        </div>

                        {/* Option 2: 1-click registered accounts test in preview editor */}
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsLoginMenuOpen(false);
                              auth.signInWithRegisteredAccount('mahadasysyifa1@gmail.com', 'Super Admin Asy-Syifa');
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-800 hover:bg-amber-50/70 hover:text-amber-900 rounded-lg transition-colors cursor-pointer text-left font-medium border border-slate-100"
                          >
                            <div>
                              <p className="font-bold text-[11px] text-slate-900">Super Admin (Asy-Syifa)</p>
                              <p className="text-[10px] text-slate-500">mahadasysyifa1@gmail.com</p>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Admin
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsLoginMenuOpen(false);
                              auth.signInWithRegisteredAccount('ammar.hazmi01@gmail.com', 'Ustadz Ammar Zulhazmi');
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-800 hover:bg-emerald-50/70 hover:text-emerald-900 rounded-lg transition-colors cursor-pointer text-left font-medium border border-slate-100"
                          >
                            <div>
                              <p className="font-bold text-[11px] text-slate-900">Ustadz Ammar Zulhazmi</p>
                              <p className="text-[10px] text-slate-500">ammar.hazmi01@gmail.com</p>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Ustadz
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsLoginMenuOpen(false);
                              auth.signInWithRegisteredAccount('www.soenniy@gmail.com', 'Ustadz Soenniy');
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-800 hover:bg-emerald-50/70 hover:text-emerald-900 rounded-lg transition-colors cursor-pointer text-left font-medium border border-slate-100"
                          >
                            <div>
                              <p className="font-bold text-[11px] text-slate-900">Ustadz Soenniy</p>
                              <p className="text-[10px] text-slate-500">www.soenniy@gmail.com</p>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Ustadz
                            </span>
                          </button>
                        </div>

                        {/* Option 3: Direct popup retry */}
                        <div className="pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setIsLoginMenuOpen(false);
                              auth.signInWithGoogle();
                            }}
                            className="w-full py-1 text-center text-[10px] text-slate-500 hover:text-slate-800 underline transition-colors cursor-pointer"
                          >
                            Coba Pop-up Google Langsung di Jendela Ini
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (

              <div className="relative">
                <button
                  type="button"
                  id="btn-user-profile"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="relative flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
                >
                  {effectiveIsAdmin && pendingRequestsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                      {pendingRequestsCount}
                    </span>
                  )}
                  {auth.user?.photoURL ? (
                    <img
                      src={auth.user.photoURL}
                      alt={auth.profile?.displayName || 'User'}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px] ring-1 ring-slate-200">
                      {(auth.profile?.displayName || auth.user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:inline font-semibold text-slate-800 max-w-[100px] lg:max-w-[130px] truncate">
                    {auth.profile?.displayName || auth.user?.displayName || 'Pengguna'}
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      auth.role === 'admin'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : auth.role === 'teacher'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : auth.role === 'student'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                        : 'bg-slate-100 text-slate-600 border border-slate-300'
                    }`}
                  >
                    {auth.role === 'admin' ? 'Admin' : auth.role === 'teacher' ? 'Ustadz' : auth.role === 'student' ? 'Santri' : 'Tamu'}
                  </span>
                </button>

                {isProfileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                        {auth.user?.photoURL ? (
                          <img src={auth.user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm">
                            {(auth.profile?.displayName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {auth.profile?.displayName || auth.user?.displayName || 'Pengguna'}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{auth.user?.email}</p>
                        </div>
                      </div>

                      <div className="py-2.5 text-[11px] text-slate-600 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Hak Akses:</span>
                          <span className="font-bold text-slate-800 capitalize">{auth.role}</span>
                        </div>
                        {auth.profile?.teacherName && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Guru Terkait:</span>
                            <span className="font-semibold text-emerald-700 truncate max-w-[130px]">{auth.profile.teacherName}</span>
                          </div>
                        )}
                        {auth.profile?.studentName && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Santri Terkait:</span>
                            <span className="font-semibold text-indigo-700 truncate max-w-[130px]">{auth.profile.studentName}</span>
                          </div>
                        )}
                      </div>

                      {/* Guest Role Claim Option */}
                      {auth.role === 'guest' && (
                        <div className="py-2 border-t border-slate-100">
                          {auth.profile?.requestStatus === 'pending' ? (
                            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Menunggu Verifikasi Admin</span>
                              </div>
                              <p className="text-[11px] text-amber-700">
                                Diajukan: <strong className="font-semibold">{auth.profile.requestedRole === 'teacher' ? 'Ustadz' : 'Santri'}</strong> ({auth.profile.requestedPersonName || auth.profile.requestedPersonId})
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsProfileOpen(false);
                                  setIsClaimModalOpen(true);
                                }}
                                className="mt-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                              >
                                Ubah Pilihan Pengajuan
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setIsProfileOpen(false);
                                setIsClaimModalOpen(true);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Klaim Akun Guru / Santri</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Admin Pending Requests Quick Link */}
                      {effectiveIsAdmin && (
                        <div className="py-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileOpen(false);
                              setActiveTab('database');
                              onSelectDatabaseSubTab?.('requests');
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70 rounded-xl transition-colors cursor-pointer text-left font-semibold border border-indigo-100"
                          >
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Persetujuan Akun</span>
                            </div>
                            {pendingRequestsCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                                {pendingRequestsCount}
                              </span>
                            )}
                          </button>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            auth.signOutUser();
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Keluar (Sign Out)</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Bar: Main "Jadwal" + Hidden Menus */}
        <div className="flex items-center justify-between border-t border-slate-100 py-1.5 gap-2">
          <div className="flex items-center space-x-1 sm:space-x-1.5">
            {/* Primary Tab: Beranda */}
            <button
              id="tab-btn-home"
              type="button"
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'home'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>
                {activeTab === 'home' ? 'Beranda' : ''}
              </span>
            </button>

            {/* Primary Tab: Jadwal (Studio) */}
            <button
              id="tab-btn-studio"
              type="button"
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'studio'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Table2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>
                {activeTab === 'studio' ? 'Jadwal' : ''}
              </span>
            </button>

            {/* Primary Tab: Kaldik (Moved to main header next to Jadwal) */}
            <button
              id="tab-btn-kaldik"
              type="button"
              onClick={() => onSelectKaldikView('kaldik')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'kaldik' && kaldikMode === 'kaldik'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>
                {activeTab === 'kaldik' && kaldikMode === 'kaldik' ? 'Kaldik' : ''}
              </span>
            </button>

            {/* Primary Tab: Jurnal (KaldikView.tsx in Jurnal mode) - Student, Teacher & Admin */}
            {isAcademicVisible && (
              <button
                id="tab-btn-journal"
                type="button"
                onClick={() => onSelectKaldikView('jurnal')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'kaldik' && kaldikMode === 'jurnal'
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>
                  {activeTab === 'kaldik' && kaldikMode === 'jurnal' ? 'Jurnal' : ''}
                </span>
              </button>
            )}

            {/* Dropdown Menu for other sections */}
            <div className="relative">
              <button
                type="button"
                id="header-menu-toggle-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab !== 'studio' && activeTab !== 'home' && activeTab !== 'kaldik' && activeTab !== 'journal' && activeTab !== 'presensi'
                    ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
                }`}
              >
                {getMenuIcon()}
                <span className="truncate max-w-[110px] sm:max-w-none">
                  {activeTab === 'books'
                    ? 'Buku'
                    : activeTab === 'teachers'
                    ? 'Pengajar'
                    : isAcademicVisible && activeTab === 'enrollment'
                    ? 'Daftar Kelas'
                    : isAcademicVisible && activeTab === 'syllabus'
                    ? 'Silabus'
                    : isAcademicVisible && activeTab === 'subjects'
                    ? 'Pelajaran'
                    : isAcademicVisible && activeTab === 'students'
                    ? 'Santri'
                    : effectiveIsAdmin && activeTab === 'database'
                    ? 'Database'
                    : effectiveIsAdmin && activeTab === 'conflicts'
                    ? 'Conflict'
                    : effectiveIsAdmin && activeTab === 'export-import'
                    ? 'Distribution'
                    : effectiveIsAdmin && activeTab === 'rule-manager'
                    ? 'Rule Manager'
                    : ''}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown items */}
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Academic directories: Student, Teacher & Admin */}
                    {isAcademicVisible && (
                      <>
                        <button
                          type="button"
                          id="menu-item-enrollment"
                          onClick={() => {
                            setActiveTab('enrollment');
                            setIsMenuOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'enrollment' ? 'text-amber-600 bg-amber-50/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <Users className="w-4 h-4 text-amber-600" />
                          <span>Daftar Kelas</span>
                        </button>

                        <button
                          type="button"
                          id="menu-item-syllabus"
                          onClick={() => {
                            setActiveTab('syllabus');
                            setIsMenuOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'syllabus' ? 'text-amber-600 bg-amber-50/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <BookmarkCheck className="w-4 h-4 text-amber-600" />
                          <span>Silabus</span>
                        </button>

                        <button
                          type="button"
                          id="menu-item-subjects"
                          onClick={() => {
                            setActiveTab('subjects');
                            setIsMenuOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'subjects' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                          }`}
                        >
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                          <span>Pelajaran</span>
                        </button>
                      </>
                    )}

                    {/* Available for everyone logged in (Buku & Pengajar) */}
                    <button
                      type="button"
                      id="menu-item-books"
                      onClick={() => {
                        setActiveTab('books');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'books' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                      }`}
                    >
                      <Book className="w-4 h-4 text-indigo-600" />
                      <span>Buku</span>
                    </button>

                    <button
                      type="button"
                      id="menu-item-teachers"
                      onClick={() => {
                        setActiveTab('teachers');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                        activeTab === 'teachers' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                      }`}
                    >
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>Pengajar</span>
                    </button>

                    {/* Santri Directory: Student, Teacher & Admin */}
                    {isAcademicVisible && (
                      <button
                        type="button"
                        id="menu-item-students"
                        onClick={() => {
                          setActiveTab('students');
                          setIsMenuOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                          activeTab === 'students' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-700'
                        }`}
                      >
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                        <span>Santri</span>
                      </button>
                    )}

                    {/* Admin-only system management options */}
                    {effectiveIsAdmin && (
                      <>
                        <div className="h-px bg-slate-100 my-1" />

                        <button
                          type="button"
                          id="tab-btn-rule-manager"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActiveTab('rule-manager');
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'rule-manager' ? 'text-black bg-slate-50/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-slate-400" />
                            <span>Rule Manager</span>
                          </div>
                          <Unlock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        </button>

                        <button
                          type="button"
                          id="tab-btn-database"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActiveTab('database');
                          }}
                          className={`w-full px-3.5 py-1.5 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'database' ? 'text-black bg-slate-50/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-slate-400" />
                            <span>Database</span>
                            {pendingRequestsCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                                {pendingRequestsCount}
                              </span>
                            )}
                          </div>
                          <Unlock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        </button>

                        <button
                          type="button"
                          id="tab-btn-conflicts"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActiveTab('conflicts');
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'conflicts' ? 'text-black bg-slate-50/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-slate-400" />
                            <span>Conflict</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {conflicts.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-600 text-white font-bold">
                                {conflicts.length}
                              </span>
                            )}
                            <Unlock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          </div>
                        </button>

                        <button
                          type="button"
                          id="tab-btn-export-import"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActiveTab('export-import');
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'export-import' ? 'text-black bg-slate-50/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Download className="w-4 h-4 text-slate-400" />
                            <span>Distribusi</span>
                          </div>
                          <Unlock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Right Status & Actions: Accessible whenever a draft exists (edits are gated at their origin) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {(isDirty || isSaving) && (
              <button
                type="button"
                id="header-save-btn"
                onClick={onSave}
                disabled={isSaving || !isDirty}
                title={isDirty ? 'Ada perubahan yang belum disimpan ke Turso' : 'Semua perubahan sudah tersimpan'}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl border transition-colors whitespace-nowrap ${
                  isDirty
                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 cursor-pointer shadow-xs'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                } disabled:opacity-80`}
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isDirty ? (
                  <Save className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span className="hidden sm:inline">{isSaving ? 'Menyimpan...' : isDirty ? 'Simpan Perubahan' : 'Tersimpan'}</span>
              </button>
            )}
          </div>

        </div>
      </div>

      <ClaimRoleModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        db={db || ({ teachers: [], students: [] } as any)}
      />
    </header>
  );
};
