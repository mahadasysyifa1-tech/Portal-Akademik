import React from 'react';
import { School, Plus, Search, X, Check, ChevronRight } from 'lucide-react';
import { EnrollmentClass } from './EnrollmentTypes';

export interface EnrollmentClassListProps {
  classes: EnrollmentClass[];
  displayClasses: EnrollmentClass[];
  selectedClassId: string;
  activeClass?: EnrollmentClass;
  selectedPerson: { type: 'teacher' | 'student'; id: string } | null;
  activePersonObj: { name: string; type: string } | null;
  personRelatedClasses: EnrollmentClass[];
  personRelatedClassesCount: number;
  classSearch: string;
  setClassSearch: (q: string) => void;
  isClassRelatedToPerson: (classId: string) => boolean;
  handleClassClick: (classId: string) => void;
  handleClearClassSelection: () => void;
  handleClearPersonSelection: () => void;
  handleToggleClassForActivePerson: (classId: string, isRelated: boolean) => void;
  isAdmin: boolean;
  onOpenAddClass: () => void;
}

export const EnrollmentClassList: React.FC<EnrollmentClassListProps> = ({
  classes,
  displayClasses,
  selectedClassId,
  activeClass,
  selectedPerson,
  activePersonObj,
  personRelatedClasses,
  personRelatedClassesCount,
  classSearch,
  setClassSearch,
  isClassRelatedToPerson,
  handleClassClick,
  handleClearClassSelection,
  handleClearPersonSelection,
  handleToggleClassForActivePerson,
  isAdmin,
  onOpenAddClass,
}) => {
  return (
    <div
      className={`lg:col-span-5 xl:col-span-4 rounded-xl border shadow-xs flex flex-col overflow-hidden transition-all duration-200 ${
        selectedClassId
          ? 'border-indigo-400 ring-2 ring-indigo-200/60 bg-indigo-50/10'
          : 'border-slate-200 bg-white'
      }`}
    >
      {/* Div 1 Minimal Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <School className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="font-semibold text-sm text-slate-800 tracking-tight">Rombel</span>
          <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md">
            {classes.length}
          </span>
        </div>

        {/* Selection Status Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          {selectedClassId && activeClass && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full max-w-[150px] truncate">
              <span className="truncate">Terpilih: {activeClass.name}</span>
              <button
                type="button"
                onClick={handleClearClassSelection}
                title="Tampilkan semua rombel"
                className="hover:text-red-600 ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {selectedPerson && activePersonObj && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-200 rounded-full max-w-[220px] truncate">
              <span className="truncate">
                {personRelatedClassesCount} Rombel: {personRelatedClasses.map((c) => c.name).join(', ')}
              </span>
              <button
                type="button"
                onClick={handleClearPersonSelection}
                title="Hapus filter person"
                className="hover:text-red-600 ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAddClass}
              title="Tambah Rombel Baru"
              className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-white rounded transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Div 1 Minimal Filter */}
      <div className="p-2 flex-shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={classSearch}
            onChange={(e) => setClassSearch(e.target.value)}
            placeholder="Cari rombel / tingkat..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
          />
          {classSearch && (
            <button
              type="button"
              onClick={() => setClassSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Div 1 Class List Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {displayClasses.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Tidak ada rombel yang cocok.
          </div>
        ) : (
          displayClasses.map((cls) => {
            const isSelected = selectedClassId === cls.id;
            const isPersonRelated = selectedPerson ? isClassRelatedToPerson(cls.id) : false;

            // Dimming logic
            const isDimmed =
              (selectedClassId && !isSelected) ||
              (selectedPerson && !isPersonRelated);

            return (
              <div
                key={cls.id}
                onClick={() => handleClassClick(cls.id)}
                className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 ring-1 ring-indigo-400 shadow-xs font-semibold opacity-100'
                    : isPersonRelated
                    ? 'bg-indigo-50/40 border-indigo-300 text-indigo-950 shadow-xs font-medium opacity-100'
                    : isDimmed
                    ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                    : 'bg-white border-slate-100 text-slate-800 hover:border-indigo-200 hover:bg-slate-50/80 opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Checkbox: ONLY shown when in Person Focus mode */}
                  {selectedPerson ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleClassForActivePerson(cls.id, isPersonRelated);
                      }}
                      title={isPersonRelated ? 'Keluarkan dari rombel ini' : 'Hubungkan ke rombel ini'}
                      className={`w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 cursor-pointer ${
                        isPersonRelated
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </button>
                  ) : (
                    <div
                      className={`w-2 h-7 rounded-full flex-shrink-0 ${
                        isSelected ? 'bg-indigo-600' : cls.color || 'bg-slate-300'
                      }`}
                    />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs leading-none truncate ${isSelected ? 'font-bold' : 'font-semibold'}`}>
                        {cls.name}
                      </span>
                      {cls.grade && (
                        <span className="text-[10px] text-slate-400">
                          Tingkat {cls.grade}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {cls.studentCount} Siswa terdaftar
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {isSelected && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-200/80 text-indigo-900 rounded">
                      Aktif
                    </span>
                  )}
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-400'
                    }`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Div 1 Bottom Footer Status */}
      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between flex-shrink-0">
        <span>
          {selectedPerson && activePersonObj
            ? `${personRelatedClassesCount} dari ${classes.length} rombel terhubung dengan ${activePersonObj.name}`
            : selectedClassId
            ? 'Klik rombel aktif untuk batal pilih'
            : 'Pilih rombel untuk kelola anggotanya'}
        </span>
        {selectedClassId && (
          <button
            type="button"
            onClick={handleClearClassSelection}
            className="text-indigo-600 hover:underline font-medium cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
