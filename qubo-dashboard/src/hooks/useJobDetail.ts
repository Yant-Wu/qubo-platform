// src/hooks/useJobDetail.ts — 管理單一任務詳情狀態
import { useState, useEffect, useCallback } from 'react';
import { fetchJobDetail } from '../services/jobService';
import type { JobDetail } from '../types/job';

interface UseJobDetailReturn {
  detail: JobDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useJobDetail(activeId: string | number | null): UseJobDetailReturn {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(activeId != null); // 有 id 時初始就是載入中
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (activeId == null) {
      setDetail(null);
      return;
    }

    // 💡 輪詢時不需要每次都顯示 Loading 動畫，否則畫面會閃爍
    // setIsLoading(true); // 拔除這行以保持畫面順暢
    setError(null);
    try {
      const data = await fetchJobDetail(activeId);
      setDetail(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `無法取得任務 ${activeId} 的詳情`;
      setError(msg);
      console.error('useJobDetail error:', msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    load();
  }, [load]);

  // 正式環境：輪詢後端狀態與歷史資料
  useEffect(() => {
    if (activeId == null) return;
    const timer = setInterval(() => {
      void load();
    }, 1000); // 💡 將頻率提升為每 1 秒更新一次，讓曲線動起來
    return () => clearInterval(timer);
  }, [activeId, load]);

  return { detail, isLoading, error, refetch: load };
}