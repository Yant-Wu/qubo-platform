import { request } from './apiClient';
import type { KnapsackSolveResponse, CreateJobPayload } from '../types/job';

/** /api/jobs/solve 端點的後端原始回應（包含 ApiResponse 包裝）*/
interface SolveAndCreateRaw {
  job_id: string;
  energy: number;
  selected_items: { name: string; weight: number; value: number }[];
  total_value: number;
  total_weight: number;
  computation_time_ms: number;
  device: string;
}

/**
 * 統一求解端點：POST /api/jobs/solve
 * 同步執行 AEQTS、建立 Job、儲存收斂歷史，一次呼叫回傳 job_id 與求解結果。
 */
export async function solveAndCreate(payload: CreateJobPayload): Promise<KnapsackSolveResponse> {
  const raw = await request<{ data: SolveAndCreateRaw }>('/api/jobs/solve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const d = raw.data;
  return {
    job_id:              d.job_id,
    selected_items:      d.selected_items,
    total_value:         d.total_value,
    total_weight:        d.total_weight,
    energy:              d.energy,
    computation_time_ms: d.computation_time_ms,
    device:              d.device,
  };
}
