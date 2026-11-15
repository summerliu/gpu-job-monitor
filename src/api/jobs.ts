import { getJson, postJson } from './client';
import type { Job, JobMetrics, JobStatus, MetricsRange, Node, Paged } from './types';

export interface ListJobsParams {
    q?: string;
    status?: JobStatus[];
    node?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
}

export function listJobs(params: ListJobsParams = {}) {
    return getJson<Paged<Job>>('/jobs', {
        ...params,
        status: params.status?.length ? params.status.join(',') : undefined,
    });
}

export function getJob(id: string) {
    return getJson<Job>(`/jobs/${id}`);
}

export function listNodes() {
    return getJson<Node[]>('/nodes');
}

export function stopJob(id: string) {
    return postJson<Job>(`/jobs/${id}/stop`);
}

export function getJobMetrics(id: string, range: MetricsRange) {
    return getJson<JobMetrics>(`/jobs/${id}/metrics`, { range });
}

export function logStreamUrl(id: string) {
    return `/api/v1/jobs/${id}/logs/stream`;
}
