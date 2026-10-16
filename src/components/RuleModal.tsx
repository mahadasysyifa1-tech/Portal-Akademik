import React from 'react';
import {
  DatabaseState,
  ScheduleRule,
  DayOfWeek
} from '../types';
import { RuleForm } from './RuleForm';

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: ScheduleRule) => void;
  onDelete?: (ruleId: string) => void;
  db: DatabaseState;
  editingRule?: ScheduleRule | null;
  prefill?: {
    day?: DayOfWeek;
    periodId?: string;
    sessionId?: string;
    classId?: string;
    subjectId?: string;
  };
}

export const RuleModal: React.FC<RuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  db,
  editingRule,
  prefill
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl my-8">
        <RuleForm
          db={db}
          editingRule={editingRule}
          prefill={prefill}
          onSave={onSave}
          onDelete={onDelete}
          onClose={onClose}
          inline={false}
        />
      </div>
    </div>
  );
};
