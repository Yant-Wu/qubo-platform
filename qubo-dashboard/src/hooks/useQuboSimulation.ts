// src/hooks/useQuboSimulation.ts — QUBO 模擬狀態管理 Hook

import { useCallback } from 'react';
import type { JobDetail, SimParams } from '../types/job';
import type { HistoryDataPoint } from '../types/job';

type SimPoint = HistoryDataPoint;

export interface UseQuboSimulationReturn {
  // 可編輯參數
  paramTimeout: string;
  paramInitTemp: string;
  paramCoolingRate: string;

  // 模擬狀態
  simHistory: SimPoint[];
  isRunning: boolean;
  isCompleted: boolean;

  // 操作
  handlePause: () => void;

  // 衍生計算值
  iterCount: number;

  bestObjective: string;
  tts: string;
  feasiblePct: string;
}

export function useQuboSimulation(
  jobId: string | number | null,
  detail: JobDetail | null,
  externalSimParams?: SimParams
): UseQuboSimulationReturn {
  void jobId;
  // ── 可編輯參數（由外部資料推導）─────────────────────────────────
  const paramTimeout = externalSimParams?.timeout ?? String(detail?.problem_data?.timeout_seconds ?? 30);
  // t_start 儲存 AEQTS 鄰域大小 N；t_end 儲存實際迭代次數
  const N = detail?.t_start ?? 50;
  const numIter = detail?.t_end ?? Math.max(1000, (detail?.n_variables ?? 0) * 100);
  const paramInitTemp = externalSimParams?.initTemp ?? String(Math.round(N));
  const paramCoolingRate = externalSimParams?.coolingRate ?? String(Math.round(numIter));

  // ── 模擬狀態（由後端狀態推導）──────────────────────────────────
  const simHistory: SimPoint[] = detail?.history_data ?? [];
  const isRunning = (detail?.status ?? '') === 'running';
  const isCompleted = (detail?.status ?? '') === 'completed';

  // ── 正式環境暫不在前端控制暫停 ───────────────────────────────
  const handlePause = useCallback(() => {}, []);

  // ── 衍生計算值 ─────────────────────────────────────────────────
  // 目前從後端收到的最後一個迭代編號（history 將 iteration 儲存在 d.iteration）
  const lastIteration = simHistory.length > 0
    ? (simHistory[simHistory.length - 1].iteration ?? simHistory.length)
    : 0;

  const iterCount = lastIteration;  // 實際 AEQTS 迭代次數

  // 最佳目標値（越大越好，如背包總價値）
  // 優先取可行解中的最大值；若無可行解記錄（舊資料），退回所有歷史的最大值
  const bestObjective = (() => {
    if (iterCount === 0) return '—';
    const feasible = simHistory.filter((d) => d.is_feasible === true);
    const source = feasible.length > 0 ? feasible : simHistory;
    return Math.max(...source.map((d) => d.value)).toFixed(4);
  })();

  // TTS = 後端實際計算時間
  const tts = detail?.computation_time_ms != null
    ? `${detail.computation_time_ms.toFixed(1)} ms`
    : '—';

  // Feasible % = 历史中 is_feasible=true 的比例（對有記錄可行性的 job 才顯示）
  const feasiblePct = (() => {
    if (iterCount === 0) return '—';
    const annotated = simHistory.filter((d) => d.is_feasible != null);
    if (annotated.length === 0) return '—';  // 舊資料無 is_feasible 欄位
    const feasibleCount = annotated.filter((d) => d.is_feasible === true).length;
    return ((feasibleCount / annotated.length) * 100).toFixed(1);
  })();

  return {
    paramTimeout,
    paramInitTemp,
    paramCoolingRate,
    simHistory, isRunning, isCompleted,
    handlePause,
    iterCount,
    bestObjective, tts, feasiblePct,
  };
}
