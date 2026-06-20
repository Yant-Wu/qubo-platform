// src/components/ParamsPage.tsx — 第一頁：基本資訊 + 求解參數設定
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CreateJobPayload, SimParams } from '../types/job';
import { useCreateJobForm, PROBLEM_TYPES } from '../hooks/useCreateJobForm';
import type { AppLanguage } from '../types/i18n';

interface Props {
  onNext: (payload: CreateJobPayload, simParams: SimParams) => void;
  defaultSimParams?: SimParams;
  defaultPayload?: Partial<CreateJobPayload>;  // 重用舊任務（加 copy 後綴）
  restorePayload?: Partial<CreateJobPayload>;  // 上一步返回時原樣還原
  lang: AppLanguage;
}

const i18n = {
  zh: {
    sectionBasic: '基本設定',
    sectionParams: '相關參數',
    taskTitle: '任務標題',
    taskTitlePh: '例如：TSP benchmark',
    problemType: '問題類型',
    timeout: 'Timeout',
    timeoutHint: '秒',
    nextBtn: '下一步：QUBO 設定',
    required: '必填',
    errorTask: '請輸入任務標題',
    errorType: '請選擇問題類型',
    errorTimeout: 'Timeout 必須為正整數',
    problemTypeLabels: {
      knapsack: '背包問題 (Knapsack)',
      custom: '自定義 QUBO 矩陣 (Custom)',
    },
  },
  en: {
    sectionBasic: 'Basic Settings',
    sectionParams: 'Parameters',
    taskTitle: 'Task Title',
    taskTitlePh: 'e.g. TSP benchmark',
    problemType: 'Problem Type',
    timeout: 'Timeout',
    timeoutHint: 'sec',
    nextBtn: 'Next: QUBO Setup',
    required: 'required',
    errorTask: 'Please enter a task title',
    errorType: 'Please select a problem type',
    errorTimeout: 'Timeout must be a positive integer',
    problemTypeLabels: {
      knapsack: 'Knapsack',
      custom: 'Custom QUBO Matrix',
    },
  }
};

export default function ParamsPage({ onNext, defaultSimParams, defaultPayload, restorePayload, lang }: Props) {
  // restorePayload 優先（原樣還原），其次 defaultPayload（複製加 copy 後綴）
  const initPayload = restorePayload ?? defaultPayload;
  const copySuffix  = !restorePayload && !!defaultPayload;

  const {
    taskName, setTaskName,
    problemType, setProblemType,
    canSubmit, buildPayload,
  } = useCreateJobForm(initPayload ? {
    taskName:    initPayload.task_name    ? initPayload.task_name + (copySuffix ? ' (copy)' : '') : undefined,
    problemType: initPayload.problem_type,
  } : undefined);

  const [timeout, setTimeout_] = useState(defaultSimParams?.timeout ?? '30');

  const handleNext = () => {
    if (!canSubmit(false)) return;
    const payload = buildPayload();
    // 將 AEQTS 參數實際送入 payload
    payload.core_limit = 50;                 // Neighbors (N) 固定預設
    payload.problem_data = {
      ...payload.problem_data,
      num_iterations:  1000,                 // Iterations 固定預設
      timeout_seconds: Math.max(1, Number(timeout) || 30),
    };
    onNext(payload, { timeout, initTemp: '50', coolingRate: '1000' });
  };

  const t = i18n[lang];
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-center p-6 min-h-screen">
        <div className="w-full max-w-5xl bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl shadow-black/50 p-8">
          <div className="grid grid-cols-2 gap-8">
            {/* ── 左欄：基本設定 + 求解器 ───────────────────────────────── */}
            <div className="space-y-5">
              <SectionTitle>{t.sectionBasic}</SectionTitle>
              <CompactField label={t.taskTitle} required>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder={t.taskTitlePh}
                  className={compactInputCls}
                  aria-label={t.taskTitle}
                />
                {!taskName && <div className="text-rose-400 text-xs mt-1">{t.errorTask}</div>}
              </CompactField>
              <CompactField label={t.problemType} required>
                <select
                  value={problemType}
                  onChange={(e) => setProblemType(e.target.value)}
                  className={compactInputCls}
                  aria-label={t.problemType}
                >
                  <option value="" disabled>{t.problemType}</option>
                  {PROBLEM_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>{t.problemTypeLabels[p.value]}</option>
                  ))}
                </select>
                {!problemType && <div className="text-rose-400 text-xs mt-1">{t.errorType}</div>}
              </CompactField>
            </div>
            {/* ── 右欄：相關參數 ───────────────────────────────────────── */}
            <div className="space-y-5">
              <SectionTitle>{t.sectionParams}</SectionTitle>
              <CompactField label={t.timeout} hint={t.timeoutHint}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={timeout}
                  onChange={(e) => setTimeout_(e.target.value)}
                  className={compactInputCls}
                  aria-label={t.timeout}
                />
                {(!timeout || isNaN(Number(timeout)) || Number(timeout) < 1) && (
                  <div className="text-rose-400 text-xs mt-1">{t.errorTimeout}</div>
                )}
              </CompactField>
              {/* 下一步按鈕 */}
              <button
                onClick={handleNext}
                disabled={!canSubmit(false)}
                className="w-full mt-8 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/30"
              >
                {t.nextBtn}
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 小元件 ────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-widest">{children}</h3>;
}

function CompactField({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <label className="text-sm font-medium text-gray-100 uppercase tracking-wider">
          {label}{required && <span className="text-rose-400">*</span>}
        </label>
        {hint && <span className="text-xs text-white font-normal">({hint})</span>}
      </div>
      {children}
    </fieldset>
  );
}

const compactInputCls =
  'bg-gray-800/60 border border-gray-700/50 rounded-lg px-3.5 py-2.5 text-base text-gray-100 w-full ' +
  'placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition-colors';
