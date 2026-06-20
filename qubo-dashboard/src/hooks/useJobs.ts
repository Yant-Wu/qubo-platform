// src/hooks/useJobs.ts — 管理任務列表狀態
import { useState, useEffect, useCallback } from 'react';
import { fetchJobs } from '../services/jobService';
import type { JobItem } from '../types/job';

interface UseJobsReturn {
  jobList: JobItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useJobs(): UseJobsReturn {
  const [jobList, setJobList] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchJobs();
      setJobList(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '無法取得任務列表';
      setError(msg);
      console.error('useJobs error:', msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { jobList, isLoading, error, refetch: load };
}