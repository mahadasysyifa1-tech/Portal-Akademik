import React, { useState, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface DisplayCodeBadgeProps {
  value?: string;
  canEdit?: boolean;
  onStageChange?: (nextValue: string) => void;
}

export const DisplayCodeBadge: React.FC<DisplayCodeBadgeProps> = ({
  value = '',
  canEdit = false,
  onStageChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  const trimmedValue = (value || '').trim();

  if (isEditing && canEdit) {
    const commit = () => {
      const next = draft.trim();
      setIsEditing(false);
      if (next !== trimmedValue) {
        onStageChange?.(next);
      }
    };

    const cancel = () => {
      setDraft(value);
      setIsEditing(false);
    };

    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          placeholder="Kode..."
          maxLength={24}
          autoFocus
          aria-label="Edit kode tampilan"
          className="w-24 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-900 bg-white border border-indigo-400 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button
          type="button"
          onClick={commit}
          title="Terapkan ke draft (klik Simpan Perubahan di header)"
          className="p-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={cancel}
          title="Batal"
          className="p-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  }

  if (!trimmedValue && !canEdit) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {trimmedValue ? (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {trimmedValue}
        </span>
      ) : null}
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(value);
            setIsEditing(true);
          }}
          title={trimmedValue ? 'Ubah kode tampilan' : 'Tambah kode tampilan'}
          className={
            trimmedValue
              ? 'p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer'
              : 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-300 transition-colors cursor-pointer'
          }
        >
          <Pencil className="w-3.5 h-3.5" />
          {!trimmedValue && <span>Kode</span>}
        </button>
      )}
    </span>
  );
};
