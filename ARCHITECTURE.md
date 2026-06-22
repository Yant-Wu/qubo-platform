# QUBO 最佳化平台 — 系統架構說明

## 目錄

1. [專案概覽](#1-專案概覽)
2. [系統架構](#2-系統架構)
3. [後端模組詳解](#3-後端模組詳解)
4. [QUBO 建模邏輯](#4-qubo-建模邏輯)
5. [AEQTS 求解演算法](#5-aeqts-求解演算法)
6. [CUDA 加速路徑](#6-cuda-加速路徑)
7. [REST API 文件](#7-rest-api-文件)
8. [資料庫結構](#8-資料庫結構)
9. [前端架構](#9-前端架構)
10. [完整資料流](#10-完整資料流)
11. [部署方式](#11-部署方式)

---

## 1. 專案概覽

本平台以「量子啟發式最佳化」為核心，將組合最佳化問題（背包問題、最大割問題、自訂 QUBO）轉換為 **QUBO（Quadratic Unconstrained Binary Optimization）** 矩陣後，交由 **AEQTS 演算法**（Adaptive Evolutionary Quantum-inspired Tabu Search）求解，並透過即時儀表板呈現收斂過程。

### 功能摘要

| 功能 | 說明 |
|------|------|
| 問題建模 | 支援 Knapsack（背包）、MaxCut（最大割）、Custom（自訂 Q 矩陣） |
| 求解器 | Python AEQTS（CPU/GPU 自動切換）或 CUDA binary（knapsack 加速） |
| 資料持久化 | SQLite 儲存所有任務與每個迭代的歷史資料 |
| 即時監控 | 收斂曲線、Qubit 機率熱圖、Entropy 折線圖 |
| 歷史查詢 | 所有過去任務可從側邊欄重新查看 |

---

## 2. 系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌──────────┐  ┌────────────────┐  ┌──────────────────────────┐ │
│  │ Sidebar  │  │  QuboSetupPage │  │   QuboMonitorPanel       │ │
│  │ (任務列表)│  │  (問題設定)     │  │ ┌────────┐ ┌──────────┐ │ │
│  └──────────┘  └────────────────┘  │ │收斂圖  │ │Entropy圖 │ │ │
│                                    │ └────────┘ └──────────┘ │ │
│                                    │  Qubit 機率 / 統計資訊    │ │
│                                    └──────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP REST (JSON)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                              │
│                                                                   │
│  POST /api/jobs/solve ──→ ThreadPoolExecutor ──→ _simulate_job() │
│  GET  /api/jobs           APScheduler (background worker)         │
│  GET  /api/jobs/{id}      (處理 pending 任務)                    │
│  DELETE /api/jobs/{id}                                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              QUBO Solver Pipeline                         │    │
│  │                                                           │    │
│  │  build_qubo_matrix()                                      │    │
│  │    ├── build_knapsack_qubo()   → n+K 維度（含 slack vars）│    │
│  │    ├── build_max_cut_qubo()    → V 維度                   │    │
│  │    └── build_custom_qubo()    → 使用者上傳的 Q            │    │
│  │                                                           │    │
│  │  Solver 選擇：                                            │    │
│  │    ├── [CUDA 可用 + Knapsack] → solve_cuda binary         │    │
│  │    └── [其他] → aeqts_solver()  (Python/CuPy)             │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  SQLite DB (SQLAlchemy ORM)                                       │
│    ├── jobs           (任務主表)                                   │
│    └── job_history    (逐迭代歷史)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + ECharts |
| 後端 | Python 3.13 + FastAPI + Uvicorn + SQLAlchemy 2.0 |
| 資料庫 | SQLite（可替換為 PostgreSQL） |
| 排程器 | APScheduler（背景任務）|
| 並行 | asyncio + ThreadPoolExecutor（最多 10 個 job 同時執行） |
| GPU | CUDA 12.4（`aeqts.cu` 編譯的 binary）/ CuPy fallback |
| 套件管理 | uv（後端）/ npm（前端） |

---

## 3. 後端模組詳解

### 3.1 `main.py` — 應用進入點

負責：
- FastAPI 應用初始化
- CORS 設定（由 `config.py` 的環境變數控制）
- `lifespan` 生命週期：啟動時初始化 DB、啟動 APScheduler；關閉時優雅停止

```python
# APScheduler 每 2 秒掃描一次 pending jobs
scheduler.add_job(process_pending_jobs, "interval", seconds=WORKER_CHECK_INTERVAL)
```

前端提交的 `/api/jobs/solve` 走 **直接 thread pool 執行**（有即時回傳），
而 `/api/jobs`（建立 pending job）則由 APScheduler 撿起來背景執行。

---

### 3.2 `config.py` — 環境設定

所有設定均可透過環境變數覆寫（`.env` 檔案或 Docker `-e`）：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///./database/qubo.db` | 資料庫連接字串 |
| `CORS_ORIGINS` | `http://localhost:5173,...` | 允許的 CORS 來源，設為 `*` 表示不限制 |
| `WORKER_ENABLED` | `true` | 是否啟動 APScheduler 背景 worker |
| `WORKER_CHECK_INTERVAL` | `2` | 背景 worker 掃描間隔（秒） |
| `HOST` / `PORT` | `0.0.0.0` / `8000` | Uvicorn 綁定位置 |

---

### 3.3 `database.py` — ORM 模型

#### `Job` 表

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | UUID | 主鍵 |
| `task_name` | String | 使用者命名 |
| `problem_type` | String | `Knapsack` / `MaxCut` / `custom` |
| `n_variables` | Integer | QUBO 維度（含 slack variables） |
| `solver_backend` | String | `aeqts`（目前只有這個） |
| `core_limit` | Integer | AEQTS 鄰域大小 N |
| `problem_data` | JSON | 問題參數，包含 items/capacity/penalty 等 |
| `status` | String | `pending` → `running` → `completed` / `failed` |
| `computation_time_ms` | Float | 實際運算時間（ms） |
| `t_start` | Float | 儲存鄰域大小 N（供前端顯示） |
| `t_end` | Float | 儲存實際迭代次數 |
| `compute_device` | String | `gpu` 或 `cpu` |

#### `JobHistory` 表

| 欄位 | 型別 | 說明 |
|------|------|------|
| `job_id` | FK(jobs.id) | 關聯主表（CASCADE 刪除） |
| `iteration` | Integer | 迭代編號 |
| `value` | Float | 真實目標值（背包：總價值，MaxCut：切割值） |
| `qubo_energy` | Float | 截至當前迭代的歷史最低 QUBO 能量 |
| `entropy` | Float | Q-bit 族群平均 von Neumann entropy |
| `is_feasible` | Boolean | 該迭代最佳解是否滿足約束 |
| `qubit_probs` | JSON | 各 qubit 的 β²（即 P(qubit=1)），陣列 |

---

### 3.4 `store.py` — CRUD 資料存取層

提供純粹的 SQLAlchemy 操作，Router 層不直接碰 ORM：

```
create_job()          → 建立 Job 記錄（status=pending）
list_jobs()           → 取得任務列表（依建立時間倒序）
get_job()             → 取得單一任務（含歷史）
delete_job()          → 刪除任務（CASCADE 刪 history）
update_job_status()   → 更新任務狀態
add_history_points()  → 批次新增歷史點
get_history_points()  → 取得任務所有歷史點
```

---

### 3.5 `worker.py` — 任務執行核心

`_simulate_job(db, job)` 是整個後端的計算核心：

```
1. 解析 problem_type（knapsack / max_cut / custom）
2. 展開 problem_data（capacity → max_weight 相容處理）
3. 建立 QUBO 矩陣（非 CUDA knapsack 才需要）
4. 決定求解參數：
     N = core_limit（鄰域大小，預設 50）
     num_iterations = 使用者設定 or max(1000, n_vars×100)
     timeout_secs = 使用者設定 or 30.0
5. 在 timeout 時間內反覆執行求解（多次 run，取最佳）
6. 寫入 JobHistory（每個 checkpoint 一列）
7. 更新 Job 統計欄位（computation_time_ms, t_start, t_end）
8. knapsack 額外存 selected_items / total_value / total_weight
```

**多次 run 機制**：在 `timeout_secs` 內不斷重跑，每次使用不同隨機種子（`seed=None`），保留 QUBO energy 最低的那次結果。

---

## 4. QUBO 建模邏輯

### 4.1 背包問題（Knapsack）

原始問題：最大化 $\sum_i v_i x_i$，受限於 $\sum_i w_i x_i \leq C$

**QUBO Hamiltonian**：

$$H_{\mathrm{QUBO\_new}} = \sum_i \left[-v_i + 2\lambda c_i^2 - 2\lambda Cc_i\right]y_i + \sum_{i<j}2\lambda c_i c_j y_i y_j$$

其中：
- $x_i \in \{0,1\}$：是否選取物品 $i$
- $s_k \in \{0,1\}$：Slack 變數，用二進位編碼將不等式約束轉為等式
- $K = \lceil \log_2(C+1) \rceil$：Slack variable 數量（可由前端指定 `slack_bits` 覆寫）
- $\lambda$：懲罰係數（`penalty`，預設 10.0）

展開後的 QUBO 矩陣維度為 $n + K$，即「物品數 + slack 數」。

**Q 矩陣填入**：
```
對角線（i,i）：−vᵢ + λ(2cᵢ² − 2C·cᵢ)  （Case 3 / QUBO_new 實驗基準）
非對角線（i,j）：2λ·cᵢ·cⱼ  （上三角）
```

其中 $c_i = w_i$（物品），$c_{n+k} = 2^k$（slack）。

---

### 4.2 最大割問題（MaxCut）

原始問題：最大化 $\sum_{(i,j) \in E} w_{ij}(x_i + x_j - 2x_ix_j)$

**QUBO Hamiltonian**（最小化）：

$$H = -\sum_{(i,j) \in E} w_{ij}(x_i + x_j - 2x_ix_j)$$

填入 Q 矩陣規則：
- $Q_{ii} \mathrel{-}= w_{ij}$（對邊的兩端節點對角線都減去邊權重）
- $Q_{ij} \mathrel{+}= 2w_{ij}$（非對角線加 2 倍邊權重）

矩陣維度等於節點數 $|V|$。

---

### 4.3 自訂 QUBO（Custom）

使用者直接上傳 Q 矩陣（最大 500×500）。平台會對矩陣做對稱化處理：

$$Q_{sym} = \frac{Q + Q^T}{2}$$

以確保 $x^TQx = \sum_i Q_{ii}x_i + 2\sum_{i<j} Q_{ij}x_ix_j$ 的計算一致性。

---

## 5. AEQTS 求解演算法

AEQTS 是一種**量子啟發式演化搜索演算法**，以 Q-bit（量子位）的機率振幅表示解的空間，透過量子旋轉收斂至最優解。

### 5.1 演算法流程

```
初始化：α = β = 1/√2（每個 qubit 以相等機率處於 0 或 1）

for iteration = 0 to num_iterations:
    1. 生成 N 個 Neighbours（向量化採樣）
       prob_i = β_i²  →  x_i ~ Bernoulli(β_i²)

    2. 評估能量
       energy_n = x_n^T · Q · x_n   for each neighbour n

    3. 更新最佳解
       if min(energy_n) < best_energy:
           best_sol = argmin, best_energy = min

    4. 量子旋轉更新（Rank-based）
       將 N 個鄰居按能量排序，取前半配對後半
       θ = θ_scale × π / rank
       Δ[i] = Σ (best_pair[i] - worst_pair[i]) × θ，調整方向由 α·β 正負決定
       α_new = α·cos(θ) - β·sin(θ)   β_new = α·sin(θ) + β·cos(θ)

    5. 記錄 checkpoint（每 num_iterations/100 次記一筆）
       - iteration, best_energy, current_energy, objective, entropy, is_feasible, qubit_probs

    6. Early stopping：若 Entropy ≤ 0.02，族群已收斂，提前停止

最終輸出：best_sol, best_energy, history, computation_time_ms
```

### 5.2 關鍵公式

**von Neumann Entropy**（族群收斂指標）：

$$H = -\frac{1}{n}\sum_{i=1}^{n}\left[\alpha_i^2 \log_2(\alpha_i^2) + \beta_i^2 \log_2(\beta_i^2)\right]$$

當所有 qubit 均收斂至確定態（$\alpha_i \to 0$ 或 $\beta_i \to 0$）時 $H \to 0$。

**量子旋轉矩陣**：

$$\begin{pmatrix} \alpha' \\ \beta' \end{pmatrix} = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix} \begin{pmatrix} \alpha \\ \beta \end{pmatrix}$$

### 5.3 GPU 加速（Python 路徑）

`solver.py` 透過 CuPy 自動偵測 GPU：

```python
try:
    import cupy as cp
    _GPU_AVAILABLE = cp.cuda.is_available()
except:
    _GPU_AVAILABLE = False
```

所有矩陣運算（鄰居生成、能量計算、量子旋轉）均以 NumPy/CuPy 向量化實作，無 Python-level 迴圈瓶頸。

### 5.4 θ 參數

每次 run 從以下候選中隨機選擇：
```
θ ∈ {0.01, 0.02, 0.03, ..., 0.10}
```
此設計增加多次 run 的多樣性，配合 timeout 機制反覆求解取最佳。

---

## 6. CUDA 加速路徑

當偵測到 `solve_cuda` binary（來自編譯 `aeqts.cu`）且問題為 Knapsack 時，Worker 直接呼叫 CUDA binary：

### 6.1 Binary 偵測

```python
candidates = [
    "../solve_cuda",       # 開發環境（backend/ 根目錄）
    "/app/solve_cuda",     # Docker 容器
    shutil.which("solve_cuda"),  # PATH
]
```

### 6.2 呼叫方式

```bash
./solve_cuda \
  --weights  "1.0,2.0,3.0" \
  --values   "4.0,5.0,6.0" \
  --capacity 5.0 \
  --penalty  10.0 \
  --population 50 \
  --iterations 1000
```

結果以 JSON 輸出到 stdout，Python 透過 `subprocess.run()` 擷取並解析。

### 6.3 CUDA 核函式

| Kernel | 功能 |
|--------|------|
| `init_rng_kernel` | 初始化每個執行緒的 Philox PRNG |
| `gen_neighbours_kernel` | 以 β² 機率生成 N 個二元鄰居向量 |
| `energy_kernel` | 計算每個鄰居的 QUBO 能量（shared memory 加速） |
| `updateQ_pairs_kernel` | 執行量子旋轉更新 α, β |

排序使用 **Thrust** 的 `sort_by_key`（GPU 上的高效排序庫）。

### 6.4 編譯指令

```bash
nvcc -O3 -std=c++17 -arch=sm_75 aeqts.cu -o solve_cuda
# 適用 Turing+ GPU（RTX 2080 及之後）
# 若需支援更舊的 GPU：-arch=sm_70（Volta）或 -arch=native
```

---

## 7. REST API 文件

Base URL: `http://localhost:8000`

### 7.1 端點總覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/jobs` | 取得所有任務列表 |
| `POST` | `/api/jobs` | 建立任務（async，status=pending） |
| `GET` | `/api/jobs/{id}` | 取得單一任務詳情（含歷史） |
| `DELETE` | `/api/jobs/{id}` | 刪除任務 |
| `PATCH` | `/api/jobs/{id}/status` | 更新任務狀態 |
| `POST` | `/api/jobs/{id}/history` | 新增歷史點 |
| `POST` | `/api/jobs/solve` | **主要端點**：建立並同步求解 |

---

### 7.2 `POST /api/jobs/solve`

前端主要使用此端點。會阻塞等待求解完成後回傳結果（透過 `asyncio.run_in_executor` 在 thread pool 執行，不阻塞 event loop）。

**Request Body**：

```json
{
  "task_name": "我的背包問題",
  "problem_type": "Knapsack",
  "n_variables": 5,
  "solver_backend": "aeqts",
  "core_limit": 50,
  "problem_data": {
    "generation_method": "random",
    "items": [
      {"name": "A", "weight": 2.0, "value": 10.0},
      {"name": "B", "weight": 3.0, "value": 15.0}
    ],
    "capacity": 5.0,
    "penalty": 10.0,
    "slack_bits": 3,
    "num_iterations": 1000,
    "timeout_seconds": 30.0
  }
}
```

**Response** (`201 Created`)：

```json
{
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "best_solution": [1, 0, 1],
    "best_energy": -23.14,
    "selected_items": [
      {"name": "A", "weight": 2.0, "value": 10.0},
      {"name": "C", "weight": 1.0, "value": 13.14}
    ],
    "total_value": 23.14,
    "total_weight": 3.0,
    "computation_time_ms": 1254.3,
    "device": "gpu"
  },
  "message": "success"
}
```

---

### 7.3 `GET /api/jobs/{id}`

取得完整任務詳情，包含 `history_data` 陣列（每個 checkpoint 一個物件）。

**history_data 單筆格式**：

```json
{
  "iteration": 500,
  "value": 18.5,
  "qubo_energy": -21.3,
  "entropy": 0.45,
  "is_feasible": true,
  "qubit_probs": [0.91, 0.03, 0.88, 0.12, 0.75]
}
```

| 欄位 | 說明 |
|------|------|
| `value` | 真實目標值（背包總價值，越大越好）|
| `qubo_energy` | 截至當前迭代的歷史最低 QUBO 能量 |
| `entropy` | 族群 von Neumann entropy（趨近 0 表示收斂）|
| `is_feasible` | 是否滿足容量約束 |
| `qubit_probs` | 各 qubit 的 β²，即 P(qubit=1) |

---

### 7.4 統一回應格式

所有端點均使用：

```json
{
  "data": "...",        // 任何型別的回傳資料
  "message": "success", // 說明文字
  "total": 10           // 列表型回應才有此欄位
}
```

錯誤時：

```json
{
  "message": "Job 'xxx' not found"
}
```

---

## 8. 資料庫結構

```sql
-- 任務主表
CREATE TABLE jobs (
    id               VARCHAR(36)  PRIMARY KEY,  -- UUID
    task_name        VARCHAR(255) NOT NULL,
    problem_type     VARCHAR(50)  NOT NULL,      -- Knapsack, MaxCut, custom
    n_variables      INTEGER      NOT NULL,      -- QUBO 維度（含 slack）
    solver_backend   VARCHAR(50)  NOT NULL,
    core_limit       INTEGER,                    -- 鄰域大小 N
    problem_data     JSON         NOT NULL,      -- 問題參數（items, capacity 等）
    status           VARCHAR(20)  DEFAULT 'pending',
    error_message    VARCHAR(1000),
    computation_time_ms FLOAT,
    t_start          FLOAT,                      -- 儲存 N（鄰域大小）
    t_end            FLOAT,                      -- 儲存迭代次數
    compute_device   VARCHAR(10),                -- 'gpu' 或 'cpu'
    created_at       DATETIME,
    updated_at       DATETIME
);

-- 逐迭代歷史（每個任務約 100 列）
CREATE TABLE job_history (
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    job_id       VARCHAR(36) REFERENCES jobs(id) ON DELETE CASCADE,
    iteration    INTEGER  NOT NULL,
    value        FLOAT    NOT NULL,              -- 目標值
    qubo_energy  FLOAT,                          -- 歷史最低能量
    entropy      FLOAT,                          -- Q-bit entropy
    is_feasible  BOOLEAN,
    qubit_probs  JSON,                           -- β² 陣列
    created_at   DATETIME
);
```

---

## 9. 前端架構

### 9.1 頁面導覽流程

```
ParamsPage（設定任務名稱、問題類型、求解參數）
    ↓ [下一步]
QuboSetupPage（設定物品/容量/懲罰係數，或上傳 Q 矩陣）
    ↓ [提交求解]
QuboMonitorPanel（即時監控收斂、查看結果）
    ↑
Sidebar（選取歷史任務，也可跳回 QuboMonitorPanel）
```

### 9.2 元件職責

| 元件 | 職責 |
|------|------|
| `Sidebar` | 任務列表、刪除、選取歷史任務 |
| `ParamsPage` | 任務基本設定（名稱、問題類型、timeout、N、迭代數）|
| `QuboSetupPage` | 問題具體設定（物品清單、容量、懲罰係數）一行批次新增 |
| `QuboMonitorPanel` | 監控主畫面，含統計面板 + 兩個圖表 |
| `EnergyConvergenceChart` | 收斂曲線（Best Objective + QUBO Energy 雙 Y 軸）|
| `EntropyChart` | Q-bit Entropy 折線圖 |

### 9.3 Hooks

| Hook | 功能 |
|------|------|
| `useJobs` | 任務列表輪詢（refetch）|
| `useJobDetail` | 單任務詳情查詢 |
| `useSolveKnapsack` | 提交求解、追蹤 isSubmitting 狀態 |
| `useQuboSimulation` | 將後端歷史資料轉換為圖表用狀態，計算 bestObjective / TTS / feasiblePct |
| `useCreateJobForm` | 表單狀態管理 |

### 9.4 圖表功能

**EnergyConvergenceChart**：
- 主 Y 軸（左）：Best Objective（真實目標值，越大越好）
- 副 Y 軸（右）：QUBO Energy（截至當代的歷史最低能量，只會下降或持平）
- X 軸：Iteration
- `compact` 模式：隱藏軸標籤/刻度/圖例（用於小圖面板）

**EntropyChart**：
- Y 軸：von Neumann Entropy（0～1）
- 趨近 0 表示演算法已收斂
- `compact` 模式同上

**圖表交換功能**：左側小圖面板有 ⇄ 按鈕，可切換大小圖的顯示內容（Entropy ↔ 收斂圖）。

---

## 10. 完整資料流

```
使用者填寫表單
    │
    ▼
QuboSetupPage 組裝 KnapsackSolveRequest
    │
    ▼ POST /api/jobs/solve
FastAPI Router (jobs.py)
    │  建立 Job (status=running)
    │
    ▼ asyncio.run_in_executor(thread_pool)
_blocking_solve()  ─────────────────────────────────────────────┐
    │                                                            │
    ▼                                                          Thread
_simulate_job(db, job)
    │
    ├─ [Knapsack + CUDA binary 存在] → cuda_knapsack_solver()
    │         subprocess.run("./solve_cuda --weights ...")
    │         JSON stdout 解析
    │
    └─ [其他] → aeqts_solver(Q, N, num_iterations)
               for timeout 秒內反覆求解 (多個 run，取最佳)
    │
    ▼
寫入 JobHistory（約 100 個 checkpoint）
更新 Job（computation_time_ms, selected_items 等）
    │
    ▼
回傳 best_result
    │           ┌────────────────────────────────────────────────┘
    ▼ Response
FastAPI 組裝 SolveAndCreateResponse
    │
    ▼ JSON
前端 useSolveKnapsack
    │  setLastSolveResult(result)
    │  setActiveId(job_id)
    │  setViewMode('dashboard')
    │
    ▼
QuboMonitorPanel
    │  useJobDetail(job_id) → GET /api/jobs/{id}
    │  useQuboSimulation() → 計算圖表資料、統計指標
    │
    ▼
EnergyConvergenceChart + EntropyChart  （ECharts 渲染）
```

---

## 11. 部署方式

### 11.1 本機開發

**後端**：
```bash
cd backend
uv sync           # 安裝依賴
uv run uvicorn main:app --reload --port 8000
```

**前端**：
```bash
cd qubo-dashboard
npm install
npm run dev       # http://localhost:5173
```

---

### 11.2 Docker（CPU 版）

```bash
# 後端
docker build -f backend/Dockerfile -t qubo-backend:cpu ./backend
docker run -p 8000:8000 -e CORS_ORIGINS="*" qubo-backend:cpu
```

---

### 11.3 Docker（GPU 版，需 CUDA 12.4+）

```bash
# 需要 NVIDIA Container Toolkit
docker build -f backend/Dockerfile.cuda -t qubo-backend:gpu ./backend
docker run --gpus all -p 8000:8000 qubo-backend:gpu
```

Dockerfile.cuda 使用多階段建置：
1. **Stage 1** (`nvidia/cuda:12.4.1-devel`)：`nvcc` 編譯 `aeqts.cu → solve_cuda`
2. **Stage 2** (`nvidia/cuda:12.4.1-runtime`)：複製 binary + Python 環境部署

GPU 存在時 Worker 自動使用 `solve_cuda` binary；否則退回 Python+NumPy。

---

### 11.4 環境變數

```env
DATABASE_URL=sqlite:///./database/qubo.db
CORS_ORIGINS=http://your-frontend-domain.com
WORKER_ENABLED=true
WORKER_CHECK_INTERVAL=2
HOST=0.0.0.0
PORT=8000
RELOAD=false
```

---

## 附錄：Slack Variable 說明

背包問題的約束是不等式 $\sum w_i x_i \leq C$，QUBO 只能處理等式約束，因此需要 Slack Variables 將其轉換：

$$\sum w_i x_i + \underbrace{\sum_{k=0}^{K-1} 2^k s_k}_{\text{slack}} = C$$

Slack 的二進位表示可表達 $0$ 到 $2^K - 1$ 的任意整數，需要 $K = \lceil \log_2(C+1) \rceil$ 個 bits。

例如 $C = 7$：需要 $K = 3$ bits（表示 0~7），QUBO 維度 = 物品數 + 3。

這也是為什麼 `n_variables` 在 DB 中儲存的是「展開後的完整 QUBO 維度」，而不是原始物品數。
