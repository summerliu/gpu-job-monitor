import type { JobStatus } from '@/api/types';

export interface JobFilters {
    q: string;
    status: JobStatus[];
    node: string;
    sort: string;
    page: number;
    pageSize: number;
}

export const DEFAULT_FILTERS: JobFilters = {
    q: '',
    status: [],
    node: '',
    sort: 'createdAt:desc',
    page: 1,
    pageSize: 50,
};

const ALL_STATUSES = new Set<JobStatus>([
    'PENDING',
    'RUNNING',
    'STOPPING',
    'STOPPED',
    'SUCCEEDED',
    'FAILED',
]);

function parsePositiveInt(raw: string | null, fallback: number): number {
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** 把目前的 URL query 轉成篩選條件；任何無法識別的值都安靜地回退到預設值，不丟錯誤。 */
export function parseFilters(params: URLSearchParams): JobFilters {
    const status = (params.get('status') ?? '')
        .split(',')
        .filter((s): s is JobStatus => ALL_STATUSES.has(s as JobStatus));

    return {
        q: params.get('q') ?? DEFAULT_FILTERS.q,
        status,
        node: params.get('node') ?? DEFAULT_FILTERS.node,
        sort: params.get('sort') ?? DEFAULT_FILTERS.sort,
        page: parsePositiveInt(params.get('page'), DEFAULT_FILTERS.page),
        pageSize: parsePositiveInt(params.get('pageSize'), DEFAULT_FILTERS.pageSize),
    };
}

/** 反過來把篩選條件轉成 URLSearchParams；等於預設值的欄位不寫入，保持網址乾淨。 */
export function filtersToSearchParams(filters: JobFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status.length) params.set('status', filters.status.join(','));
    if (filters.node) params.set('node', filters.node);
    if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
    if (filters.page !== DEFAULT_FILTERS.page) params.set('page', String(filters.page));
    if (filters.pageSize !== DEFAULT_FILTERS.pageSize) {
        params.set('pageSize', String(filters.pageSize));
    }
    return params;
}

export function hasActiveFilters(filters: JobFilters): boolean {
    return Boolean(filters.q || filters.status.length || filters.node);
}
