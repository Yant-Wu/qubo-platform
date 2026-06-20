// src/hooks/useCreateJobForm.ts — 建立任務表單狀態管理 Hook

import { useState } from 'react';
import type { CreateJobPayload } from '../types/job';

export const PROBLEM_TYPES = [
  { value: 'knapsack' },
  { value: 'custom' },
] as const;

export interface UseCreateJobFormReturn {
  // 表單欄位
  taskName: string;
  setTaskName: (v: string) => void;
  problemType: string;
  setProblemType: (v: string) => void;

  // 衍生狀態
  canSubmit: (isSubmitting: boolean) => boolean;

  // Payload 組裝
  buildPayload: () => CreateJobPayload;
}

export function useCreateJobForm(initialValues?: {
  taskName?: string;
  problemType?: string;
}): UseCreateJobFormReturn {
  const [taskName,     setTaskName]     = useState(initialValues?.taskName    ?? '');
  const [problemType,  setProblemType]  = useState(initialValues?.problemType ?? 'knapsack');

  const canSubmit = (isSubmitting: boolean) =>
    Boolean(taskName.trim()) && !isSubmitting;

  const buildPayload = (): CreateJobPayload => ({
    task_name:      taskName.trim(),
    problem_type:   problemType,
    n_variables:    1,             // 實際值由 Page 2 物品數量覆蓋
    solver_backend: 'simulated_annealing',
    problem_data: {
      generation_method: 'upload', // 固定為手動輸入，不走後端隨機生成
    },
  });

  return {
    taskName, setTaskName,
    problemType, setProblemType,
    canSubmit,
    buildPayload,
  };
}
