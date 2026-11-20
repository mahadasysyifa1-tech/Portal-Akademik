import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Link2, Trash2, Image as ImageIcon, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  DirectoryEntityType,
  DirectoryMediaItem,
  isValidImageUrlInput,
  removeDirectoryPicture,
  saveDirectoryPicture,
} from '../../utils/directoryMedia';
import { auth } from '../../firebase';

interface PictureUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: DirectoryEntityType;
  entityId: string;
  entityName: string;
  currentMedia?: DirectoryMediaItem;
  aspectHint?: 'square' | 'portrait' | 'landscape';
}

export const PictureUploadModal: React.FC<PictureUploadModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  currentMedia,
  aspectHint = 'square',
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>(currentMedia?.sourceType === 'url' ? currentMedia.imageUrl : '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedFile(null);
    setPreviewObjectUrl('');
    setUrlInput(currentMedia?.sourceType === 'url' ? currentMedia.imageUrl : '');
    setMode(currentMedia?.sourceType === 'url' ? 'url' : 'upload');
  }, [isOpen, currentMedia]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFirebaseSignedIn = Boolean(auth.currentUser && auth.currentUser.emailVerified);
  const previewSrc =
    mode === 'upload'
      ? previewObjectUrl || currentMedia?.imageUrl || ''
      : urlInput.trim() || currentMedia?.imageUrl || '';

  const previewAspectClass =
    aspectHint === 'portrait'
      ? 'w-24 h-32 rounded-xl'
      : aspectHint === 'landscape'
      ? 'w-32 h-24 rounded-xl'
      : 'w-24 h-24 rounded-2xl';

  const handleFilePick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Pilih file gambar yang valid (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 10 MB sebelum kompresi.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    setSelectedFile(file);
    setPreviewObjectUrl(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === 'upload' && !selectedFile) {
      setErrorMsg('Silakan pilih file gambar terlebih dahulu.');
      return;
    }
    if (mode === 'url' && !isValidImageUrlInput(urlInput)) {
      setErrorMsg('Masukkan URL gambar http:// atau https:// yang valid.');
      return;
    }

    setIsSaving(true);
    try {
      await saveDirectoryPicture({
        entityType,
        entityId,
        file: mode === 'upload' ? selectedFile || undefined : undefined,
        url: mode === 'url' ? urlInput.trim() : undefined,
        previousStoragePath: currentMedia?.storagePath,
      });
      setSuccessMsg('Gambar berhasil disimpan ke Firebase Cloud.');
      setTimeout(() => {
        onClose();
      }, 450);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan gambar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!currentMedia) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await removeDirectoryPicture({
        entityType,
        entityId,
        storagePath: currentMedia.storagePath,
      });
      setSuccessMsg('Gambar berhasil dihapus.');
      setTimeout(() => {
        onClose();
      }, 350);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menghapus gambar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">Foto / Gambar Direktori</h3>
            <p className="text-xs text-slate-500 truncate">{entityName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {!isFirebaseSignedIn && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              Untuk menyimpan gambar ke Firebase Cloud, pastikan Anda masuk menggunakan <strong>Google Sign-In</strong> yang terverifikasi.
            </div>
          )}

          {/* Live Preview */}
          <div className="flex items-center gap-4">
            <div
              className={`${previewAspectClass} border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0`}
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={entityName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-7 h-7 text-slate-300" />
              )}
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Pratinjau Tampilan</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Gambar otomatis dikompresi agar hemat kuota dan cepat dimuat di semua perangkat.
              </p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setMode('upload');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'upload' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('url');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'url' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Tempel URL</span>
            </button>
          </div>

          {mode === 'upload' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => handleFilePick(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-5 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors flex flex-col items-center justify-center gap-1.5 text-xs text-slate-600 cursor-pointer"
              >
                <Upload className="w-5 h-5 text-indigo-600" />
                <span className="font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Pilih foto atau sampul dari perangkat'}
                </span>
                <span className="text-[11px] text-slate-400">JPG, PNG, atau WebP (maks. 10 MB)</span>
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">URL Gambar Langsung</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://contoh.id/gambar.jpg"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 font-mono"
              />
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            {currentMedia ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving || (mode === 'upload' ? !selectedFile : !urlInput.trim())}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Gambar'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
