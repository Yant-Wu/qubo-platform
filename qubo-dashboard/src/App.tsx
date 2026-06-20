import { useState, useEffect } from 'react';
import { useJobs } from './hooks/useJobs';
import { useJobDetail } from './hooks/useJobDetail';
import { useSolveKnapsack } from './hooks/useSolveKnapsack';
import { deleteJob } from './services/jobService';
import Sidebar from './components/Sidebar';
import ParamsPage from './components/ParamsPage';
import QuboSetupPage from './components/QuboSetupPage';
import QuboMonitorPanel from './components/QuboMonitorPanel';
import type { CreateJobPayload, SimParams, KnapsackSolveRequest, QuboFormData, KnapsackSolveResponse } from './types/job';
import { DEFAULT_QUBO_FORM } from './types/job';
import type { AppLanguage } from './types/i18n';

type ViewMode = 'params' | 'qubo-setup' | 'dashboard';

const DEFAULT_SIM_PARAMS: SimParams = { timeout: '30', initTemp: '50', coolingRate: '1000' };
const LANGUAGE_STORAGE_KEY = 'qubo-dashboard.lang';

function getInitialLanguage(): AppLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === 'en' ? 'en' : 'zh';
}

export default function OptimizationDashboard() {
  // 全局語言狀態
  const [lang, setLang] = useState<AppLanguage>(getInitialLanguage);
  const [activeId, setActiveId] = useState<string | number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('params');

  // 跨頁暂存
  const [simParams, setSimParams] = useState<SimParams>(DEFAULT_SIM_PARAMS);
  const [reusePayload, setReusePayload] = useState<Partial<CreateJobPayload> | null>(null);
  const [quboFormData, setQuboFormData] = useState<QuboFormData>(DEFAULT_QUBO_FORM);

  const { jobList, isLoading: isListLoading, error: listError, refetch: refetchList } = useJobs();
  const activeStillExists =
    activeId === null
    || isListLoading
    || jobList.length === 0
    || jobList.some((j) => String(j.id) === String(activeId));
  const effectiveActiveId = activeStillExists ? activeId : null;
  const effectiveViewMode: ViewMode = activeStillExists ? viewMode : 'params';

  const { detail: jobDetail, isLoading: isDetailLoading, error: detailError } = useJobDetail(effectiveActiveId);
  const { solve, isSubmitting, error: solveError, reset: resetSolveState } = useSolveKnapsack();
  const [lastSolveResult, setLastSolveResult] = useState<KnapsackSolveResponse | null>(null);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, [lang]);

  // ── Page 1 → Page 2 ─────────────────────────────────────────────
  const [pendingPayload, setPendingPayload] = useState<CreateJobPayload | null>(null);

  const handleParamsNext = (payload: CreateJobPayload, params: SimParams) => {
    setPendingPayload(payload);
    setSimParams(params);
    setReusePayload(null);
    resetSolveState();
    setViewMode('qubo-setup');
  };

  // ── Page 2 → Page 1 ─────────────────────────────────────────────
  const handleQuboBack = () => setViewMode('params');

  // ── Page 2 提交（POST /api/jobs/solve，同步執行）─────────────
  const handleQuboSubmit = async (payload: KnapsackSolveRequest) => {
    if (!pendingPayload) return;

    // 將 Page 2 輸入的物品/容量/懲罰（或 Q_matrix）合併進完整的 Job payload
    const isCustom = pendingPayload.problem_type === 'custom';
    const enrichedPayload: CreateJobPayload = {
      ...pendingPayload,
      n_variables: isCustom
        ? (payload.Q_matrix?.length ?? 0)
        : payload.items.length,
      problem_data: isCustom
        ? {
            ...pendingPayload.problem_data,
            Q_matrix: payload.Q_matrix,
          }
        : {
            ...pendingPayload.problem_data,
            items:    payload.items,
            capacity: payload.capacity,
            penalty:  payload.penalty,
            ...(payload.slack_bits !== undefined && { slack_bits: payload.slack_bits }),
          },
    };

    // 先跳到監控頁顯示運算進度，再等待後端回傳
    setViewMode('dashboard');

    // 統一求解：建立 Job + 執行 AEQTS + 儲存歷史（一次呼叫完成）
    const result = await solve(enrichedPayload);
    if (result === null) {
      setViewMode('qubo-setup'); // 失敗則退回設定頁
      return;
    }

    // job 已 completed，設定 activeId 並刷新側邊欄列表
    if (result.job_id) {
      setLastSolveResult(result);
      setActiveId(result.job_id);
      void refetchList();
    }
  };

  // ── 從側邊欄選歷史任務（跳過前兩頁直接進儀錶板） ───────────────
  const handleSelectJob = (id: string | number) => {
    setActiveId(id);
    setViewMode('dashboard');
  };

  // ── 建立新任務（回 Page 1） ──────────────────────────────────────
  const handleOpenCreate = () => {
    resetSolveState();
    setViewMode('params');
    setActiveId(null);
    setPendingPayload(null);
    setReusePayload(null);
    setSimParams(DEFAULT_SIM_PARAMS);
    setQuboFormData(DEFAULT_QUBO_FORM);
  };

  // ── 套用此設定重新執行 ───────────────────────────────────────
  const handleReuseSettings = () => {
    if (!jobDetail) return;
    const pd = jobDetail.problem_data;

    // 還原 ParamsPage 的設定
    setReusePayload({
      task_name:      jobDetail.task_name,
      problem_type:   jobDetail.problem_type,
      n_variables:    jobDetail.n_variables,
      solver_backend: jobDetail.solver_backend,
      core_limit:     jobDetail.core_limit,
      problem_data: { generation_method: 'upload' },
    });
    setSimParams({
      timeout:     String(pd?.timeout_seconds ?? Math.round(jobDetail.t_start ?? 30)),
      initTemp:    String(jobDetail.core_limit ?? Math.round(jobDetail.t_start ?? 50)),
      coolingRate: String(pd?.num_iterations  ?? Math.round(jobDetail.t_end   ?? 1000)),
    });

    // 還原 QuboSetupPage 的 Knapsack 表單
    if (pd?.items && pd.items.length > 0) {
      setQuboFormData({
        items: pd.items.map(item => ({
          name:   item.name,
          weight: String(item.weight),
          value:  String(item.value),
        })),
        capacity:       String(pd.capacity ?? 10),
        penalty:        String(pd.penalty  ?? 0),
        penaltyTouched: pd.penalty != null,
        slackBits:      pd.slack_bits != null ? String(pd.slack_bits) : '',
      });
    }

    resetSolveState();
    setLastSolveResult(null);
    setActiveId(null);
    setPendingPayload(null);
    setViewMode('params');
  };

  // ── 停止 / 刪除任務
  const handleStopJob = async (id: string | number) => {
    try {
      await deleteJob(id);
      setActiveId(null);
      setViewMode('params');
      await refetchList();
    } catch (err) { console.error('停止任務失敗:', err); }
  };

  const handleDeleteJob = async (id: string | number) => {
    try {
      await deleteJob(id);
      if (String(activeId) === String(id)) { setActiveId(null); setViewMode('params'); }
      await refetchList();
    } catch (err) { console.error('刪除任務失敗:', err); }
  };

  // ── 步驟指示器 ───────────────────────────────────────────────────
  const i18n = {
    zh: {
      steps: ['參數設定', 'QUBO 設定', '求解監控'],
    },
    en: {
      steps: ['Parameter', 'QUBO Setup', 'Monitor'],
    }
  };
  const t = i18n[lang];
  const stepIndex = effectiveViewMode === 'params' ? 0 : effectiveViewMode === 'qubo-setup' ? 1 : 2;
  const showStepper = effectiveViewMode !== 'dashboard';

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(prev => !prev)}
        jobList={jobList}
        isLoading={isListLoading}
        error={listError}
        activeId={effectiveActiveId}
        onSelectJob={handleSelectJob}
        onDeleteJob={handleDeleteJob}
        onCreateNew={handleOpenCreate}
        lang={lang}
        setLang={setLang}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── 頂部工具列（非 dashboard 頁才顯示） ─────────────────── */}
        {showStepper && (
          <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm">
            <span className="text-sm font-medium text-gray-400 tracking-tight">QUBO Dashboard</span>
            <div className="ml-auto flex items-center gap-2">
              {t.steps.map((label, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-700 text-[10px]">›</span>}
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                      i === stepIndex
                        ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                        : i < stepIndex
                        ? 'text-emerald-500'
                        : 'text-gray-600'
                    }`}
                  >
                    {i < stepIndex ? '✓' : `${i + 1}.`} {label}
                  </span>
                </div>
              ))}
            </div>
          </header>
        )}

        {/* ── 主內容 ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {effectiveViewMode === 'params' && (
            <ParamsPage
              onNext={handleParamsNext}
              defaultSimParams={simParams}
              defaultPayload={reusePayload ?? undefined}
              restorePayload={pendingPayload ?? undefined}
              lang={lang}
            />
          )}

          {effectiveViewMode === 'qubo-setup' && (
            <QuboSetupPage
              problemType={pendingPayload?.problem_type ?? 'knapsack'}
              problemData={pendingPayload?.problem_data}
              isSubmitting={isSubmitting}
              error={solveError}
              onBack={handleQuboBack}
              onSubmit={handleQuboSubmit}
              initialFormData={quboFormData}
              onFormChange={setQuboFormData}
              lang={lang}
            />
          )}

          {effectiveViewMode === 'dashboard' && (
            <QuboMonitorPanel
              jobId={effectiveActiveId}
              detail={jobDetail}
              isLoading={isDetailLoading}
              loadError={detailError}
              simParams={simParams}
              isSolving={isSubmitting}
              solveResult={lastSolveResult}
              onStop={() => effectiveActiveId !== null ? handleStopJob(effectiveActiveId) : setViewMode('qubo-setup')}
              onReuseSettings={handleReuseSettings}
              lang={lang}
            />
          )}
        </main>
      </div>
    </div>
  );
}
