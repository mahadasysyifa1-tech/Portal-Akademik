import React from 'react';
import {
  GraduationCap,
  BookOpen,
  School,
  Award,
  Sparkles,
  Users,
  Compass,
  Lightbulb,
  Bookmark,
  Star,
  Landmark,
  PenTool,
  Flag,
  Target,
  Shield,
  Heart,
  Trophy,
  Rocket,
  Layers,
  Globe,
  LucideIcon
} from 'lucide-react';

export interface ClassIconPreset {
  id: string;
  name: string;
  Icon: LucideIcon;
}

export const CLASS_ICON_PRESETS: ClassIconPreset[] = [
  { id: 'GraduationCap', name: 'Graduation', Icon: GraduationCap },
  { id: 'BookOpen', name: 'Book', Icon: BookOpen },
  { id: 'School', name: 'School', Icon: School },
  { id: 'Award', name: 'Award', Icon: Award },
  { id: 'Sparkles', name: 'Sparkles', Icon: Sparkles },
  { id: 'Users', name: 'Group', Icon: Users },
  { id: 'Compass', name: 'Compass', Icon: Compass },
  { id: 'Lightbulb', name: 'Insight', Icon: Lightbulb },
  { id: 'Bookmark', name: 'Bookmark', Icon: Bookmark },
  { id: 'Star', name: 'Star', Icon: Star },
  { id: 'Landmark', name: 'Campus', Icon: Landmark },
  { id: 'PenTool', name: 'Pen', Icon: PenTool },
  { id: 'Flag', name: 'Flag', Icon: Flag },
  { id: 'Target', name: 'Target', Icon: Target },
  { id: 'Shield', name: 'Shield', Icon: Shield },
  { id: 'Heart', name: 'Heart', Icon: Heart },
  { id: 'Trophy', name: 'Trophy', Icon: Trophy },
  { id: 'Rocket', name: 'Rocket', Icon: Rocket },
  { id: 'Layers', name: 'Tier', Icon: Layers },
  { id: 'Globe', name: 'Globe', Icon: Globe },
];

const presetMap = new Map<string, LucideIcon>(
  CLASS_ICON_PRESETS.map((p) => [p.id.toLowerCase(), p.Icon])
);

export const ClassIcon: React.FC<{
  name?: string;
  className?: string;
}> = ({ name, className = 'w-4 h-4' }) => {
  const IconComponent = (name && presetMap.get(name.toLowerCase())) || GraduationCap;
  return <IconComponent className={className} />;
};

export interface ClassIconPickerProps {
  value?: string;
  selected?: string;
  onChange?: (iconId: string) => void;
  onSelect?: (iconId: string) => void;
}

export const ClassIconPicker: React.FC<ClassIconPickerProps> = ({
  value,
  selected: propSelected,
  onChange,
  onSelect
}) => {
  const currentSelected = value || propSelected || 'GraduationCap';

  const handleSelect = (id: string) => {
    if (onChange) onChange(id);
    if (onSelect) onSelect(id);
  };

  return (
    <div>
      <label className="block font-bold text-slate-700 mb-1.5">
        Pilih Ikon Rombel / Kelas (20 Presets)
      </label>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
        {CLASS_ICON_PRESETS.map(({ id, name, Icon }) => {
          const isSelected = currentSelected.toLowerCase() === id.toLowerCase();
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
              title={`${name} (${id})`}
              className={`p-2 flex flex-col items-center justify-center rounded-lg transition-all text-xs cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs scale-105 ring-2 ring-indigo-300'
                  : 'bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
        <span>Ikon terpilih:</span>
        <span className="font-semibold text-slate-800">{currentSelected}</span>
      </div>
    </div>
  );
};
