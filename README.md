# QUBO Dashboard

以 React + TypeScript + Vite 打造的 QUBO/Knapsack 監控儀表板，支援：

- 參數設定 -> QUBO 設定 -> 求解監控三步驟流程
- 歷史任務列表與任務詳情查詢
- Q_matrix 檔案上傳（custom 路徑）
- Knapsack 手動輸入與 CSV/JSON 匯入
- 收斂圖、Q-bit 機率圖、Entropy 圖
- 左側欄 EN/CH 語言切換（語言會保存在 localStorage）

## 技術棧

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- ECharts + echarts-for-react
- ESLint + typescript-eslint

## 目錄結構

```text
src/
  components/          UI 元件（頁面與圖表）
  hooks/               狀態與資料流程 Hook
  services/            API 封裝
  types/               共用型別
  App.tsx              頁面流程與全域狀態
```

## 環境需求

- Node.js 20+
- npm 10+

## 本機開發

1. 安裝依賴

```bash
npm install
```

2. 建立環境變數

```bash
cp .env.example .env.local
```

3. 啟動開發伺服器

```bash
npm run dev
```

## 可用指令

```bash
npm run dev      # 啟動開發模式
npm run build    # 型別檢查 + 正式打包
npm run preview  # 本機預覽打包結果
npm run lint     # 程式碼檢查
```

## 環境變數

| 變數 | 說明 | 預設 |
| --- | --- | --- |
| `VITE_API_BASE` | 後端 API Base URL。留空代表同源（例如 `/api/...`） | `""` |

說明：

- 本地開發可設為 `http://localhost:8000`
- 若前後端同網域（例如 nginx 反向代理），建議留空

## 前端 API 依賴

前端目前使用以下端點：

- `GET /api/jobs`：任務列表
- `GET /api/jobs/{id}`：任務詳情
- `POST /api/jobs`：建立任務
- `DELETE /api/jobs/{id}`：刪除任務
- `POST /api/jobs/solve`：建立並同步求解（回傳結果與 job_id）

建議後端資料一致性：

- 以後端 `status` 作為任務真實狀態來源
- 以後端 `history_data` 作為圖表資料來源

## Docker 部署

專案內含多階段 Dockerfile：

- Stage 1：Node 映像進行 build
- Stage 2：Nginx 提供靜態檔

建置映像：

```bash
docker build -t qubo-dashboard .
```

啟動容器：

```bash
docker run --rm -p 8080:80 qubo-dashboard
```

Nginx 設定重點：

- `/api/*` 會 proxy 到 `http://backend:8000`
- SPA 路由 fallback 到 `index.html`
- 靜態資源快取已啟用

若你使用 Docker Compose，請確保後端服務名稱為 `backend`，或同步調整 `nginx.conf` 的 `proxy_pass`。

## 主要使用流程

1. 在第一頁填入任務基本參數
2. 在第二頁設定 Knapsack 資料或上傳 custom Q_matrix
3. 送出後進入監控頁，查看收斂曲線與最佳化結果
4. 可從左側歷史任務直接回看舊任務

## 疑難排解

- API 404/500：先檢查 `VITE_API_BASE` 與後端端點是否一致
- 畫面空白：檢查瀏覽器 console 與 `npm run build` 是否有錯
- Docker 下 API 無法連線：確認 nginx 反向代理目標與服務名稱

## 授權

若需開源發布，請補上對應授權（例如 MIT）。
