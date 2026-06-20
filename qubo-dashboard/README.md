# QUBO Dashboard

React + TypeScript + Vite 儀表板，搭配本專案的 `backend/` 使用。提供 Knapsack 與 Custom QUBO 的設定、背景任務監控、歷史任務與圖表視覺化。

## 功能

- 基本參數 → Knapsack 資料或 Custom `Q_matrix` 的兩步設定流程
- Knapsack 手動輸入，或以 CSV／JSON 匯入物品資料
- Custom QUBO 上傳 JSON 二維方陣（`.json` 或 `.txt`）
- 背景任務每秒輪詢，顯示收斂、QUBO energy、Q-bit probabilities 與 entropy
- 歷史任務檢視、刪除與「套用此設定」重跑
- 中英介面切換，語言選擇保存在瀏覽器 `localStorage`

目前 UI 僅有 **Knapsack** 與 **Custom QUBO**；後端雖含 MaxCut builder，前端尚未提供 MaxCut 輸入表單。

## 本機開發

需求：Node.js 20+、npm 10+。先依 [後端 README](../backend/README.md) 啟動 API，再在本目錄執行：

```bash
npm install
cp .env.example .env.local
npm run dev
```

開發伺服器預設位於 <http://localhost:5173>。`.env.local` 應設定：

```dotenv
VITE_API_BASE=http://localhost:8000
```

Vite 沒有設定 development proxy。若未填 `VITE_API_BASE`，瀏覽器會對 Vite 自己的來源請求 `/api/...`，不會自動轉到後端。

## 指令

```bash
npm run dev      # 啟動 Vite 開發伺服器
npm run build    # TypeScript type check 後產出 dist/
npm run preview  # 預覽已建置的 dist/
npm run lint     # ESLint 檢查
```

## 環境變數

| 變數 | 開發建議 | 說明 |
| --- | --- | --- |
| `VITE_API_BASE` | `http://localhost:8000` | 後端 URL 前綴；空字串代表同源相對路徑。 |

這是 Vite build-time 變數，變更後請重啟 `npm run dev` 或重建。Dockerfile 建置時會強制將它設為空字串，讓 API 走 Nginx 的同源 `/api/...` proxy；Docker 情境不要設定成瀏覽器無法解析的 Docker service 名稱。

## 後端整合

| Method | Endpoint | 用途 |
| --- | --- | --- |
| `GET` | `/api/jobs` | 讀取側欄歷史任務。 |
| `GET` | `/api/jobs/{id}` | 讀取詳情與 `history_data`；執行中每秒輪詢。 |
| `POST` | `/api/jobs/solve` | 建立並啟動背景求解。 |
| `DELETE` | `/api/jobs/{id}` | 刪除歷史任務。 |

`POST /api/jobs/solve` 會立即回傳 `job_id`，真正結果稍後才寫入任務紀錄。因此監控頁以 `GET /api/jobs/{id}` 的 `status`、`history_data` 與 `problem_data` 為準，不應將初始 solve 回應當成最終結果。

## 匯入格式

Knapsack CSV 第一列必須含 `name`、`weight`、`value`，欄位順序不限：

```csv
name,weight,value
A,2,8
B,3,11
```

Knapsack JSON 接受陣列，或含 `items` 陣列的物件：

```json
[{"name": "A", "weight": 2, "value": 8}]
```

Custom QUBO 檔案必須為非空數值方陣：

```json
[[-1, 2], [2, -1]]
```

## Docker 與部署

Dockerfile 以 Nginx 提供靜態檔，並將 `/api/*`、`/health` 代理至 Docker 網路中的 `backend:8000`。使用根目錄的 Compose 同時啟動兩個服務：

```bash
# 在專案根目錄執行
docker compose up -d
```

完成後開啟 <http://localhost>。此 Compose 使用 GPU 後端，NVIDIA 主機需求請參閱 [後端 Docker 說明](../backend/README.md#docker)。

若只用 `docker run` 啟動前端容器，容器內不會自動有名為 `backend` 的主機，API proxy 無法連線。請使用 Compose，或自行建立同一 Docker network 並提供名為 `backend` 的服務。

## 目錄結構

```text
qubo-dashboard/
├── src/
│   ├── components/  # 設定頁、側欄、監控與圖表
│   ├── hooks/       # 表單、任務查詢與輪詢
│   ├── services/    # API client、jobs 與 solve 呼叫
│   └── types/       # 共用型別
├── nginx.conf       # API proxy 與 SPA fallback
├── Dockerfile       # Node build + Nginx runtime
└── vite.config.ts
```

## 疑難排解

- **開發時 API 404／Network Error**：確認後端在 8000 埠啟動，`.env.local` 的 `VITE_API_BASE` 是 `http://localhost:8000`，再重啟 Vite。
- **Docker 前端有畫面卻沒有資料**：確認兩個服務在同一 Compose network；使用 `docker compose logs backend` 查看 API 與資料庫初始化。
- **任務長時間 running 或 failed**：查看後端日誌；`failed` 的錯誤類型會寫在 `error_message`。GPU 映像需有可用的 NVIDIA runtime。
- **建置或型別問題**：依序執行 `npm run lint` 與 `npm run build`。
