# QUBO Optimization Platform — Backend

FastAPI 後端，負責建立、執行與保存 QUBO 最佳化任務。每次迭代的歷史資料會寫入資料庫，供 `qubo-dashboard` 輪詢並繪製收斂圖、Q-bit 機率與 entropy。

目前完整串接的公開流程為 Knapsack 與 Custom QUBO。雖然程式含有 MaxCut builder，API schema 與前端尚未提供 `nodes`、`edges` 輸入，因此它不是可直接使用的公開功能。

## 本機啟動

需求：Python 3.13+；建議使用 [uv](https://docs.astral.sh/uv/)（已提供 `uv.lock`）。在 `backend/` 目錄執行：

```bash
cp .env.example .env
uv sync
uv run main.py
```

- API：<http://localhost:8000>
- Swagger UI：<http://localhost:8000/docs>
- Health check：<http://localhost:8000/health>

同時開發前端時，請在 `qubo-dashboard/.env.local` 設定 `VITE_API_BASE=http://localhost:8000`，再啟動 Vite。後端預設 CORS 已允許 `http://localhost:5173`。

## 設定

設定由 `backend/.env` 載入；請以 `.env.example` 建立檔案。

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./database/qubo.db` | SQLAlchemy 連線字串；SQLite 相對路徑以執行目錄為基準。 |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | 逗號分隔來源；設為 `*` 時不啟用 credentials。 |
| `WORKER_ENABLED` | `true` | 是否以 APScheduler 處理 `pending` 任務。 |
| `WORKER_CHECK_INTERVAL` | `2` | Scheduler 掃描間隔（秒）。 |
| `HOST` / `PORT` | `0.0.0.0` / `8000` | API 監聽位址與埠號。 |
| `RELOAD` | `false` | 開發可設 `true`；容器與正式環境應維持 `false`。 |

## 任務流程與 API

成功回應均包在 `{ "data": ..., "message": ... }` 中。

```text
POST /api/jobs/solve → 立即回傳 job_id（running）
                              │
                    背景求解器寫入 history 與結果
                              │
GET /api/jobs/{job_id} ← 輪詢至 completed 或 failed
```

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/health` | 健康檢查。 |
| `GET` | `/api/jobs` | 任務列表；可加 `?algorithm=<solver_backend>` 篩選。 |
| `POST` | `/api/jobs` | 建立 `pending` 任務，交由 scheduler 處理。 |
| `POST` | `/api/jobs/solve` | 建立 `running` 任務並立即背景求解；前端主要使用此端點。 |
| `GET` | `/api/jobs/{job_id}` | 任務詳情、狀態與 `history_data`。 |
| `DELETE` | `/api/jobs/{job_id}` | 刪除任務及其歷史資料。 |
| `PATCH` | `/api/jobs/{job_id}/status` | 手動更新任務狀態。 |
| `POST` | `/api/jobs/{job_id}/history` | 手動新增歷史點。 |

`POST /api/jobs/solve` 初始回應的 `energy`、`selected_items`、總價值與裝置欄位是佔位資料；最終結果請以 `GET /api/jobs/{job_id}` 的 `status`、`problem_data` 和 `history_data` 為準。

### Knapsack 範例

```bash
curl -X POST http://localhost:8000/api/jobs/solve \
  -H 'Content-Type: application/json' \
  -d '{
    "task_name": "demo-knapsack",
    "problem_type": "knapsack",
    "n_variables": 3,
    "solver_backend": "simulated_annealing",
    "core_limit": 50,
    "problem_data": {
      "items": [
        {"name": "A", "weight": 2, "value": 8},
        {"name": "B", "weight": 3, "value": 11},
        {"name": "C", "weight": 4, "value": 13}
      ],
      "capacity": 5,
      "penalty": 13,
      "num_iterations": 1000,
      "timeout_seconds": 30
    }
  }'
```

取得回應中的 `data.job_id` 後，以 `GET /api/jobs/<job_id>` 輪詢。完成時 `n_variables` 會是「物品數 + slack bits」；未給 `slack_bits` 時，後端會自動使用 `ceil(log2(capacity + 1))`。

### Custom QUBO

`Q_matrix` 必須為非空數值方陣，最大 500×500；後端會與其轉置取平均後求解。

```json
{
  "task_name": "custom-demo",
  "problem_type": "custom",
  "n_variables": 2,
  "solver_backend": "simulated_annealing",
  "problem_data": {"Q_matrix": [[-1, 2], [2, -1]]}
}
```

## 求解器與限制

- Knapsack 發現可執行的 `solve_cuda` binary 時會優先使用它，否則使用 Python AEQTS。
- Python AEQTS 在已安裝 CuPy 且 GPU 可用時以 GPU 運算，否則使用 NumPy CPU。
- `timeout_seconds` 目前只傳給 CUDA Knapsack binary；Python AEQTS 尚未以此中斷迭代。
- AEQTS 為啟發式方法，不保證全域最優解；SQLite 適合開發與展示，高併發建議使用 PostgreSQL。
- 刪除已在執行的任務不會取消已啟動的求解程序。

## Docker

在 `backend/` 建置 CPU 映像：

```bash
docker build -t qubo-backend:cpu .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=sqlite:////data/qubo.db \
  -v qubo_data:/data qubo-backend:cpu
```

GPU 映像會編譯 `aeqts.cu`：

```bash
docker build -f Dockerfile.cuda -t qubo-backend:gpu .
docker run --rm --gpus all -p 8000:8000 qubo-backend:gpu
```

GPU 映像需要 NVIDIA GPU 與 NVIDIA Container Toolkit；它內含 `solve_cuda`，因此無 GPU 主機請使用 CPU Dockerfile，不要把 GPU 映像當成 CPU fallback。

根目錄的 `docker-compose.yml` 是唯一的發布設定：它會拉取 `yantwu/qubo-backend:gpu-latest` 與前端映像，並在 80 埠提供網站：

```bash
docker compose up -d
docker compose logs -f
```

此 Compose 設定含 GPU reservation，適用於具備 NVIDIA GPU 與 NVIDIA Container Toolkit 的主機。

## 專案結構

```text
backend/
├── main.py             # FastAPI、CORS、scheduler、可選 SPA 靜態檔
├── routers/jobs.py     # /api/jobs endpoints
├── worker.py           # 求解、進度與結果持久化
├── qubo/builder.py     # QUBO 矩陣建構
├── qubo/solver.py      # CUDA binary 與 Python AEQTS
├── database.py         # SQLAlchemy models 與初始化
├── Dockerfile          # CPU 映像
└── Dockerfile.cuda     # CUDA 映像
```
