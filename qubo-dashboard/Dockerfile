# qubo-dashboard/Dockerfile — React 前端容器（build + nginx）

# ── Stage 1: Build ────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# 先安裝依賴（利用 layer cache）
COPY package*.json ./
RUN npm ci

# 複製原始碼並編譯
COPY . .
# VITE_API_BASE 留空：瀏覽器請求 /api/... 與前端同源，由 nginx proxy 負責轉發
RUN VITE_API_BASE= npm run build


# ── Stage 2: Serve with nginx ─────────────────────────────────────
FROM nginx:1.27-alpine

# 注入自訂 nginx 設定（含 /api 反向代理規則）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 複製靜態檔案
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
