import React from 'react';
import { UserPlus, Edit2, School, X } from 'lucide-react';
import {
  EnrollmentClass,
  EnrollmentStudent,
  NewStudentFormData,
  NewClassFormData,
} from './EnrollmentTypes';

export interface EnrollmentModalsProps {
  classes: EnrollmentClass[];
  // Add Student Modal
  isAddStudentOpen: boolean;
  setIsAddStudentOpen: (open: boolean) => void;
  newStudentForm: NewStudentFormData;
  setNewStudentForm: React.Dispatch<React.SetStateAction<NewStudentFormData>>;
  handleCreateStudent: (e: React.FormEvent) => void;

  // Edit Student Modal
  editStudentModal: EnrollmentStudent | null;
  setEditStudentModal: (student: EnrollmentStudent | null) => void;
  handleSaveEditStudent: (e: React.FormEvent) => void;

  // Add Class Modal
  isAddClassOpen: boolean;
  setIsAddClassOpen: (open: boolean) => void;
  newClassForm: NewClassFormData;
  setNewClassForm: React.Dispatch<React.SetStateAction<NewClassFormData>>;
  handleCreateClass: (e: React.FormEvent) => void;
}

export const EnrollmentModals: React.FC<EnrollmentModalsProps> = ({
  classes,
  isAddStudentOpen,
  setIsAddStudentOpen,
  newStudentForm,
  setNewStudentForm,
  handleCreateStudent,
  editStudentModal,
  setEditStudentModal,
  handleSaveEditStudent,
  isAddClassOpen,
  setIsAddClassOpen,
  newClassForm,
  setNewClassForm,
  handleCreateClass,
}) => {
  return (
    <>
      {/* ==================================================================== */}
      {/* MODAL: TAMBAH SISWA (Client-First)                                   */}
      {/* ==================================================================== */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                Tambah Siswa Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsAddStudentOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={newStudentForm.name}
                  onChange={(e) =>
                    setNewStudentForm({ ...newStudentForm, name: e.target.value })
                  }
                  placeholder="Contoh: Muhammad Farhan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    NISN
                  </label>
                  <input
                    type="text"
                    value={newStudentForm.nisn}
                    onChange={(e) =>
                      setNewStudentForm({ ...newStudentForm, nisn: e.target.value })
                    }
                    placeholder="Contoh: 0081234567"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={newStudentForm.gender}
                    onChange={(e) =>
                      setNewStudentForm({
                        ...newStudentForm,
                        gender: e.target.value as 'L' | 'P',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={newStudentForm.phone}
                  onChange={(e) =>
                    setNewStudentForm({ ...newStudentForm, phone: e.target.value })
                  }
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Daftarkan Langsung ke Rombel
                </label>
                <select
                  value={newStudentForm.classId}
                  onChange={(e) =>
                    setNewStudentForm({ ...newStudentForm, classId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Tanpa Rombel (Tersedia) --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} Siswa)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold cursor-pointer"
                >
                  Tambah Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT SISWA (Client-First)                                     */}
      {/* ==================================================================== */}
      {editStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                Edit Data Siswa
              </h3>
              <button
                type="button"
                onClick={() => setEditStudentModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={editStudentModal.name}
                  onChange={(e) =>
                    setEditStudentModal({ ...editStudentModal, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    NISN
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.nisn}
                    onChange={(e) =>
                      setEditStudentModal({ ...editStudentModal, nisn: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={editStudentModal.gender}
                    onChange={(e) =>
                      setEditStudentModal({
                        ...editStudentModal,
                        gender: e.target.value as 'L' | 'P',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={editStudentModal.phone || ''}
                  onChange={(e) =>
                    setEditStudentModal({ ...editStudentModal, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditStudentModal(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: TAMBAH ROMBEL (Client-First)                                  */}
      {/* ==================================================================== */}
      {isAddClassOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <School className="w-4 h-4 text-indigo-600" />
                Tambah Rombel Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsAddClassOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Rombel *
                </label>
                <input
                  type="text"
                  required
                  value={newClassForm.name}
                  onChange={(e) =>
                    setNewClassForm({ ...newClassForm, name: e.target.value })
                  }
                  placeholder="Contoh: VII-A atau X-MIPA-1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Tingkat (Grade)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newClassForm.grade}
                    onChange={(e) =>
                      setNewClassForm({
                        ...newClassForm,
                        grade: Number(e.target.value) || 7,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Seksi / Section
                  </label>
                  <input
                    type="text"
                    value={newClassForm.section}
                    onChange={(e) =>
                      setNewClassForm({ ...newClassForm, section: e.target.value })
                    }
                    placeholder="Contoh: A"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold cursor-pointer"
                >
                  Buat Rombel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
