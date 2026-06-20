// src/components/JobListItem.tsx — 單一任務列表項目（單一職責：列表項目渲染）
import { Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import type { JobItem } from '../types/job';

interface Props {
  item: JobItem;
  isActive: boolean;
  onSelect: (id: string | number) => void;
  onDelete: (id: string | number) => void;
}

export default function JobListItem({ item, isActive, onSelect, onDelete }: Props) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  };

  return (
    <button
      onClick={() => onSelect(item.id)}
      className={`w-full text-left rounded-lg p-3 transition-all duration-150 group
        ${isActive
          ? 'bg-indigo-500/15 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
          : 'border border-transparent hover:bg-gray-800/60 hover:border-gray-600/30'
        }`}
    >
      <div className="flex items-center justify-between">
        <div className={`text-sm font-medium truncate flex-1 ${isActive ? 'text-indigo-300' : 'text-white'}`}>
          {item.task_name}
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={handleDelete}
          onKeyDown={(e) => e.key === 'Enter' && handleDelete(e as unknown as React.MouseEvent)}
          className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-gray-500 hover:text-rose-400 transition-all ml-2 shrink-0"
          title="刪除任務"
        >
          <Trash2 size={14} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <StatusBadge status={item.status} />
        {item.created_at && (
          <span className="text-xs text-gray-300">{item.created_at}</span>
        )}
      </div>
    </button>
  );
}
