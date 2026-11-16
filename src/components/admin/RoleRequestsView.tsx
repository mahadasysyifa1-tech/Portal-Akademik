import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  UserCheck,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';

export interface RoleRequestItem {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  requestedRole: 'teacher' | 'student';
  requestedPersonId: string;
  requestedPersonName: string;
  requestedPersonCode?: string;
  existingTursoEmail?: string;
  requestedAt: string;
  isConflicted: boolean;
  conflictingEmails: string[];
}

interface RoleRequestsViewProps {
  onRefreshCount?: (count: number) => void;
}

export const RoleRequestsView: React.FC<RoleRequestsViewProps> = ({ onRefreshCount }) => {
  const [requests, setRequests] = useState<RoleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'conflicted'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Disputing warning popup modal state
  const [disputeModalData, setDisputeModalData] = useState<{
    item: RoleRequestItem;
  } | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/pending-requests');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil data pengajuan.');
      }
      setRequests(data.requests || []);
      if (onRefreshCount) {
        onRefreshCount(data.count || 0);
      }
    } catch (err: any) {
      console.error('Error fetching role requests:', err);
      setError(err.message || 'Gagal memuat permohonan.');
    } finally {
      setIsLoading(false);
    }
  }, [onRefreshCount]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (item: RoleRequestItem) => {
    // Safety guard: if conflicted, trigger the explanation popup modal
    if (item.isConflicted) {
      setDisputeModalData({ item });
      return;
    }

    if (
      !window.confirm(
        `Setujui akun ${item.email} sebagai ${item.requestedRole === 'teacher' ? 'Guru' : 'Santri'} (${item.requestedPersonName}) di Turso?`
      )
    ) {
      return;
    }

    setIsProcessing(item.uid);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/auth/approve-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: item.uid }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyetujui pengajuan.');
      }
      setSuccessMessage(data.message || `Berhasil menyetujui akun ${item.email}.`);
      window.dispatchEvent(
        new CustomEvent('role-request:approved', {
          detail: {
            role: data.role || item.requestedRole,
            personId: data.personId || item.requestedPersonId,
            email: data.email || item.email,
          },
        })
      );
      await fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyetujui.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (item: RoleRequestItem) => {
    if (
      !window.confirm(
        `Tolak pengajuan akun dari ${item.email} untuk figur ${item.requestedPersonName}?`
      )
    ) {
      return;
    }

    setIsProcessing(item.uid);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/auth/reject-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: item.uid }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menolak pengajuan.');
      }
      setSuccessMessage(`Pengajuan akun ${item.email} telah ditolak.`);
      await fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menolak.');
    } finally {
      setIsProcessing(null);
    }
  };

  const conflictedCount = useMemo(() => {
    return requests.filter((r) => r.isConflicted).length;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      if (filterType === 'conflicted' && !item.isConflicted) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEmail = item.email.toLowerCase().includes(q);
        const matchName = item.displayName.toLowerCase().includes(q);
        const matchPerson = item.requestedPersonName.toLowerCase().includes(q);
        return matchEmail || matchName || matchPerson;
      }
      return true;
    });
  }, [requests, filterType, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Verifikasi & Pengajuan Akun Pengguna</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {requests.length} Menunggu
            </span>
            {conflictedCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                {conflictedCount} Bersengketa
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Setujui permohonan pengguna untuk menautkan email Google mereka ke data Guru atau Santri di Turso.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchRequests}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('conflicted')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterType === 'conflicted'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Hanya Bersengketa ({conflictedCount})</span>
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari email, nama, atau figur..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table / List */}
      {isLoading ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Memuat data pengajuan akun...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-slate-800">
            {filterType === 'conflicted'
              ? 'Tidak ada pengajuan yang bersengketa'
              : 'Tidak ada pengajuan akun yang tertunda'}
          </h4>
          <p className="text-[11px] text-slate-500 mt-1">
            {filterType === 'conflicted'
              ? 'Semua pengajuan yang ada dapat disetujui tanpa konflik figur.'
              : 'Semua akun pengguna yang terdaftar telah diverifikasi atau belum mengajukan klaim peran.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Pemohon (Google)</th>
                  <th className="py-2.5 px-3">Peran Diajukan</th>
                  <th className="py-2.5 px-3">Figur di Turso</th>
                  <th className="py-2.5 px-3">Status Sengketa</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRequests.map((item) => {
                  const isBusy = isProcessing === item.uid;
                  return (
                    <tr
                      key={item.uid}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        item.isConflicted ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Pemohon */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {item.photoURL ? (
                            <img
                              src={item.photoURL}
                              alt=""
                              className="w-7 h-7 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-600">
                              {item.email.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{item.displayName}</p>
                            <p className="text-[11px] text-slate-500 font-mono truncate">{item.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Peran */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {item.requestedRole === 'teacher' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                              <ShieldCheck className="w-3 h-3" />
                              Guru (Ustadz)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                              <UserCheck className="w-3 h-3" />
                              Santri
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Figur di Turso */}
                      <td className="py-3 px-3">
                        <div>
                          <p className="font-bold text-slate-900">{item.requestedPersonName}</p>
                          <p className="text-[11px] text-slate-500">
                            ID: <span className="font-mono">{item.requestedPersonId}</span>
                            {item.requestedPersonCode && ` · ${item.requestedPersonCode}`}
                          </p>
                          {item.existingTursoEmail && (
                            <p className="text-[10px] text-amber-700 mt-0.5">
                              Email saat ini di Turso: {item.existingTursoEmail}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status Sengketa */}
                      <td className="py-3 px-3">
                        {item.isConflicted ? (
                          <div className="inline-block p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Bersengketa ({item.conflictingEmails.length + 1} pemohon)</span>
                            </div>
                            <p className="text-[10px] text-amber-700 mt-0.5 truncate max-w-[200px]" title={item.conflictingEmails.join(', ')}>
                              Juga diajukan oleh: {item.conflictingEmails.join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Tunggal (Siap Disetujui)
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApprove(item)}
                            disabled={isBusy}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                              item.isConflicted
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                            }`}
                            title={
                              item.isConflicted
                                ? 'Sengketa aktif: Klik untuk melihat detail peringatan'
                                : 'Setujui dan tautkan akun'
                            }
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Setujui</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReject(item)}
                            disabled={isBusy}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                            title="Tolak pengajuan akun ini"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disputing Warning Pop-up Modal (Safety Guard) */}
      {disputeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-amber-300">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-100 bg-amber-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900">Sengketa Klaim Akun Terdeteksi</h3>
              </div>
              <button
                type="button"
                onClick={() => setDisputeModalData(null)}
                className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                <p className="font-semibold mb-1">Figur ini diajukan oleh lebih dari 1 email:</p>
                <p className="font-bold text-slate-900 text-sm">
                  {disputeModalData.item.requestedRole === 'teacher' ? 'Ustadz' : 'Santri'}: {disputeModalData.item.requestedPersonName}
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="font-semibold text-slate-700">Daftar Pemohon yang Bersengketa:</p>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
                  <div className="font-bold text-indigo-700 flex items-center gap-1.5">
                    <span>1.</span>
                    <span>{disputeModalData.item.email}</span>
                    <span className="text-[10px] bg-indigo-100 px-1.5 py-0.2 rounded font-sans">
                      ({disputeModalData.item.displayName})
                    </span>
                  </div>
                  {disputeModalData.item.conflictingEmails.map((confEmail, idx) => (
                    <div key={confEmail} className="text-slate-700 flex items-center gap-1.5">
                      <span>{idx + 2}.</span>
                      <span>{confEmail}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800">
                <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Protokol Keamanan Admin:</span>
                </p>
                <p>
                  Sistem mencegah persetujuan langsung saat ada sengketa. Admin harus menolak (tombol <strong>Tolak</strong>) pengajuan yang salah terlebih dahulu hingga <strong>hanya tersisa 1 pengajuan</strong> untuk figur ini.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeModalData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Tutup & Kembali
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
