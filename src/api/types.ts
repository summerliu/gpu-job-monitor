// 依 mock-server/openapi.yaml 產生

export type JobStatus = 'PENDING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'SUCCEEDED' | 'FAILED';

export interface Job {
    id: number;
    name: string;
    status: JobStatus;
    node: string | null;
    gpuCount: number;
    owner: string;
    description: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
}

export interface Node {
    name: string;
    displayName: string;
    gpuModel: string;
    gpuCount: number;
}

export interface Paged<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ApiError {
    code: string;
    message: string;
}

export interface Envelope<T> {
    data: T | null;
    error: ApiError | null;
}
