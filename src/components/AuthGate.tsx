import React, { useState } from 'react';
import { LOGO_BASE64 } from '../assets/logo';
import { useAuth } from '../context/AuthContext';
import { ExternalLink, Shield, AlertCircle, ChevronDown } from 'lucide-react';

interface AuthGateProps {}

export const AuthGate: React.FC<AuthGateProps> = () => {
  const auth = useAuth();
  const [isIframeMenuOpen, setIsIframeMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#024884] flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-white">
      {/* Background Decorative Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-700/20 via-transparent to-transparent pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Logo & Identity */}
        <div className="flex flex-col items-center space-y-3">
          <div className="h-20 w-20 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center p-2 overflow-hidden">
            <img
              src={LOGO_BASE64}
              alt="Logo IJMA"
              className="w-full h-full object-contain scale-105"
            />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Portal Akademik I'dad Jami'iy
            </h1>
            <p className="text-xs font-semibold text-indigo-700 mt-0.5">
              Ma'had Asy-Syifa <span className="text-indigo-400 font-normal">|</span> Yayasan Asy-Syifa Nur Hidayat
            </p>
          </div>
        </div>

        {/* Welcome Text */}
        <div className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
          Selamat datang di sistem informasi akademik terpadu. Masuk dengan akun Google Anda untuk mengakses jadwal kegiatan, silabus, dan presensi halaqah.
        </div>

        {/* Error message if any */}
        {auth.authError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 text-left flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{auth.authError}</p>
              <button
                type="button"
                onClick={auth.clearAuthError}
                className="text-[11px] underline font-semibold text-rose-800 mt-1 cursor-pointer"
              >
                Tutup Pesan
              </button>
            </div>
          </div>
        )}

        {/* Action: Google Login */}
        <div className="space-y-3 pt-1">
          {!auth.isInIframe ? (
            <button
              type="button"
              onClick={() => auth.signInWithGoogle()}
              disabled={auth.isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-300 shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
              <span>{auth.isLoading ? 'Menghubungkan Google...' : 'Masuk dengan Akun Google'}</span>
            </button>
          ) : (
            /* Mode Preview Editor Iframe */
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => auth.openInFullTab()}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>Buka Tab Baru (Login Google)</span>
                </div>
                <span className="text-[10px] text-amber-300 font-semibold bg-white/10 px-2 py-0.5 rounded">
                  Disarankan
                </span>
              </button>
              <p className="text-[11px] text-slate-500 text-left px-1">
                Di dalam iframe preview AI Studio, browser membatasi popup OAuth. Membuka di tab penuh menjamin login Google 100% lancar.
              </p>

              {/* Toggle alternative preview accounts */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsIframeMenuOpen(!isIframeMenuOpen)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <span>Atau Uji Akun Terdaftar di Preview</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isIframeMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isIframeMenuOpen && (
                  <div className="mt-2 space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => auth.signInWithRegisteredAccount('mahadasysyifa1@gmail.com', 'Super Admin Asy-Syifa')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-left bg-white hover:bg-amber-50 text-slate-800 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-slate-900 text-xs">Super Admin (Asy-Syifa)</p>
                        <p className="text-[10px] text-slate-500">mahadasysyifa1@gmail.com</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        Admin
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => auth.signInWithRegisteredAccount('ammar.hazmi01@gmail.com', 'Ustadz Ammar Zulhazmi')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-left bg-white hover:bg-emerald-50 text-slate-800 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-slate-900 text-xs">Ustadz Ammar Zulhazmi</p>
                        <p className="text-[10px] text-slate-500">ammar.hazmi01@gmail.com</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Ustadz
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => auth.signInWithGoogle()}
                      className="w-full py-1 text-center text-[10px] text-slate-500 hover:text-slate-800 underline transition-colors cursor-pointer"
                    >
                      Coba Pop-up Google Langsung di Jendela Ini
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Security badge footer */}
        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Sistem Keamanan Hak Akses Terenkripsi</span>
        </div>
      </div>
    </div>
  );
};
