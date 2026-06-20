// src/components/QuboMonitorPanel.tsx — 監控儀錶板：支援中英雙語切換
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Play } from 'lucide-react';
import type { JobDetail, SimParams } from '../types/job';
import type { KnapsackSolveResponse } from '../types/job';
import type { AppLanguage } from '../types/i18n';
import { useQuboSimulation } from '../hooks/useQuboSimulation';
import EnergyConvergenceChart from './EnergyConvergenceChart';
import EntropyChart from './EntropyChart';
import QubitProbChart from './QubitProbChart';

interface Props {
  jobId: string | number | null;
  detail: JobDetail | null;
  isLoading?: boolean;
  loadError?: string | null;
  simParams?: SimParams;
  isSolving?: boolean;
  solveResult?: KnapsackSolveResponse | null;
  onStop: () => void;
  onReuseSettings?: () => void;
  lang: AppLanguage;
}

// ── 語系字典 ──────────────────────────────────────────────────────
const i18n = {
  zh: {
    paramLog: '此次參數紀錄',
    optResult: '最佳化結果',
    runningMsg: '後端運算中…',
    completeMsg: '✓ 後端回傳完成',
    rerunBtn: '↺ 套用此設定重新執行',
    leaveBtn: '← 離開並刪除任務',
    exportBtn: '匯出 01 字串',
    waitData: '等待資料',
    fetching: '正在取得任務資料…',
    waitBackend: '後端尚未開始運算，請稍候。',
    tabMain: '綜合視圖 (Convergence & Q-bits)',
    tabEntropy: '系統平均熵 (Entropy)',
    rangeLabel: '迭代視窗',
    chartTop: '最佳價值與能量收斂',
    chartBottom: 'Q-bit 量子態坍縮機率',
    loadTask: '載入任務資料中…',
    errLoad: '無法載入任務',
    backHome: '← 返回首頁',
    itemsCount: 'Selected Items',
    solving: 'AEQTS 正在求解，請稍候',
  },
  en: {
    paramLog: 'Execution Parameters',
    optResult: 'Optimization Results',
    runningMsg: 'Backend computing...',
    completeMsg: '✓ Backend response completed',
    rerunBtn: '↺ Rerun with these settings',
    leaveBtn: '← Leave and delete task',
    exportBtn: 'Export Bitstring',
    waitData: 'Waiting for data',
    fetching: 'Fetching task data...',
    waitBackend: 'Backend calculation pending, please wait.',
    tabMain: 'Main View (Convergence & Q-bits)',
    tabEntropy: 'System Avg Entropy',
    rangeLabel: 'Iteration window',
    chartTop: 'Best Value & Energy Convergence',
    chartBottom: 'Q-bit Collapse Probability',
    loadTask: 'Loading task data...',
    errLoad: 'Failed to load task',
    backHome: '← Back to Home',
    itemsCount: 'Selected Items',
    solving: 'AEQTS solving, please wait...',
  },
};

// ── 閃爍數據元件 ─────────────────────────────────────────────────
function FlickerValue({ value, large = false, xl = false }: { value: string; large?: boolean; xl?: boolean }) {
  return (
    <span
      className={[
        'font-mono transition-all duration-150 leading-none',
        xl ? 'text-5xl font-black' : large ? 'text-3xl font-bold' : 'text-base font-semibold',
        xl ? 'text-emerald-300 drop-shadow-[0_0_4px_rgba(52,211,153,0.4)]' : 'text-emerald-300',
      ].join(' ')}
    >
      {value}
    </span>
  );
}

// ── 主元件 ──────────────────────────────────────────────────────────
export default function QuboMonitorPanel({ jobId, detail, isLoading = false, loadError, simParams, isSolving = false, solveResult, onStop, onReuseSettings, lang }: Props) {
  const t = i18n[lang];

  const {
    paramTimeout, paramInitTemp, paramCoolingRate,
    simHistory,
    isRunning, isCompleted,
    handlePause,
    iterCount,
    bestObjective, tts, feasiblePct,
  } = useQuboSimulation(jobId, detail, simParams);

  const pd = detail?.problem_data;
  const displaySelected: Array<{ name: string; weight: number; value: number }> =
    (pd?.selected_items && pd.selected_items.length > 0)
      ? pd.selected_items
      : (solveResult?.selected_items ?? []);
  const displayTotalValue  = pd?.total_value  ?? solveResult?.total_value;
  const displayTotalWeight = pd?.total_weight ?? solveResult?.total_weight;
  const displayTimeMs = solveResult?.computation_time_ms || detail?.computation_time_ms;

  const [chartMode, setChartMode] = useState<'main' | 'entropy'>('main');
  const historyMaxIteration = simHistory.reduce(
    (maximum, point) => Math.max(maximum, Number(point.iteration) || 0),
    0,
  );
  const configuredIteration = Number(paramCoolingRate) || 0;
  const maxIteration = Math.max(1, historyMaxIteration || configuredIteration);
  const [visibleEnd, setVisibleEnd] = useState(maxIteration);
  const rangeTimerRef = useRef<number | null>(null);
  const pendingRangeEndRef = useRef(maxIteration);
  const previousMaxIterationRef = useRef(maxIteration);
  const rangeTouchedRef = useRef(false);
  const rangeInputRef = useRef<HTMLInputElement | null>(null);
  const rangeValueRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const clampEnd = (value: number) => Math.max(1, Math.min(maxIteration, value || maxIteration));
    const wasAtMaximum = pendingRangeEndRef.current >= previousMaxIterationRef.current;
    const nextEnd = !rangeTouchedRef.current || wasAtMaximum
      ? maxIteration
      : clampEnd(pendingRangeEndRef.current);

    setVisibleEnd(nextEnd);
    pendingRangeEndRef.current = nextEnd;
    previousMaxIterationRef.current = maxIteration;
    if (rangeInputRef.current) rangeInputRef.current.value = String(nextEnd);
    if (rangeValueRef.current) rangeValueRef.current.textContent = `0-${nextEnd}`;
  }, [maxIteration]);

  useEffect(() => () => {
    if (rangeTimerRef.current !== null) window.clearTimeout(rangeTimerRef.current);
  }, []);

  const canAdjustRange = maxIteration > 1;
  const chartViewStart = 0;
  const chartViewEnd = Math.max(1, Math.min(maxIteration, visibleEnd));

  const scheduleVisibleEnd = useCallback((nextEnd: number) => {
    pendingRangeEndRef.current = nextEnd;
    if (rangeTimerRef.current !== null) return;
    rangeTimerRef.current = window.setTimeout(() => {
      setVisibleEnd(pendingRangeEndRef.current);
      rangeTimerRef.current = null;
    }, 80);
  }, []);

  const handleRangeChange = useCallback((nextEnd: number) => {
    rangeTouchedRef.current = true;
    pendingRangeEndRef.current = nextEnd;
    if (rangeValueRef.current) rangeValueRef.current.textContent = `0-${nextEnd}`;
    scheduleVisibleEnd(nextEnd);
  }, [scheduleVisibleEnd]);

  const flushRangeChange = useCallback(() => {
    if (rangeTimerRef.current !== null) {
      window.clearTimeout(rangeTimerRef.current);
      rangeTimerRef.current = null;
    }
    setVisibleEnd(pendingRangeEndRef.current);
  }, []);

  const handleExport = () => {
    const originalItems = (detail?.problem_data?.items as Array<{ name: string }> | undefined) ?? [];
    const selectedNames = new Set(displaySelected.map((i) => i.name));
    const bitString = originalItems.length > 0
      ? originalItems.map((it) => (selectedNames.has(it.name) ? '1' : '0')).join('')
      : displaySelected.map(() => '1').join('');
    const blob = new Blob([bitString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detail?.task_name ?? 'solution'}_bitstring.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading && detail === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="text-gray-100 text-sm">{t.loadTask}</p>
        </div>
      </div>
    );
  }

  if (loadError && detail === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-center space-y-3 max-w-sm px-6">
          <p className="text-rose-400 text-sm font-semibold">{t.errLoad}</p>
          <p className="text-gray-300 text-xs">{loadError}</p>
          <button onClick={onStop} className="mt-2 text-xs text-gray-500 hover:text-gray-300 underline transition-colors">{t.backHome}</button>
        </div>
      </div>
    );
  }

  const backendStatus = detail?.status;
  const statusLabel = backendStatus ?? (isRunning ? 'running' : isCompleted ? 'completed' : 'idle');
  const statusColor = statusLabel === 'running' ? 'bg-emerald-900/40 text-emerald-400' : statusLabel === 'completed' ? 'bg-indigo-900/40 text-indigo-300' : 'bg-gray-800/60 text-gray-500';
  const dotColor = statusLabel === 'running' ? 'bg-emerald-400 animate-pulse' : statusLabel === 'completed' ? 'bg-indigo-400' : 'bg-gray-600';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">

        <aside className="w-72 flex-shrink-0 flex flex-col gap-3 p-4 border-r border-gray-800/60 bg-gray-900/40 overflow-y-auto">



          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-3 space-y-1.5">
            <p className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-2">{t.paramLog}</p>
            <ReadRow label="Task Name" value={detail?.task_name ?? '—'} />
            <ReadRow label="Problem Type" value={detail?.problem_type ?? '—'} />
            <ReadRow label="Generation" value={detail?.problem_type === 'custom' ? `custom (${detail?.n_variables ?? '?'}×${detail?.n_variables ?? '?'})` : (detail?.problem_data?.generation_method ?? '—')} />
            {detail?.problem_data?.generation_method === 'random' && detail?.problem_data?.seed !== undefined && (
              <ReadRow label="Seed" value={String(detail.problem_data.seed)} />
            )}
            <div className="border-t border-gray-700/40 my-1" />
            <ReadRow
              label="Variables"
              value={(() => {
                const nSlack = detail?.problem_data?.n_slack as number | undefined;
                const total = detail?.n_variables;
                if (nSlack && nSlack > 0 && total != null) return `${total - nSlack} items + ${nSlack} slack = ${total}`;
                return String(total ?? '—');
              })()}
            />
            <ReadRow label="Timeout" value={paramTimeout ? `${paramTimeout} s` : '—'} />
            <ReadRow label="Neighbors (N)" value={paramInitTemp} />
            <ReadRow label="Iterations" value={paramCoolingRate} />
            {detail?.compute_device && (
              <>
                <div className="border-t border-gray-700/40 my-1" />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-200">Compute</span>
                  {detail.compute_device === 'gpu' || detail.compute_device === 'cuda' ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">⚡ GPU</span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700/50 text-gray-400 border border-gray-600/50">■ CPU</span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-3 space-y-4">
            <p className="text-sm font-semibold text-gray-200 uppercase tracking-wider">{t.optResult}</p>
            <MetricBlock label="Best Objective"><FlickerValue value={bestObjective} xl /></MetricBlock>
            <MetricBlock label="TTS"><FlickerValue value={tts} large /></MetricBlock>
            <MetricBlock label="Feasible Solutions"><FlickerValue value={feasiblePct !== '—' ? `${feasiblePct} %` : '—'} large /></MetricBlock>
            {solveResult && (
              <div className="border-t border-gray-700/40 pt-1 space-y-1">
                <div className="flex justify-between text-xs"><span className="text-gray-200">Total Value</span><span className="font-mono text-emerald-300 font-semibold">{displayTotalValue ?? '—'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-200">Total Weight</span><span className="font-mono text-indigo-300 font-semibold">{displayTotalWeight ?? '—'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-200">Time</span><span className="font-mono text-gray-300">{displayTimeMs != null ? `${displayTimeMs} ms` : '—'}</span></div>
              </div>
            )}
          </div>

          {displaySelected.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-3 space-y-2 flex-1 min-h-0 flex flex-col">
              <p className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex-shrink-0">{t.itemsCount} ({displaySelected.length})</p>
              <div className="space-y-1.5 overflow-y-auto pr-0.5 flex-1">
                {displaySelected.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-gray-900/60 border border-gray-700/30 px-2.5 py-1.5">
                    <span className="text-xs text-gray-100 font-medium truncate flex-1">{item.name}</span>
                    <span className="text-xs text-gray-300 shrink-0">w:<span className="text-indigo-300 font-mono ml-0.5">{item.weight}</span></span>
                    <span className="text-xs text-gray-300 shrink-0">v:<span className="text-emerald-300 font-mono ml-0.5">{item.value}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {statusLabel === 'running' && <div className="text-center text-xs text-emerald-300 font-medium py-1">{t.runningMsg}</div>}
          {statusLabel === 'completed' && <div className="text-center text-xs text-indigo-300 font-medium py-1">{t.completeMsg}</div>}

          {onReuseSettings && (
            <button onClick={onReuseSettings} className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-indigo-100 text-xs font-medium transition-colors border border-indigo-700/40">
              {t.rerunBtn}
            </button>
          )}
          <button onClick={() => { handlePause(); onStop(); }} className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-gray-500 hover:text-rose-400 text-xs transition-colors">
            {t.leaveBtn}
          </button>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-base font-semibold text-gray-200">Qubit Probability Monitor</span>
            {detail?.task_name && <span className="text-xs text-gray-300 truncate">— {detail.task_name}</span>}

            <span className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full ${statusColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />{statusLabel}
            </span>

            {statusLabel === 'completed' && (
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 hover:text-emerald-100 text-sm font-medium transition-colors border border-emerald-700/40">
                <Download size={14} />{t.exportBtn}
              </button>
            )}
          </div>

          {!isRunning && !isCompleted && iterCount === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                {isSolving ? (
                  <><div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" /><div><p className="text-gray-300 text-sm font-medium">{t.runningMsg}</p><p className="text-gray-600 text-xs mt-1">{t.solving}</p></div></>
                ) : (
                  <><div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center mx-auto"><Play size={28} className="text-indigo-400 ml-1" /></div><div><p className="text-gray-300 text-sm font-medium">{t.waitData}</p><p className="text-gray-600 text-xs mt-1">{detail === null ? t.fetching : t.waitBackend}</p></div></>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-gray-800/30 border border-gray-700/40 rounded-xl overflow-hidden min-h-0">
              <div className="flex items-center gap-2 p-3 border-b border-gray-700/50 bg-gray-900/50 flex-shrink-0">
                <button
                  onClick={() => setChartMode('main')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartMode === 'main' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'}`}
                >
                  {t.tabMain}
                </button>
                <button
                  onClick={() => setChartMode('entropy')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${chartMode === 'entropy' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'}`}
                >
                  {t.tabEntropy}
                </button>
                {chartMode === 'main' && (
                  <div className="ml-auto flex min-w-0 flex-1 max-w-4xl items-center gap-3 text-xs text-gray-300">
                    <span className="shrink-0 font-semibold text-gray-400 uppercase tracking-wider">{t.rangeLabel}</span>
                    <input
                      type="range"
                      min={1}
                      max={maxIteration}
                      step={1}
                      defaultValue={maxIteration}
                      ref={rangeInputRef}
                      disabled={!canAdjustRange}
                      onInput={(e) => handleRangeChange(Number(e.currentTarget.value))}
                      onPointerUp={flushRangeChange}
                      onBlur={flushRangeChange}
                      onKeyUp={flushRangeChange}
                      className="h-2 min-w-32 flex-1 cursor-pointer accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={t.rangeLabel}
                    />
                    <span ref={rangeValueRef} className="w-28 shrink-0 text-right font-mono text-indigo-300">
                      0-{maxIteration}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden relative">
                {chartMode === 'main' && (
                  <div className="absolute inset-0 flex flex-col">
                    <div className="flex-[45] flex flex-col min-h-0 border-b border-gray-700/50 pt-2">
                      <div className="px-4 pb-1 text-xs font-semibold text-gray-400 tracking-wider flex-shrink-0">
                        {t.chartTop}
                      </div>
                      <div className="flex-1 min-h-0">
                        <EnergyConvergenceChart history={simHistory} lang={lang} visibleStart={chartViewStart} visibleEnd={chartViewEnd} />
                      </div>
                    </div>
                    <div className="flex-[55] flex flex-col min-h-0 bg-gray-900/20 pt-2">
                      <div className="px-4 pb-1 text-xs font-semibold text-gray-400 tracking-wider flex-shrink-0">
                        {t.chartBottom}
                      </div>
                      <div className="flex-1 min-h-0">
                        <QubitProbChart history={simHistory} lang={lang} visibleStart={chartViewStart} visibleEnd={chartViewEnd} />
                      </div>
                    </div>
                  </div>
                )}
                {chartMode === 'entropy' && <EntropyChart history={simHistory} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-sm text-white">{label}</span><span className="text-sm font-mono text-indigo-300">{value}</span></div>;
}
function MetricBlock({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-0.5"><span className="text-xs text-gray-200 uppercase tracking-wider">{label}</span>{children}</div>;
}
