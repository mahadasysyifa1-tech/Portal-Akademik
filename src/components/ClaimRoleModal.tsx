import React, { useState, useMemo } from 'react';
import { X, UserCheck, AlertCircle, Clock, ShieldCheck, CheckCircle2, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DatabaseState } from '../types';

interface ClaimRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseState;
}

export const ClaimRoleModal: React.FC<ClaimRoleModalProps> = ({
  isOpen,
  onClose,
  db,
}) => {
  const auth = useAuth();
  const profile = auth.profile;

  const [roleType, setRoleType] = useState<'teacher' | 'student'>('teacher');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available teachers from Turso
  const teacherOptions = useMemo(() => {
    return (db.teachers || []).map((t) => ({
      id: t.id,
      name: t.name,
      code: t.display_code || t.panggilan || '',
      email: t.email,
    }));
  }, [db.teachers]);

  // Available students from Turso
  const studentOptions = useMemo(() => {
    return (db.students || []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.nisn || '',
      email: s.email,
    }));
  }, [db.students]);

  const currentOptions = roleType === 'teacher' ? teacherOptions : studentOptions;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return currentOptions;
    const q = searchQuery.toLowerCase();
    return currentOptions.filter(
      (opt) => opt.name.toLowerCase().includes(q) || (opt.code && opt.code.toLowerCase().includes(q))
    );
  }, [currentOptions, searchQuery]);

  if (!isOpen) return null;

  const isPending = profile?.requestStatus === 'pending';
  const isApproved = profile?.requestStatus === 'approved';
  const isRejected = profile?.requestStatus === 'rejected';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) {
      setStatusMessage({ type: 'error', text: 'Silakan pilih nama Anda dari daftar.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await auth.requestRole(roleType, selectedPersonId);
    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: 'Permintaan berhasil dikirim. Admin akan meninjau dan menyetujui pengajuan akun Anda.',
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Gagal mengirim pengajuan.',
      });
    }
  };

  return (
    <div className="fixed mt-80 inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Klaim Identitas Akun</h2>
              <p className="text-xs text-slate-500">Ajukan peran sebagai Guru atau Santri di Ma'had</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* User Google Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                {profile?.email?.substring(0, 2).toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{profile?.displayName || 'Pengguna'}</p>
              <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[11px] font-medium text-slate-500">Status Saat Ini:</span>
              <p className="text-xs font-semibold capitalize text-slate-700">
                {profile?.role === 'guest' ? 'Tamu (Guest)' : profile?.role}
              </p>
            </div>
          </div>

          {/* Existing Request Status Banner */}
          {isPending && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Pengajuan Sedang Menunggu Verifikasi Admin</span>
              </div>
              <p className="text-amber-700 pl-6">
                Diajukan sebagai: <strong className="font-semibold">{profile?.requestedRole === 'teacher' ? 'Guru (Ustadz)' : 'Santri'}</strong> — <strong className="font-semibold">{profile?.requestedPersonName || profile?.requestedPersonId}</strong>.
              </p>
              <p className="text-[11px] text-amber-600 pl-6">
                Anda tetap dapat mengakses portal sebagai Tamu sementara menunggu persetujuan Super Admin.
              </p>
            </div>
          )}

          {isApproved && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Akun Anda telah disetujui sebagai <strong>{profile?.teacherName || profile?.studentName}</strong>.</span>
            </div>
          )}

          {isRejected && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Pengajuan sebelumnya tidak disetujui. Silakan periksa kembali dan ajukan figur yang sesuai.</span>
            </div>
          )}

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Role Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Jenis Peran:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setRoleType('teacher');
                    setSelectedPersonId('');
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    roleType === 'teacher'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Guru (Ustadz)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRoleType('student');
                    setSelectedPersonId('');
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    roleType === 'student'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Santri</span>
                </button>
              </div>
            </div>

            {/* Person Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Nama {roleType === 'teacher' ? 'Guru' : 'Santri'} dari Data Turso:
              </label>
              
              {/* Search input if items > 5 */}
              {currentOptions.length > 5 && (
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Cari nama ${roleType === 'teacher' ? 'ustadz' : 'santri'}...`}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Pilih {roleType === 'teacher' ? 'Ustadz' : 'Santri'} --</option>
                {filteredOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} {opt.code ? `(${opt.code})` : ''} {opt.email ? `[${opt.email}]` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Pilihlah nama Anda sesuai data resmi. Admin akan memverifikasi sebelum menyetujui.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedPersonId}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'Mengirim...' : isPending ? 'Perbarui Pengajuan' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
