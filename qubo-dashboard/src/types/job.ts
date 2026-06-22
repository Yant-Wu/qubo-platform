// src/types/job.ts — 共用型別定義

/** 任務列表中的單一項目 */
export interface JobItem {
  id: number | string;
  task_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  created_at?: string;
}

/** 任務詳細資料 */
export interface JobDetail {
  id: number | string;
  task_name: string;
  problem_type: string;
  n_variables: number;
  solver_backend: string;
  core_limit?: number;
  status?: string;
  problem_data?: {
    generation_method: 'random' | 'upload';
    seed?: number;
    filename?: string;
    num_iterations?: number;
    timeout_seconds?: number;
    experiment_count?: number;
    Q_matrix?: number[][];     // custom 類型的 QUBO 矩陣
    // Knapsack 表單紀錄
    items?: Array<{ name: string; weight: number; value: number }>;
    capacity?: number;
    penalty?: number;
    // 求解結果（存回 DB，刷新後不消失）
    selected_items?: Array<{ name: string; weight: number; value: number }>;
    total_value?: number;
    total_weight?: number;
    n_slack?: number;            // knapsack slack variable 數量
    slack_bits?: number;         // 使用者設定的 K（未設定時由後端自動推算）
  };
  history_data: HistoryDataPoint[];
  computation_time_ms?: number;  // 實際計算時間 (ms)
  t_start?: number;              // AEQTS 鄰域大小 N
  t_end?: number;                // AEQTS 迭代次數
  compute_device?: 'gpu' | 'cpu' | string;  // 實際執行裝置
  created_at?: string;
}

/** 收斂歷史資料點 */
export interface HistoryDataPoint {
  iteration: number;
  value: number;
  qubo_energy?: number | null;    // 歷史最低 QUBO 能量（越小越好）
  entropy?: number | null;        // AEQTS Q-bit entropy（0=完全收斂，1=最大不確定）
  qubit_probs?: number[];
  // is_feasible?: boolean | null;  // Feasible Solutions 指標已停用
  [key: string]: unknown;
}

/** API 回應包裝 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  total?: number;
}

/** 建立任務的請求 payload */
export interface CreateJobPayload {
  task_name: string;
  problem_type: string;
  n_variables: number;
  solver_backend: string;
  core_limit?: number;      // Neighbors (N)
  problem_data: {
    generation_method: 'random' | 'upload';
    seed?: number;
    filename?: string;
    num_iterations?: number;   // AEQTS 迭代次數
    timeout_seconds?: number;  // 執行時限（秒）
    experiment_count?: number; // 多 theta 實驗次數
    Q_matrix?: number[][];     // 自訂 QUBO 矩陣（custom 類型）
    // Knapsack 表單紀錄
    items?: Array<{ name: string; weight: number; value: number }>;
    capacity?: number;
    penalty?: number;
    slack_bits?: number;
  };
}

/** AEQTS 求解參數（跨頁傳遞） */
export interface SimParams {
  timeout: string;      // 執行時限（秒）
  initTemp: string;     // 鄰域大小 N
  coolingRate: string;  // 迭代次數
}

/** QuboSetupPage 表單暫存（跨步驟保留，新任務時清空） */
export interface KnapsackItemInput {
  name: string;
  weight: string;
  value: string;
}

export interface QuboFormData {
  items: KnapsackItemInput[];
  capacity: string;
  penalty: string;
  penaltyTouched: boolean;
  slackBits: string;   // slack variable 數量 K（空字串 = 自動推算）
}

export const DEFAULT_QUBO_FORM: QuboFormData = {
  items: [{ name: 'item-1', weight: '1', value: '10' }],
  capacity: '10',
  penalty: '0',
  penaltyTouched: false,
  slackBits: '',
};

export interface KnapsackItem {
  name: string;
  weight: number;
  value: number;
}

export interface KnapsackSolveRequest {
  items: KnapsackItem[];
  capacity: number;
  penalty: number;
  problem_type: string;
  problem_data?: Record<string, unknown>;
  /** custom 問題類型時直接傳入 Q_matrix */
  Q_matrix?: number[][];
  /** knapsack slack variable 數量 K（undefined = 自動推算）*/
  slack_bits?: number;
}

export interface KnapsackSolveResponse {
  job_id: string;
  selected_items: KnapsackItem[];
  total_value: number;
  total_weight: number;
  energy: number;
  computation_time_ms: number;
  device?: string;
}
