// src/services/jobService.ts — 封裝 Job 相關 API 請求（單一職責：Job CRUD）
import { request } from './apiClient';
import type { JobItem, JobDetail, ApiResponse, CreateJobPayload } from '../types/job';

/** 取得任務列表 */
export async function fetchJobs(): Promise<JobItem[]> {
  const result = await request<ApiResponse<JobItem[]>>('/api/jobs');
  return Array.isArray(result.data) ? result.data : [];
}

/** 取得單一任務詳情 */
export async function fetchJobDetail(id: string | number): Promise<JobDetail> {
  const result = await request<ApiResponse<JobDetail>>(`/api/jobs/${id}`);
  return result.data;
}

/** 建立新任務 */
export async function createJob(payload: CreateJobPayload): Promise<JobDetail> {
  const result = await request<ApiResponse<JobDetail>>('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.data;
}

/** 刪除任務 */
export async function deleteJob(id: string | number): Promise<void> {
  await request<unknown>(`/api/jobs/${id}`, { method: 'DELETE' });
}