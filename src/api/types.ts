// 依 mock-server/openapi.yaml 產生

export type JobStatus = 'PENDING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'SUCCEEDED' | 'FAILED';

export interface Job {
    // 後端是 int64，JS number 會在 2^53 後失去精度，因此以字串表示（見 src/api/client.ts）。
    id: string;
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

export type MetricsRange = '15m' | '1h' | '6h';

export interface GpuPoint {
    util: number | null;
    memUsedMiB: number | null;
}

export interface MetricsPoint {
    ts: string;
    gpu: GpuPoint[];
}

export interface JobMetrics {
    gpus: number[];
    points: MetricsPoint[];
}

export interface LogLine {
    seq: number;
    text: string;
}
