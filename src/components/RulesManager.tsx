import React, { useState, useMemo } from 'react';
import {
  DatabaseState,
  ScheduleRule,
  Subject,
  ScheduleConflict
} from '../types';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Zap,
  Calendar,
  Clock,
  Users,
  DoorOpen,
  GraduationCap,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Repeat,
  Lock,
  Unlock
} from 'lucide-react';

interface RulesManagerProps {
  db: DatabaseState;
  conflicts: ScheduleConflict[];
  onOpenNewRule: (prefillSubjectId?: string) => void;
  onEditRule: (rule: ScheduleRule) => void;
  onDuplicateRule: (rule: ScheduleRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onToggleRuleActive: (ruleId: string, active: boolean) => void;
  onToggleSubjectRulesActive: (subjectId: string, active: boolean) => void;
  isAdmin?: boolean;
  onOpenAdminLogin?: () => void;
}

export const RulesManager: React.FC<RulesManagerProps> = ({
  db,
  conflicts,
  onOpenNewRule,
  onEditRule,
  onDuplicateRule,
  onDeleteRule,
  onToggleRuleActive,
  onToggleSubjectRulesActive,
  isAdmin = false,
  onOpenAdminLogin
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWithExceptionsOnly, setFilterWithExceptionsOnly] = useState(false);
  const [collapsedSubjectIds, setCollapsedSubjectIds] = useState<Record<string, boolean>>({});

  // Helper maps
  const classMap = useMemo(() => new Map(db.classes.map((c) => [c.id, c])), [db.classes]);
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const sessionMap = useMemo(() => new Map(db.sessions.map((s) => [s.id, s])), [db.sessions]);
  const periodMap = useMemo(() => new Map(db.periods.map((p) => [p.id, p])), [db.periods]);

  // Group rules by Subject
  const subjectGroups = useMemo(() => {
    return db.subjects.map((subject) => {
      const subjectRules = db.rules.filter((rule) => rule.subjectId === subject.id);
      const filteredRules = subjectRules.filter((rule) => {
        if (filterWithExceptionsOnly && rule.exceptions.length === 0) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchSubject = subject.name.toLowerCase().includes(q) || subject.code.toLowerCase().includes(q);
          const className = classMap.get(rule.classId)?.name.toLowerCase() || '';
          const teacherName = teacherMap.get(rule.teacherId)?.name.toLowerCase() || '';
          const roomName = roomMap.get(rule.roomId)?.name.toLowerCase() || '';
          const ruleDays = (rule.daysOfWeek && rule.daysOfWeek.length > 0) ? rule.daysOfWeek : [rule.dayOfWeek || 'Monday'];
          const daysMatch = ruleDays.some((d) => d.toLowerCase().includes(q));
          const notes = rule.notes?.toLowerCase() || '';

          return (
            matchSubject ||
            className.includes(q) ||
            teacherName.includes(q) ||
            roomName.includes(q) ||
            daysMatch ||
            notes.includes(q)
          );
        }

        return true;
      });

      const totalPeriodsScheduled = subjectRules
        .filter((r) => r.active)
        .reduce((sum, r) => sum + r.periodIds.length, 0);

      const allActive = subjectRules.length > 0 && subjectRules.every((r) => r.active);
      const someActive = subjectRules.some((r) => r.active);

      return {
        subject,
        allRules: subjectRules,
        displayRules: filteredRules,
        totalPeriodsScheduled,
        allActive,
        someActive
      };
    });
  }, [db.subjects, db.rules, searchQuery, filterWithExceptionsOnly, classMap, teacherMap, roomMap]);

  const toggleSubjectCollapse = (subjectId: string) => {
    setCollapsedSubjectIds((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }));
  };

  const expandAll = () => setCollapsedSubjectIds({});
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    db.subjects.forEach((s) => (allCollapsed[s.id] = true));
    setCollapsedSubjectIds(allCollapsed);
  };

  const guardAdminAction = (callback: () => void) => {
    if (!isAdmin) {
      if (onOpenAdminLogin) onOpenAdminLogin();
      return;
    }
    callback();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Admin lock status banner */}
      {!isAdmin ? (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Mode Pengamat:</strong> Penambahan atau perubahan aturan dikunci untuk administrator.
            </span>
          </div>
          {onOpenAdminLogin && (
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="px-2.5 py-1 bg-amber-600 text-white hover:bg-amber-700 font-bold rounded-xl shrink-0 transition-colors shadow-2xs"
            >
              Buka Kunci
            </button>
          )}
        </div>
      ) : (
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-2.5 px-3 flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <Unlock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Mode Administrator Aktif — Anda dapat mengedit dan menambah aturan</span>
          </div>
        </div>
      )}

      {/* Top Controls & Explanation Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Manajer Aturan Jadwal & Pengecualian</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aturan dikelompokkan berdasarkan Mata Pelajaran. Kelola perulangan, ruangan, dan pengecualian khusus.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="rules-expand-all"
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Buka Semua
            </button>
            <button
              id="rules-collapse-all"
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Tutup Semua
            </button>

            {/* Add Schedule Rule Button (inside Rule Panel only, as requested!) */}
            <button
              id="rules-create-new-btn"
              type="button"
              onClick={() => guardAdminAction(() => onOpenNewRule())}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs ${
                isAdmin
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isAdmin ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
              <span>Tambah Aturan</span>
            </button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-rules-input"
              type="text"
              placeholder="Cari mata pelajaran, guru, kelas, hari, ruangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                id="filter-exceptions-checkbox"
                type="checkbox"
                checked={filterWithExceptionsOnly}
                onChange={(e) => setFilterWithExceptionsOnly(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Hanya yang Punya Pengecualian</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Subject Rule Groups */}
      <div className="space-y-3">
        {subjectGroups.map(({ subject, allRules, displayRules, totalPeriodsScheduled, allActive, someActive }) => {
          if (displayRules.length === 0 && searchQuery) return null;

          const isCollapsed = Boolean(collapsedSubjectIds[subject.id]);
          const hasExceptions = allRules.some((r) => r.exceptions.length > 0);

          return (
            <div
              key={subject.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
            >
              {/* Condensed Subject Header */}
              <div
                id={`subject-header-${subject.id}`}
                className="px-4 py-3 bg-slate-50/70 hover:bg-slate-100/60 border-b border-slate-200/80 cursor-pointer flex items-center justify-between gap-3 transition-colors select-none"
                onClick={() => toggleSubjectCollapse(subject.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-3 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: subject.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 tracking-tight">
                        {subject.name}
                      </span>
                      <span className="text-xs font-mono px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-semibold">
                        {subject.code}
                      </span>
                      {subject.department && (
                        <span className="text-[11px] px-2 py-0.2 rounded-full bg-slate-200/60 text-slate-600 font-medium">
                          {subject.department}
                        </span>
                      )}
                      {hasExceptions && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-600" />
                          Pengecualian Khusus
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span>{allRules.length} Aturan terjadwal</span>
                      <span>•</span>
                      <span>{totalPeriodsScheduled} Sesi/pekan</span>
                    </div>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {allRules.length > 0 && (
                    <button
                      type="button"
                      onClick={() => guardAdminAction(() => onToggleSubjectRulesActive(subject.id, !allActive))}
                      title={allActive ? 'Nonaktifkan semua aturan mata pelajaran ini' : 'Aktifkan semua aturan'}
                      className={`text-xs px-2.5 py-1 rounded-xl font-medium border transition-colors flex items-center gap-1.5 ${
                        allActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {allActive ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Semua Aktif</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>Alihkan Semua</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Add rule for this specific subject */}
                  <button
                    type="button"
                    onClick={() => guardAdminAction(() => onOpenNewRule(subject.id))}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-white border border-amber-200 rounded-xl hover:bg-amber-50 shadow-2xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>

                  <div className="text-slate-400 pl-1 cursor-pointer" onClick={() => toggleSubjectCollapse(subject.id)}>
                    {isCollapsed ? (
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible Rule Cards */}
              {!isCollapsed && (
                <div className="p-4 space-y-3 bg-white">
                  {displayRules.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">
                      Belum ada aturan jadwal untuk {subject.name}. Klik "Tambah" untuk menjadwalkan kelas.
                    </div>
                  ) : (
                    displayRules.map((rule) => {
                      const cls = classMap.get(rule.classId);
                      const teacher = teacherMap.get(rule.teacherId);
                      const room = roomMap.get(rule.roomId);
                      const session = sessionMap.get(rule.sessionId);
                      const periods = rule.periodIds.map((pid) => periodMap.get(pid)?.name || pid);
                      const isConflicted = conflicts.some((c) => c.involvedRuleIds.includes(rule.id));

                      return (
                        <div
                          key={rule.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            rule.active
                              ? isConflicted
                                ? 'border-rose-300 bg-rose-50/30'
                                : 'border-slate-200 bg-slate-50/40 hover:bg-white hover:border-amber-200 hover:shadow-2xs'
                              : 'border-slate-200 bg-slate-100/60 opacity-60'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            {/* Main Details */}
                            <div className="space-y-1.5">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="font-bold text-xs text-indigo-950 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-md">
                                  {((rule.daysOfWeek && rule.daysOfWeek.length > 0) ? rule.daysOfWeek : [rule.dayOfWeek || 'Senin']).join(', ')}
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                  {cls?.name || 'Kelas'}
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  {session?.name || 'Sesi'}
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-600 flex items-center gap-1">
                                  <Repeat className="w-3 h-3 text-slate-400" />
                                  {rule.repeatDetail}
                                </span>

                                {!rule.active && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-200 text-slate-600">
                                    Nonaktif
                                  </span>
                                )}

                                {isConflicted && (
                                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    Ada Konflik
                                  </span>
                                )}
                              </div>

                              {/* Teachers & Rooms */}
                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{teacher?.name || 'Pengampu'}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{room?.name || 'Ruangan'} ({room?.type || 'Standar'})</span>
                                </span>
                                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Periode: {periods.join(', ')}</span>
                                </span>
                              </div>

                              {rule.notes && (
                                <p className="text-[11px] text-slate-500 italic">
                                  "{rule.notes}"
                                </p>
                              )}
                            </div>

                            {/* Actions (Guarded by Admin auth) */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => guardAdminAction(() => onToggleRuleActive(rule.id, !rule.active))}
                                title={rule.active ? 'Nonaktifkan aturan' : 'Aktifkan aturan'}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  rule.active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-slate-200 text-slate-500 border-slate-300 hover:bg-slate-300'
                                }`}
                              >
                                {rule.active ? (
                                  <CheckCircle className="w-3.5 h-3.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => guardAdminAction(() => onDuplicateRule(rule))}
                                title="Duplikasi aturan (salin ke kelas atau hari lain)"
                                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 transition-colors shadow-2xs"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => guardAdminAction(() => onEditRule(rule))}
                                title="Ubah aturan & pengecualian"
                                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 transition-colors shadow-2xs"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => guardAdminAction(() => onDeleteRule(rule.id))}
                                title="Hapus aturan"
                                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Rule Exceptions */}
                          {rule.exceptions.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 bg-amber-50/60 -mx-3.5 -mb-3.5 p-3 rounded-b-xl border-amber-100">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1">
                                <Zap className="w-3.5 h-3.5 text-amber-600" />
                                <span>Pengecualian Aturan Khusus ({rule.exceptions.length}):</span>
                              </div>
                              <div className="space-y-1">
                                {rule.exceptions.map((exc) => {
                                  const excPeriod = periodMap.get(exc.periodId);
                                  const overrideSession = exc.overrideSessionId
                                    ? sessionMap.get(exc.overrideSessionId)
                                    : undefined;
                                  const overrideRoom = exc.overrideRoomId
                                    ? roomMap.get(exc.overrideRoomId)
                                    : undefined;
                                  const overrideTeacher = exc.overrideTeacherId
                                    ? teacherMap.get(exc.overrideTeacherId)
                                    : undefined;

                                  return (
                                    <div
                                      key={exc.id}
                                      className="text-xs text-amber-900 bg-white/80 border border-amber-200/80 rounded-md px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2"
                                    >
                                      <div>
                                        <span className="font-bold">
                                          Kecuali pada {excPeriod?.name || exc.periodId}:
                                        </span>{' '}
                                        {overrideSession && (
                                          <span className="font-semibold text-indigo-700">
                                            Dipindah ke {overrideSession.name}
                                          </span>
                                        )}
                                        {overrideRoom && (
                                          <span className="text-slate-700 ml-1">
                                            (di {overrideRoom.name})
                                          </span>
                                        )}
                                        {overrideTeacher && (
                                          <span className="text-slate-700 ml-1">
                                            (oleh {overrideTeacher.name})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
