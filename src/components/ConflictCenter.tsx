import React from 'react';
import {
  ScheduleConflict,
  DatabaseState,
  ScheduleRule,
  Subject,
  Teacher,
  Room,
  ClassEntity,
  Period,
  Session
} from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  GraduationCap,
  DoorOpen,
  Calendar,
  Clock,
  ArrowRight,
  Edit2,
  XCircle,
  Zap,
  ArrowLeft
} from 'lucide-react';

interface ConflictCenterProps {
  conflicts: ScheduleConflict[];
  db: DatabaseState;
  onEditRule: (rule: ScheduleRule) => void;
  onToggleRuleActive: (ruleId: string, active: boolean) => void;
  onNavigateToCalendar: () => void;
}

export const ConflictCenter: React.FC<ConflictCenterProps> = ({
  conflicts,
  db,
  onEditRule,
  onToggleRuleActive,
  onNavigateToCalendar
}) => {
  const ruleMap = new Map<string, ScheduleRule>(db.rules.map((r) => [r.id, r]));
  const subjectMap = new Map<string, Subject>(db.subjects.map((s) => [s.id, s]));
  const teacherMap = new Map<string, Teacher>(db.teachers.map((t) => [t.id, t]));
  const roomMap = new Map<string, Room>(db.rooms.map((r) => [r.id, r]));
  const classMap = new Map<string, ClassEntity>(db.classes.map((c) => [c.id, c]));
  const periodMap = new Map<string, Period>(db.periods.map((p) => [p.id, p]));
  const sessionMap = new Map<string, Session>(db.sessions.map((s) => [s.id, s]));

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'teacher':
        return <Users className="w-4 h-4 text-rose-600" />;
      case 'class':
        return <GraduationCap className="w-4 h-4 text-amber-600" />;
      case 'room':
        return <DoorOpen className="w-4 h-4 text-purple-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToCalendar}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ke Jadwal</span>
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${conflicts.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
              <span>Pemeriksa Tabrakan Jadwal (Conflict Inspector)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Deteksi otomatis tabrakan guru pengampu, ruangan kelas, dan waktu sesi secara langsung.
            </p>
          </div>
        </div>
      </div>

      {/* No Conflicts State */}
      {conflicts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Jadwal Bersih — Tanpa Konflik</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Seluruh asatidz, ruangan, kelas, dan sesi waktu bebas dari tabrakan atau jadwal ganda.
            </p>
          </div>
        </div>
      ) : (
        /* Conflicted Rules List */
        <div className="space-y-3">
          <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
            <span>
              Ditemukan {conflicts.length} potensi tabrakan dalam aturan jadwal:
            </span>
            <span className="text-[11px] font-normal text-rose-600">
              Perlu penyesuaian aturan atau ruangan
            </span>
          </div>

          {conflicts.map((conflict) => {
            const period = periodMap.get(conflict.periodId);
            const session = sessionMap.get(conflict.sessionId);

            return (
              <div
                key={conflict.id}
                className="bg-white rounded-2xl border border-rose-200 shadow-2xs overflow-hidden"
              >
                <div className="px-4 py-3 bg-rose-50/60 border-b border-rose-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(conflict.type)}
                    <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                      Konflik {conflict.type === 'teacher' ? 'Guru' : conflict.type === 'room' ? 'Ruangan' : 'Kelas'}:
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {conflict.entityName || conflict.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 font-mono">
                    <span className="font-semibold text-slate-800">{conflict.day}</span>
                    <span>•</span>
                    <span>{session?.name || conflict.sessionId} ({session?.startTime} - {session?.endTime})</span>
                    <span>•</span>
                    <span className="text-indigo-700 font-sans font-semibold">{period?.name}</span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-600">{conflict.message || conflict.description}</p>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Aturan yang Terlibat:
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {conflict.involvedRuleIds.map((ruleId) => {
                        const rule = ruleMap.get(ruleId);
                        if (!rule) return null;

                        const sub = subjectMap.get(rule.subjectId);
                        const cls = classMap.get(rule.classId);
                        const tch = teacherMap.get(rule.teacherId);
                        const rm = roomMap.get(rule.roomId);

                        return (
                          <div
                            key={rule.id}
                            className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs space-y-2 flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900">{sub?.name || 'Pelajaran'}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                                  {sub?.code}
                                </span>
                              </div>
                              <div className="text-slate-600 text-[11px] space-y-0.5">
                                <div>Kelas: <span className="font-semibold">{cls?.name}</span></div>
                                <div>Pengampu: <span className="font-semibold">{tch?.name}</span></div>
                                <div>Ruang: <span className="font-semibold">{rm?.name}</span></div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onToggleRuleActive(rule.id, false)}
                                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                              >
                                Nonaktifkan
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditRule(rule)}
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Ubah Aturan</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
