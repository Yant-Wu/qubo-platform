// src/components/Sidebar.tsx — Gemini 風格持久側邊欄（可收合 / 展開）
import { Menu, SquarePen } from 'lucide-react';
import JobListItem from './JobListItem';
import StatusBadge from './StatusBadge';
import LanguageToggle from './LanguageToggle';
import type { JobItem } from '../types/job';
import type { AppLanguage } from '../types/i18n';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  jobList: JobItem[];
  isLoading: boolean;
  error: string | null;
  activeId: string | number | null;
  onSelectJob: (id: string | number) => void;
  onDeleteJob: (id: string | number) => void;
  onCreateNew: () => void;
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
}

export default function Sidebar({
  isOpen,
  onToggle,
  jobList,
  isLoading,
  error,
  activeId,
  onSelectJob,
  onDeleteJob,
  onCreateNew,
  lang,
  setLang,
}: Props) {
  return (
    <aside
      className={`
        flex-shrink-0 flex flex-col h-full
        bg-gray-900 border-r border-gray-800/50
        transition-[width] duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'w-64' : 'w-[60px]'}
      `}
    >
      {/* ── 第一行：漢堡選單（+ 展開時顯示標題） ── */}
      <div className={`flex items-center h-14 flex-shrink-0 ${isOpen ? 'px-3' : 'justify-center'}`}>
        <button
          onClick={onToggle}
          className="w-10 h-10 flex items-center justify-center rounded-full
                     text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label={isOpen ? (lang === 'zh' ? '收合側邊欄' : 'Collapse sidebar') : (lang === 'zh' ? '展開側邊欄' : 'Expand sidebar')}
        >
          <Menu size={20} />
        </button>
        {isOpen && (
          <span className="ml-3 text-base font-medium text-white whitespace-nowrap tracking-tight select-none">
            QUBO Dashboard
          </span>
        )}
      </div>

      {/* ── 第二行：新任務按鈕 ── */}
      <div className={`flex items-center h-12 mb-2 flex-shrink-0 ${isOpen ? 'px-3' : 'justify-center'}`}>
        <button
          onClick={onCreateNew}
          title={lang === 'zh' ? '新任務' : 'New Task'}
          className="w-10 h-10 flex items-center justify-center rounded-full
                     text-gray-300 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          <SquarePen size={20} />
        </button>
        {isOpen && (
          <span className="ml-3 text-sm text-gray-200 whitespace-nowrap select-none">
            {lang === 'zh' ? '新任務' : 'New Task'}
          </span>
        )}
      </div>

      {/* ── 分隔線 ── */}
      <div className="mx-3 border-t border-gray-800/60 mb-2 flex-shrink-0" />

      {/* ── 歷史標題（展開時） ── */}
      {isOpen && (
        <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-widest text-gray-300">
          {lang === 'zh' ? '歷史紀錄' : 'History'}
        </p>
      )}

      {/* ── 任務列表 ── */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-rose-400/80 text-xs py-6 px-2">{error}</p>
        ) : jobList.length === 0 ? (
          isOpen ? (
            <p className="text-center text-gray-400 text-xs py-6">{lang === 'zh' ? '尚無任務' : 'No tasks yet'}</p>
          ) : null
        ) : isOpen ? (
          <div className="px-2 space-y-0.5">
            {jobList.map((item) => (
              <JobListItem
                key={item.id}
                item={item}
                isActive={activeId === item.id}
                onSelect={onSelectJob}
                onDelete={onDeleteJob}
              />
            ))}
          </div>
        ) : (
          // 收合：icon rail
          <div className="flex flex-col items-center gap-1 px-2">
            {jobList.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectJob(item.id)}
                title={item.task_name}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-colors
                  ${activeId === item.id ? 'bg-gray-700' : 'hover:bg-gray-800'}
                `}
              >
                <StatusBadge status={item.status} dotOnly />
              </button>
            ))}
          </div>
        )}
      </div>
      {/* ── 左下角語言切換按鈕 ── */}
      <div className="mt-auto mb-4 flex justify-center">
        <LanguageToggle
          lang={lang}
          setLang={setLang}
          title={lang === 'zh' ? '切換英文' : 'Switch to Chinese'}
          className="px-3 py-1 rounded bg-gray-700/40 hover:bg-gray-700/80 text-gray-300 hover:text-white text-xs font-medium border border-gray-600/50 transition-colors"
        />
      </div>
    </aside>
  );
}
