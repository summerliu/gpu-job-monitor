import { getJson } from './client';
import type { Job, JobStatus, Node, Paged } from './types';

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
        status: params.status?.join(','),
    });
}

export function getJob(id: number) {
    return getJson<Job>(`/jobs/${id}`);
}

export function listNodes() {
    return getJson<Node[]>('/nodes');
}
