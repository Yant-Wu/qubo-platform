// src/services/apiClient.ts — 通用 HTTP 請求工具（單一職責：HTTP 通訊）

// 空字串 = 相對路徑（與 FastAPI 同源），開發時可用 .env.local 覆蓋
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** 通用 fetch 包裝：自動解析 JSON 並處理 HTTP 錯誤 */
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',   // 跳過 ngrok 免費版攔截頁
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}
